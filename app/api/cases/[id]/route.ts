// src/app/api/cases/[id]/pdf/route.ts
// Digital Case Book — PDF Export (GET) + Case Update (PUT) + Delete (DELETE)
// PDF generation uses pdfkit only. No pdfmake, no jsPDF.

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Case from "@/models/Case";
import { requireAuth } from "@/middleware/auth";
import { parseAttachments } from "@/lib/parseAttachments";
import { populateCase } from "@/app/api/cases/route";

type Params = { params: Promise<{ id: string }> };

// ─── Display helpers ──────────────────────────────────────────────────────────
const ROLE_LABELS: Record<string, string> = {
  nco: "NCO / Station Orderly",
  cid: "CID Investigator",
  so: "Station Officer",
  dc: "District Commander",
  admin: "Administrator",
};

const ENTRY_TYPE_LABELS: Record<string, string> = {
  remark: "Remark",
  referral: "Referral Note",
  investigation_start: "Investigation Commenced",
  findings: "Investigation Findings",
  directive: "Directive",
  review: "Review Notes",
  decision: "Final Decision",
};

const STAGE_ORDER = ["nco", "cid", "so", "dc"];

const STAGE_COLORS: Record<
  string,
  { header: string; light: string; accent: string }
> = {
  nco: { header: "#1e40af", light: "#eff6ff", accent: "#3b82f6" },
  cid: { header: "#3730a3", light: "#eef2ff", accent: "#6366f1" },
  so: { header: "#6b21a8", light: "#faf5ff", accent: "#a855f7" },
  dc: { header: "#92400e", light: "#fffbeb", accent: "#f59e0b" },
};

function fmt(d?: Date | string | null): string {
  if (!d) return "\u2014";
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDate(d?: Date | string | null): string {
  if (!d) return "\u2014";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function officerLabel(o: any): string {
  if (!o) return "\u2014";
  return `${o.fullName}${o.badgeNumber ? ` (${o.badgeNumber})` : ""}`;
}

function statusLabel(s: string): string {
  const m: Record<string, string> = {
    open: "Open",
    referred: "Referred to CID",
    investigating: "Investigating",
    under_review: "Under Review",
    commander_review: "Commander Review",
    closed: "Closed",
    suspended: "Suspended",
  };
  return m[s] || s;
}

function priorityColor(p: string): string {
  return p === "Felony"
    ? "#dc2626"
    : p === "Misdemeanour"
      ? "#ca8a04"
      : "#374151";
}

// ─── Hex colour → pdfkit-compatible string (already hex, just pass through) ──
// pdfkit accepts CSS hex strings directly.

// ─── PDF builder ──────────────────────────────────────────────────────────────
async function buildPDF(caseData: any): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfkitModule = require("pdfkit");
  const PDFDocument = pdfkitModule.default ?? pdfkitModule;

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 72, bottom: 60, left: 40, right: 40 },
    bufferPages: true,
    info: {
      Title: `Case Book \u2014 ${caseData.caseNumber}`,
      Author: "Ghana Police Service",
      Subject: "Digital Case Book Official Record",
      Creator: "Digital Case Book System",
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const pageW = doc.page.width; // 595.28
  const pageH = doc.page.height; // 841.89
  const mL = 40;
  const mR = 40;
  const cW = pageW - mL - mR; // 515.28

  // ── Utility drawing helpers ─────────────────────────────────────────────────

  /** Filled (optionally rounded) rectangle */
  function rect(
    x: number,
    y: number,
    w: number,
    h: number,
    fill: string,
    r = 0,
  ) {
    doc.save().roundedRect(x, y, w, h, r).fill(fill).restore();
  }

  /** Stroked rectangle border only */
  function border(
    x: number,
    y: number,
    w: number,
    h: number,
    stroke: string,
    lw = 0.75,
  ) {
    doc
      .save()
      .rect(x, y, w, h)
      .strokeColor(stroke)
      .lineWidth(lw)
      .stroke()
      .restore();
  }

  /** Horizontal rule */
  function hRule(y: number, color = "#e2e8f0", lw = 0.5) {
    doc
      .save()
      .moveTo(mL, y)
      .lineTo(mL + cW, y)
      .strokeColor(color)
      .lineWidth(lw)
      .stroke()
      .restore();
  }

  /** Ensure enough vertical space remains; add page + header/footer if not */
  function need(h: number) {
    if (doc.y + h > pageH - 70) {
      doc.addPage();
      stampHeaderFooter();
    }
  }

  /** Small label above a value */
  function fieldLabel(text: string, x: number, y: number, w = 120) {
    doc
      .save()
      .font("Helvetica-Bold")
      .fontSize(6.5)
      .fillColor("#64748b")
      .text(text.toUpperCase(), x, y, { width: w, characterSpacing: 0.6 })
      .restore();
  }

  /** Body text */
  function body(
    text: string,
    x: number,
    y: number,
    w: number,
    color = "#334155",
    size = 9,
  ) {
    doc
      .save()
      .font("Helvetica")
      .fontSize(size)
      .fillColor(color)
      .text(text || "\u2014", x, y, { width: w, lineGap: 1.5 })
      .restore();
  }

  /** Bold text */
  function bold(
    text: string,
    x: number,
    y: number,
    w: number,
    color = "#0f172a",
    size = 9,
  ) {
    doc
      .save()
      .font("Helvetica-Bold")
      .fontSize(size)
      .fillColor(color)
      .text(text || "\u2014", x, y, { width: w })
      .restore();
  }

  /** Full-width section header band */
  function sectionBand(title: string, color = "#1e3a8a") {
    need(32);
    const y = doc.y + 10;
    rect(mL, y, cW, 22, color, 3);
    doc
      .save()
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor("#ffffff")
      .text(title.toUpperCase(), mL + 10, y + 7, {
        width: cW - 20,
        characterSpacing: 1.2,
      })
      .restore();
    doc.y = y + 28;
  }

  /** Per-page running header + footer (called on every new page) */
  function stampHeaderFooter() {
    const savedY = doc.y;
    // Header
    doc
      .save()
      .font("Helvetica")
      .fontSize(7)
      .fillColor("#94a3b8")
      .text("GHANA POLICE SERVICE \u2014 DIGITAL CASE BOOK", mL, 22, {
        width: cW / 2,
      })
      .text(caseData.caseNumber, mL + cW / 2, 22, {
        width: cW / 2,
        align: "right",
      })
      .restore();
    // Footer
    const fY = pageH - 34;
    doc
      .save()
      .font("Helvetica-Oblique")
      .fontSize(7)
      .fillColor("#94a3b8")
      .text("CONFIDENTIAL \u2014 FOR OFFICIAL USE ONLY", mL, fY, {
        width: cW / 2,
      })
      .font("Helvetica")
      .text(
        `Generated by Digital Case Book System \u00b7 ${new Date().toLocaleDateString("en-GB")}`,
        mL + cW / 2,
        fY,
        { width: cW / 2, align: "right" },
      )
      .restore();
    doc.y = savedY;
  }

  // ── PAGE 1 HEADER ───────────────────────────────────────────────────────────
  rect(mL, 56, cW, 76, "#1e3a8a", 6);
  doc
    .save()
    .font("Helvetica-Bold")
    .fontSize(19)
    .fillColor("#ffffff")
    .text("GHANA POLICE SERVICE", mL, 75, { width: cW, align: "center" })
    .restore();
  doc
    .save()
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#bfdbfe")
    .text("DIGITAL CASE BOOK \u2014 OFFICIAL RECORD", mL, 101, {
      width: cW,
      align: "center",
      characterSpacing: 1.4,
    })
    .restore();
  doc.y = 148;
  stampHeaderFooter();

  // ── CASE IDENTITY BOX ───────────────────────────────────────────────────────
  const idY = doc.y;
  const idH = 102;
  rect(mL, idY, cW, idH, "#f8fafc", 4);
  border(mL, idY, cW, idH, "#cbd5e1", 1);

  // Left — case number + title + description
  fieldLabel("Case Number", mL + 12, idY + 10);
  bold(caseData.caseNumber, mL + 12, idY + 20, 220, "#1e3a8a", 20);
  bold(caseData.title || "", mL + 12, idY + 52, cW - 180, "#0f172a", 12);
  body(caseData.description || "", mL + 12, idY + 68, cW - 180, "#475569", 8.5);

  // Right — status + priority
  const rX = mL + cW - 158;
  fieldLabel("Status", rX, idY + 10, 150);
  bold(statusLabel(caseData.status), rX, idY + 20, 150, "#1e3a8a", 10);
  fieldLabel("Priority", rX, idY + 44, 150);
  bold(
    caseData.priority || "\u2014",
    rX,
    idY + 54,
    150,
    priorityColor(caseData.priority),
    10,
  );

  doc.y = idY + idH + 8;

  // ── KEY DETAILS GRID ────────────────────────────────────────────────────────
  const gridRows: [string, string][][] = [
    [
      ["Category", cap(caseData.category || "")],
      ["Location", caseData.location || "\u2014"],
      ["Date Occurred", fmtDate(caseData.dateOccurred)],
      ["Date Reported", fmtDate(caseData.dateReported)],
    ],
    [
      [
        "Reporter",
        `${caseData.reportedBy?.name || "\u2014"}${caseData.reportedBy?.phone ? "\n" + caseData.reportedBy.phone : ""}`,
      ],
      ["Logged By", officerLabel(caseData.loggedBy)],
      ["CID Investigator", officerLabel(caseData.assignedOfficer)],
      ["Station Officer", officerLabel(caseData.assignedSO)],
    ],
  ];

  const colW4 = cW / 4;
  gridRows.forEach((row, ri) => {
    const rH = 40;
    need(rH + 2);
    const rY = doc.y;
    rect(mL, rY, cW, rH, ri % 2 === 0 ? "#f8fafc" : "#ffffff");
    border(mL, rY, cW, rH, "#e2e8f0", 0.5);
    row.forEach(([label, value], ci) => {
      const cx = mL + ci * colW4 + 6;
      fieldLabel(label, cx, rY + 6, colW4 - 10);
      body(value, cx, rY + 17, colW4 - 12, "#1e293b", 8);
    });
    doc.y = rY + rH;
  });
  doc.y += 6;

  // ── WORKFLOW TIMELINE ───────────────────────────────────────────────────────
  sectionBand("Case Workflow Progress");
  const tlY = doc.y;
  const colWt = cW / 4;
  const curIdx = STAGE_ORDER.indexOf(caseData.currentStage);

  STAGE_ORDER.forEach((stage, idx) => {
    const pal = STAGE_COLORS[stage];
    const cx = mL + idx * colWt + colWt / 2;
    const isPast = idx < curIdx;
    const isCur = idx === curIdx;
    const circleC = isCur ? pal.header : isPast ? "#64748b" : "#e2e8f0";
    const labelC = isCur ? pal.header : isPast ? "#475569" : "#94a3b8";
    const statusC = isCur ? pal.accent : isPast ? "#22c55e" : "#cbd5e1";
    const statusTx = isCur ? "CURRENT" : isPast ? "DONE" : "PENDING";

    // Connector line to next node
    if (idx < 3) {
      doc
        .save()
        .moveTo(cx + 16, tlY + 16)
        .lineTo(cx + colWt - 16, tlY + 16)
        .strokeColor(isPast ? "#64748b" : "#e2e8f0")
        .lineWidth(2)
        .stroke()
        .restore();
    }
    // Circle
    doc
      .save()
      .circle(cx, tlY + 16, 14)
      .fill(circleC)
      .restore();
    // Stage abbreviation inside circle
    doc
      .save()
      .font("Helvetica-Bold")
      .fontSize(7.5)
      .fillColor("#ffffff")
      .text(stage.toUpperCase(), cx - 12, tlY + 11, {
        width: 24,
        align: "center",
      })
      .restore();
    // Label below
    doc
      .save()
      .font("Helvetica-Bold")
      .fontSize(7)
      .fillColor(labelC)
      .text(ROLE_LABELS[stage], cx - colWt / 2 + 4, tlY + 34, {
        width: colWt - 8,
        align: "center",
      })
      .restore();
    // Status pill
    doc
      .save()
      .font("Helvetica-Bold")
      .fontSize(6)
      .fillColor(statusC)
      .text(statusTx, cx - colWt / 2 + 4, tlY + 46, {
        width: colWt - 8,
        align: "center",
      })
      .restore();
  });
  doc.y = tlY + 60;

  // ── DIGITAL CASE BOOK ENTRIES ────────────────────────────────────────────────
  sectionBand("Digital Case Book \u2014 Officer Entries");

  const grouped: Record<string, any[]> = { nco: [], cid: [], so: [], dc: [] };
  (caseData.caseBookEntries || []).forEach((e: any) => {
    if (grouped[e.stage]) grouped[e.stage].push(e);
  });

  for (const stage of STAGE_ORDER) {
    const entries = grouped[stage] || [];
    const pal = STAGE_COLORS[stage];
    const stageLbl = ROLE_LABELS[stage] || stage.toUpperCase();
    const countTxt = entries.length
      ? `${entries.length} entr${entries.length === 1 ? "y" : "ies"}`
      : "No entries recorded";

    need(36);
    const shY = doc.y + 6;
    rect(mL, shY, cW, 24, pal.header, 3);
    doc
      .save()
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor("#ffffff")
      .text(stageLbl.toUpperCase(), mL + 10, shY + 7, {
        width: cW / 2,
        characterSpacing: 0.5,
      })
      .restore();
    doc
      .save()
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#bfdbfe")
      .text(countTxt, mL + cW / 2, shY + 8, {
        width: cW / 2 - 10,
        align: "right",
      })
      .restore();
    doc.y = shY + 30;

    if (entries.length === 0) {
      doc
        .save()
        .font("Helvetica-Oblique")
        .fontSize(9)
        .fillColor("#94a3b8")
        .text(
          "No case book entries were recorded at this stage.",
          mL + 12,
          doc.y,
          { width: cW - 24 },
        )
        .restore();
      doc.y += 10;
      continue;
    }

    for (const entry of entries) {
      const typeLabel = ENTRY_TYPE_LABELS[entry.entryType] || entry.entryType;
      const oName = entry.addedBy?.fullName || "Unknown Officer";
      const oRole = ROLE_LABELS[entry.roleSnapshot] || entry.roleSnapshot;
      const badge = entry.addedBy?.badgeNumber
        ? ` \u00b7 Badge: ${entry.addedBy.badgeNumber}`
        : "";
      const contentTxt = entry.content || "—";

      // Measure the ACTUAL rendered height of the content (honours word-wrap and
      // explicit line breaks) so the box always fully contains the text instead
      // of clipping long entries behind the following box.
      doc.font("Helvetica").fontSize(9);
      const contentH = doc.heightOfString(contentTxt, {
        width: cW - 28,
        lineGap: 2,
      });
      const boxH = Math.max(72, 34 + contentH + 22);
      need(boxH + 12);

      const eY = doc.y + 4;
      rect(mL, eY, cW, boxH, pal.light, 3);
      border(mL, eY, cW, boxH, pal.accent, 1.5);
      rect(mL, eY, 4, boxH, pal.accent, 2); // left accent bar
      rect(mL + 12, eY + 8, 92, 14, pal.accent, 2); // type pill bg

      // Type pill text
      doc
        .save()
        .font("Helvetica-Bold")
        .fontSize(7)
        .fillColor("#ffffff")
        .text(typeLabel.toUpperCase(), mL + 14, eY + 11, {
          width: 88,
          characterSpacing: 0.3,
        })
        .restore();

      // Officer name + role
      bold(
        `${oName} (${oRole})${badge}`,
        mL + 112,
        eY + 9,
        cW - 240,
        pal.header,
        8.5,
      );

      // Timestamp (right-aligned)
      doc
        .save()
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#64748b")
        .text(fmt(entry.addedAt), mL + cW - 128, eY + 9, {
          width: 118,
          align: "right",
        })
        .restore();

      // Divider
      hRule(eY + 28, pal.accent, 0.5);

      // Entry content
      doc
        .save()
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#1e293b")
        .text(contentTxt, mL + 12, eY + 34, { width: cW - 28, lineGap: 2 })
        .restore();

      // Lock notice
      doc
        .save()
        .font("Helvetica-Oblique")
        .fontSize(7)
        .fillColor("#94a3b8")
        .text(
          "Entry locked \u2014 cannot be edited after submission",
          mL + 12,
          eY + boxH - 14,
          { width: cW - 28 },
        )
        .restore();

      doc.y = eY + boxH + 6;
    }
  }

  // ── SUSPECTS & WITNESSES ────────────────────────────────────────────────────
  if (caseData.suspects?.length || caseData.witnesses?.length) {
    sectionBand("Parties Involved", "#374151");

    function drawPartyTable(
      items: any[],
      headers: string[],
      widths: number[],
      rowFn: (item: any) => string[],
      accentColor: string,
    ) {
      need(28);
      // Header row
      const hY = doc.y;
      rect(mL, hY, cW, 20, accentColor);
      let x = mL;
      headers.forEach((h, i) => {
        doc
          .save()
          .font("Helvetica-Bold")
          .fontSize(8)
          .fillColor("#ffffff")
          .text(h, x + 4, hY + 6, { width: widths[i] - 8 })
          .restore();
        x += widths[i];
      });
      doc.y = hY + 22;

      items.forEach((item, ri) => {
        const cells = rowFn(item);
        doc.font("Helvetica").fontSize(8);
        const rowH = Math.max(
          22,
          Math.max(
            ...cells.map((c, i) =>
              doc.heightOfString(c || "—", { width: widths[i] - 8 }),
            ),
          ) + 12,
        );
        need(rowH + 2);
        const rY = doc.y;
        rect(mL, rY, cW, rowH, ri % 2 === 0 ? "#f8fafc" : "#ffffff");
        border(mL, rY, cW, rowH, "#e2e8f0", 0.5);
        let cx = mL;
        cells.forEach((cell, i) => {
          body(cell || "\u2014", cx + 4, rY + 6, widths[i] - 8, "#334155", 8);
          cx += widths[i];
        });
        doc.y = rY + rowH;
      });
      doc.y += 6;
    }

    if (caseData.suspects?.length) {
      need(24);
      doc
        .save()
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor("#dc2626")
        .text("SUSPECTS", mL, doc.y, { characterSpacing: 1 })
        .restore();
      doc.y += 5;
      const sw = [cW * 0.25, cW * 0.1, cW * 0.35, cW * 0.3];
      drawPartyTable(
        caseData.suspects,
        ["NAME", "AGE", "DESCRIPTION", "ADDRESS"],
        sw,
        (s: any) => [
          s.name || "\u2014",
          s.age ? String(s.age) : "\u2014",
          s.description || "\u2014",
          s.address || "\u2014",
        ],
        "#374151",
      );
    }

    if (caseData.witnesses?.length) {
      need(24);
      doc
        .save()
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor("#16a34a")
        .text("WITNESSES", mL, doc.y, { characterSpacing: 1 })
        .restore();
      doc.y += 5;
      const ww = [cW * 0.25, cW * 0.2, cW * 0.55];
      drawPartyTable(
        caseData.witnesses,
        ["NAME", "PHONE", "STATEMENT"],
        ww,
        (w: any) => [
          w.name || "\u2014",
          w.phone || "\u2014",
          w.statement || "\u2014",
        ],
        "#374151",
      );
    }
  }

  // ── OFFICIAL HANDOFF NOTES ───────────────────────────────────────────────────
  const handoffs = [
    {
      label: "NCO Referral Note",
      val: caseData.ncoReferralNote,
      color: "#1d4ed8",
    },
    {
      label: "CID Submission Note",
      val: caseData.cidSubmissionNote,
      color: "#4338ca",
    },
    {
      label: "Station Officer Review",
      val: caseData.soReviewNote,
      color: "#7c3aed",
    },
    {
      label: "Station Officer Directive",
      val: caseData.soDirective,
      color: "#dc2626",
    },
    {
      label: "District Commander Decision",
      val: caseData.dcNote,
      color: "#92400e",
    },
  ].filter((n) => n.val?.trim());

  if (handoffs.length) {
    sectionBand("Official Handoff Notes", "#374151");
    for (const hn of handoffs) {
      doc.font("Helvetica").fontSize(9);
      const valH = doc.heightOfString(hn.val || "—", {
        width: cW - 28,
        lineGap: 1.5,
      });
      const boxH = Math.max(46, 30 + valH);
      need(boxH + 12);
      const hnY = doc.y + 4;
      rect(mL, hnY, cW, boxH, "#f8fafc", 3);
      border(mL, hnY, cW, boxH, "#e2e8f0", 1);
      rect(mL, hnY, 4, boxH, hn.color, 2); // left accent bar
      bold(hn.label.toUpperCase(), mL + 12, hnY + 9, cW - 24, hn.color, 8);
      body(hn.val || "", mL + 12, hnY + 23, cW - 28, "#334155", 9);
      doc.y = hnY + boxH + 6;
    }
  }

  // ── AUDIT TRAIL ─────────────────────────────────────────────────────────────
  if (caseData.auditLog?.length) {
    sectionBand("Audit Trail", "#374151");

    const aW = [cW * 0.22, cW * 0.33, cW * 0.25, cW * 0.2];
    const aHeaders = ["DATE & TIME", "ACTION", "OFFICER", "TRANSITION"];

    need(26);
    const ahY = doc.y;
    rect(mL, ahY, cW, 20, "#1e3a8a");
    let ax = mL;
    aHeaders.forEach((h, i) => {
      doc
        .save()
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor("#ffffff")
        .text(h, ax + 4, ahY + 6, { width: aW[i] - 8 })
        .restore();
      ax += aW[i];
    });
    doc.y = ahY + 22;

    caseData.auditLog.forEach((e: any, i: number) => {
      const transition =
        e.fromStage && e.toStage && e.fromStage !== e.toStage
          ? `${e.fromStage.toUpperCase()} -> ${e.toStage.toUpperCase()}`
          : e.fromStage
            ? e.fromStage.toUpperCase()
            : "\u2014";
      const cells = [
        fmt(e.performedAt),
        (e.details || e.action || "").replace(/_/g, " "),
        e.performedBy?.fullName || "System",
        transition,
      ];
      doc.font("Helvetica").fontSize(8);
      const rowH = Math.max(
        22,
        Math.max(
          ...cells.map((c, ci) =>
            doc.heightOfString(c || "—", { width: aW[ci] - 8 }),
          ),
        ) + 12,
      );
      need(rowH + 2);
      const rY = doc.y;
      rect(mL, rY, cW, rowH, i % 2 === 0 ? "#f8fafc" : "#ffffff");
      border(mL, rY, cW, rowH, "#e2e8f0", 0.5);
      let cx = mL;
      cells.forEach((cell, ci) => {
        body(cell, cx + 4, rY + 6, aW[ci] - 8, "#334155", 8);
        cx += aW[ci];
      });
      doc.y = rY + rowH;
    });
    doc.y += 6;
  }

  // ── CASE TIMELINE ───────────────────────────────────────────────────────────
  const timestamps = [
    { label: "Case Reported", val: caseData.dateReported },
    { label: "Referred to CID", val: caseData.referredAt },
    { label: "Investigation Started", val: caseData.investigationStartedAt },
    { label: "Submitted for Review", val: caseData.submittedForReviewAt },
    { label: "SO Reviewed", val: caseData.soReviewedAt },
    { label: "DC Reviewed", val: caseData.dcReviewedAt },
    { label: "Case Closed", val: caseData.closedAt },
  ].filter((t) => t.val);

  if (timestamps.length > 1) {
    sectionBand("Case Timeline", "#374151");
    timestamps.forEach((t, i) => {
      const tH = 20;
      need(tH + 2);
      const tY = doc.y;
      rect(mL, tY, cW, tH, i % 2 === 0 ? "#f8fafc" : "#ffffff");
      border(mL, tY, cW, tH, "#e2e8f0", 0.5);
      bold(t.label, mL + 8, tY + 5, cW * 0.38, "#374151", 9);
      body(
        fmt(t.val as string),
        mL + cW * 0.4,
        tY + 5,
        cW * 0.58,
        "#475569",
        9,
      );
      doc.y = tY + tH;
    });
    doc.y += 8;
  }

  // ── CERTIFICATION + SIGNATURES ──────────────────────────────────────────────
  need(150);
  doc.y += 16;
  hRule(doc.y, "#cbd5e1", 1);
  doc.y += 8;

  const certY = doc.y;

  // Left — certification text
  bold("CERTIFICATION", mL, certY, cW * 0.55, "#374151", 8);
  body(
    "This is a certified digital copy of the official case record generated by the Ghana Police Service Digital Case Book System.",
    mL,
    certY + 13,
    cW * 0.55,
    "#64748b",
    7,
  );

  // Right — document details
  const dX = mL + cW * 0.6;
  const dW = cW * 0.4;
  doc
    .save()
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor("#374151")
    .text("DOCUMENT DETAILS", dX, certY, { width: dW, align: "right" })
    .restore();
  doc
    .save()
    .font("Helvetica")
    .fontSize(7)
    .fillColor("#64748b")
    .text(`Generated: ${fmt(new Date().toISOString())}`, dX, certY + 13, {
      width: dW,
      align: "right",
    })
    .text(`Case: ${caseData.caseNumber}`, dX, certY + 23, {
      width: dW,
      align: "right",
    })
    .restore();
  doc
    .save()
    .font("Helvetica-Bold")
    .fontSize(7)
    .fillColor("#dc2626")
    .text("This document is CONFIDENTIAL", dX, certY + 33, {
      width: dW,
      align: "right",
    })
    .restore();

  doc.y = certY + 52;
  hRule(doc.y);
  doc.y += 14;

  // Signature blocks (4 across)
  const sigW = cW / 4;
  const sigY = doc.y;
  const sigOfficers = [
    { role: "NCO / Station Orderly", officer: caseData.loggedBy },
    { role: "CID Investigator", officer: caseData.assignedOfficer },
    { role: "Station Officer", officer: caseData.assignedSO },
    { role: "District Commander", officer: caseData.assignedDC },
  ];

  sigOfficers.forEach(({ role, officer }, i) => {
    const sx = mL + i * sigW;
    // Signature line
    doc
      .save()
      .moveTo(sx + 4, sigY + 20)
      .lineTo(sx + sigW - 14, sigY + 20)
      .strokeColor("#374151")
      .lineWidth(0.8)
      .stroke()
      .restore();
    bold(
      officer?.fullName || "_______________",
      sx + 4,
      sigY + 24,
      sigW - 18,
      "#1e293b",
      8,
    );
    body(role, sx + 4, sigY + 36, sigW - 18, "#64748b", 7);
    if (officer?.badgeNumber) {
      body(
        `Badge: ${officer.badgeNumber}`,
        sx + 4,
        sigY + 47,
        sigW - 18,
        "#94a3b8",
        7,
      );
    }
    body("Date: _______________", sx + 4, sigY + 58, sigW - 18, "#94a3b8", 7);
  });

  // ── WATERMARK (stamp on every buffered page) ─────────────────────────────────
  doc.flushPages();
  const { start, count } = doc.bufferedPageRange();
  for (let i = start; i < start + count; i++) {
    doc.switchToPage(i);
    doc
      .save()
      .translate(pageW / 2, pageH / 2)
      .rotate(-45)
      .font("Helvetica-Bold")
      .fontSize(68)
      .fillColor("#d1d5db")
      .fillOpacity(0.12)
      .text("CONFIDENTIAL", -190, -34, { width: 380, align: "center" })
      .restore();
  }

  doc.end();

  return new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

// ─── GET /api/cases/[id]/pdf ──────────────────────────────────────────────────
export async function GET(req: NextRequest, { params }: Params) {
  const { user, error } = requireAuth(req);
  if (error) return error;

  const { id } = await params;

  try {
    await connectDB();

    const caseData = await Case.findById(id)
      .populate("loggedBy", "fullName email role badgeNumber")
      .populate("assignedOfficer", "fullName email role badgeNumber")
      .populate("assignedSO", "fullName email role badgeNumber")
      .populate("assignedDC", "fullName email role badgeNumber")
      .populate("caseBookEntries.addedBy", "fullName role badgeNumber")
      .populate("auditLog.performedBy", "fullName role badgeNumber")
      .lean();

    if (!caseData)
      return NextResponse.json({ error: "Case not found" }, { status: 404 });

    const pdfBuffer = await buildPDF(caseData);
    const filename = `CaseBook-${(caseData as any).caseNumber}-${Date.now()}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("PDF generation error:", err);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 },
    );
  }
}

// ─── PUT /api/cases/[id] ──────────────────────────────────────────────────────
export async function PUT(req: NextRequest, { params }: Params) {
  const { user, error } = requireAuth(req);
  if (error) return error;

  const { id } = await params;

  try {
    await connectDB();

    const contentType = req.headers.get("content-type") || "";
    let fields: Record<string, any> = {};
    let uploadedAttachments: {
      url: string;
      publicId: string;
      originalName?: string;
      resourceType?: string;
      format?: string;
      bytes?: number;
    }[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      for (const [key, val] of formData.entries()) {
        if (typeof val === "string") {
          try {
            fields[key] = JSON.parse(val);
          } catch {
            fields[key] = val;
          }
        }
      }
      const files = formData.getAll("attachments") as File[];
      if (files.length > 0)
        uploadedAttachments = await parseAttachments(files, "cases");
    } else {
      fields = await req.json();
    }

    const { action } = fields;
    const caseDoc = await Case.findById(id);
    if (!caseDoc)
      return NextResponse.json({ error: "Case not found" }, { status: 404 });

    if (action === "update") {
      if (!["nco", "so", "admin", "dc"].includes(user.role))
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      const {
        title,
        description,
        category,
        priority,
        location,
        dateOccurred,
        reportedBy,
      } = fields;
      if (title) caseDoc.title = title;
      if (description) caseDoc.description = description;
      if (category) caseDoc.category = category;
      if (priority) caseDoc.priority = priority;
      if (location) caseDoc.location = location;
      if (dateOccurred) caseDoc.dateOccurred = new Date(dateOccurred);
      if (reportedBy)
        caseDoc.reportedBy = {
          ...caseDoc.reportedBy.toObject(),
          ...reportedBy,
        };
      if (uploadedAttachments.length > 0)
        caseDoc.attachments.push(...uploadedAttachments);
      caseDoc.auditLog.push({
        action: "case_updated",
        performedBy: user.userId,
        performedAt: new Date(),
        fromStage: caseDoc.currentStage,
        toStage: caseDoc.currentStage,
        details: `Case updated by ${user.role.toUpperCase()}`,
      });
      await caseDoc.save();
      return NextResponse.json({ case: await populateCase(id) });
    }

    if (action === "add-note") {
      const { content } = fields;
      if (!content?.trim())
        return NextResponse.json(
          { error: "Note content required" },
          { status: 400 },
        );
      caseDoc.notes.push({
        content: content.trim(),
        addedBy: user.userId,
        roleSnapshot: user.role,
        addedAt: new Date(),
        attachments: uploadedAttachments,
      });
      caseDoc.auditLog.push({
        action: "note_added",
        performedBy: user.userId,
        performedAt: new Date(),
        fromStage: caseDoc.currentStage,
        toStage: caseDoc.currentStage,
        details: `Note added by ${user.role.toUpperCase()}`,
      });
      await caseDoc.save();
      return NextResponse.json({ case: await populateCase(id) });
    }

    if (action === "add-casebook-entry") {
      const { content, entryType, stage } = fields;
      if (!content?.trim())
        return NextResponse.json(
          { error: "Entry content required" },
          { status: 400 },
        );
      caseDoc.caseBookEntries.push({
        stage: stage || caseDoc.currentStage,
        entryType: entryType || "remark",
        content: content.trim(),
        addedBy: user.userId,
        roleSnapshot: user.role,
        addedAt: new Date(),
        attachments: uploadedAttachments,
        isEditable: false,
      });
      caseDoc.auditLog.push({
        action: "casebook_entry_added",
        performedBy: user.userId,
        performedAt: new Date(),
        fromStage: caseDoc.currentStage,
        toStage: caseDoc.currentStage,
        details: `Case book entry added by ${user.role.toUpperCase()} (${entryType || "remark"})`,
      });
      await caseDoc.save();
      return NextResponse.json({ case: await populateCase(id) });
    }

    if (action === "send-message") {
      const { thread, content, toRole } = fields;
      if (!content?.trim())
        return NextResponse.json(
          { error: "Message content required" },
          { status: 400 },
        );
      caseDoc.threadMessages.push({
        thread,
        content: content.trim(),
        fromUser: user.userId,
        fromRole: user.role,
        toRole: toRole || null,
        attachments: uploadedAttachments,
        readBy: [user.userId],
        sentAt: new Date(),
      });
      await caseDoc.save();
      return NextResponse.json({ case: await populateCase(id) });
    }

    if (action === "nco-refer") {
      if (!["nco", "so", "admin"].includes(user.role))
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      const { assignedOfficer, ncoReferralNote, note } = fields;
      if (!assignedOfficer)
        return NextResponse.json(
          { error: "CID officer required" },
          { status: 400 },
        );
      if (!ncoReferralNote?.trim())
        return NextResponse.json(
          { error: "Referral note required" },
          { status: 400 },
        );
      caseDoc.assignedOfficer = assignedOfficer;
      caseDoc.ncoReferralNote = ncoReferralNote.trim();
      caseDoc.status = "referred";
      caseDoc.currentStage = "cid";
      caseDoc.referredAt = new Date();
      caseDoc.caseBookEntries.push({
        stage: "nco",
        entryType: "referral",
        content: ncoReferralNote.trim(),
        addedBy: user.userId,
        roleSnapshot: user.role,
        addedAt: new Date(),
        attachments: uploadedAttachments,
        isEditable: false,
      });
      if (note?.trim())
        caseDoc.notes.push({
          content: note.trim(),
          addedBy: user.userId,
          roleSnapshot: user.role,
          addedAt: new Date(),
          attachments: [],
        });
      caseDoc.auditLog.push({
        action: "referred_to_cid",
        performedBy: user.userId,
        performedAt: new Date(),
        fromStage: "nco",
        toStage: "cid",
        details: `Case referred to CID by ${user.role.toUpperCase()}`,
      });
      await caseDoc.save();
      return NextResponse.json({ case: await populateCase(id) });
    }

    if (action === "cid-start") {
      if (user.role !== "cid")
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      const { note } = fields;
      caseDoc.status = "investigating";
      caseDoc.investigationStartedAt = new Date();
      caseDoc.caseBookEntries.push({
        stage: "cid",
        entryType: "investigation_start",
        content: note?.trim() || "Investigation commenced.",
        addedBy: user.userId,
        roleSnapshot: user.role,
        addedAt: new Date(),
        attachments: [],
        isEditable: false,
      });
      caseDoc.auditLog.push({
        action: "investigation_started",
        performedBy: user.userId,
        performedAt: new Date(),
        fromStage: "cid",
        toStage: "cid",
        details: "Investigation started by CID",
      });
      await caseDoc.save();
      return NextResponse.json({ case: await populateCase(id) });
    }

    if (action === "cid-submit") {
      if (user.role !== "cid")
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      const { assignedSO, cidSubmissionNote, note } = fields;
      if (!assignedSO)
        return NextResponse.json(
          { error: "Station Officer required" },
          { status: 400 },
        );
      if (!cidSubmissionNote?.trim())
        return NextResponse.json(
          { error: "Findings note required" },
          { status: 400 },
        );
      caseDoc.assignedSO = assignedSO;
      caseDoc.cidSubmissionNote = cidSubmissionNote.trim();
      caseDoc.status = "under_review";
      caseDoc.currentStage = "so";
      caseDoc.submittedForReviewAt = new Date();
      caseDoc.soDirective = "";
      caseDoc.caseBookEntries.push({
        stage: "cid",
        entryType: "findings",
        content: cidSubmissionNote.trim(),
        addedBy: user.userId,
        roleSnapshot: user.role,
        addedAt: new Date(),
        attachments: uploadedAttachments,
        isEditable: false,
      });
      if (note?.trim())
        caseDoc.notes.push({
          content: note.trim(),
          addedBy: user.userId,
          roleSnapshot: user.role,
          addedAt: new Date(),
          attachments: [],
        });
      caseDoc.auditLog.push({
        action: "submitted_to_so",
        performedBy: user.userId,
        performedAt: new Date(),
        fromStage: "cid",
        toStage: "so",
        details: "Case submitted to Station Officer by CID",
      });
      await caseDoc.save();
      return NextResponse.json({ case: await populateCase(id) });
    }

    if (action === "so-review") {
      if (!["so", "admin"].includes(user.role))
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      const { soReviewNote } = fields;
      if (!soReviewNote?.trim())
        return NextResponse.json(
          { error: "Review note required" },
          { status: 400 },
        );
      caseDoc.soReviewNote = soReviewNote.trim();
      caseDoc.soReviewedAt = new Date();
      caseDoc.caseBookEntries.push({
        stage: "so",
        entryType: "review",
        content: soReviewNote.trim(),
        addedBy: user.userId,
        roleSnapshot: user.role,
        addedAt: new Date(),
        attachments: uploadedAttachments,
        isEditable: false,
      });
      caseDoc.auditLog.push({
        action: "case_updated",
        performedBy: user.userId,
        performedAt: new Date(),
        fromStage: "so",
        toStage: "so",
        details: "Case reviewed by Station Officer",
      });
      await caseDoc.save();
      return NextResponse.json({ case: await populateCase(id) });
    }

    if (action === "so-return") {
      if (!["so", "admin"].includes(user.role))
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      const { soDirective } = fields;
      if (!soDirective?.trim())
        return NextResponse.json(
          { error: "Directive required" },
          { status: 400 },
        );
      caseDoc.soDirective = soDirective.trim();
      caseDoc.status = "investigating";
      caseDoc.currentStage = "cid";
      caseDoc.caseBookEntries.push({
        stage: "so",
        entryType: "directive",
        content: soDirective.trim(),
        addedBy: user.userId,
        roleSnapshot: user.role,
        addedAt: new Date(),
        attachments: [],
        isEditable: false,
      });
      caseDoc.auditLog.push({
        action: "returned_to_cid",
        performedBy: user.userId,
        performedAt: new Date(),
        fromStage: "so",
        toStage: "cid",
        details: "Case returned to CID with directive by SO",
      });
      await caseDoc.save();
      return NextResponse.json({ case: await populateCase(id) });
    }

    if (action === "so-forward") {
      if (!["so", "admin"].includes(user.role))
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      const { assignedDC, soForwardNote } = fields;
      if (!assignedDC)
        return NextResponse.json(
          { error: "District Commander required" },
          { status: 400 },
        );
      if (!soForwardNote?.trim())
        return NextResponse.json(
          { error: "Forward note required" },
          { status: 400 },
        );
      caseDoc.assignedDC = assignedDC;
      caseDoc.soReviewNote = soForwardNote.trim();
      caseDoc.status = "commander_review";
      caseDoc.currentStage = "dc";
      caseDoc.soReviewedAt = new Date();
      caseDoc.caseBookEntries.push({
        stage: "so",
        entryType: "review",
        content: soForwardNote.trim(),
        addedBy: user.userId,
        roleSnapshot: user.role,
        addedAt: new Date(),
        attachments: uploadedAttachments,
        isEditable: false,
      });
      caseDoc.auditLog.push({
        action: "forwarded_to_dc",
        performedBy: user.userId,
        performedAt: new Date(),
        fromStage: "so",
        toStage: "dc",
        details: "Case forwarded to District Commander by SO",
      });
      await caseDoc.save();
      return NextResponse.json({ case: await populateCase(id) });
    }

    // ── DC returns the case back down to the Station Officer with a directive ──
    // This keeps the case in the recurrent loop (DC ⇄ SO ⇄ CID) instead of
    // closing it. The case only closes when the DC issues a final decision.
    if (action === "dc-return") {
      if (!["dc", "admin"].includes(user.role))
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      const { dcReturnNote } = fields;
      if (!dcReturnNote?.trim())
        return NextResponse.json(
          { error: "Directive note required" },
          { status: 400 },
        );
      if (!caseDoc.assignedSO)
        return NextResponse.json(
          { error: "No Station Officer is assigned to receive this case" },
          { status: 400 },
        );
      caseDoc.dcNote = dcReturnNote.trim();
      caseDoc.dcReviewedAt = new Date();
      caseDoc.status = "under_review";
      caseDoc.currentStage = "so";
      caseDoc.caseBookEntries.push({
        stage: "dc",
        entryType: "directive",
        content: dcReturnNote.trim(),
        addedBy: user.userId,
        roleSnapshot: user.role,
        addedAt: new Date(),
        attachments: uploadedAttachments,
        isEditable: false,
      });
      caseDoc.auditLog.push({
        action: "returned_to_so",
        performedBy: user.userId,
        performedAt: new Date(),
        fromStage: "dc",
        toStage: "so",
        details: "Case returned to Station Officer with directive by DC",
      });
      await caseDoc.save();
      return NextResponse.json({ case: await populateCase(id) });
    }

    // ── DC issues the FINAL decision — this is the only path that closes a case ─
    if (action === "dc-decide") {
      if (!["dc", "admin"].includes(user.role))
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      const { dcNote, outcome } = fields;
      if (!dcNote?.trim())
        return NextResponse.json(
          { error: "Decision note required" },
          { status: 400 },
        );
      if (!["closed", "suspended"].includes(outcome))
        return NextResponse.json(
          {
            error:
              "Final outcome required: closed | suspended. To send the case back for more work, use the Return to Station Officer action.",
          },
          { status: 400 },
        );
      caseDoc.dcNote = dcNote.trim();
      caseDoc.dcReviewedAt = new Date();
      caseDoc.status = outcome;
      if (outcome === "closed") caseDoc.closedAt = new Date();
      caseDoc.caseBookEntries.push({
        stage: "dc",
        entryType: "decision",
        content: dcNote.trim(),
        addedBy: user.userId,
        roleSnapshot: user.role,
        addedAt: new Date(),
        attachments: uploadedAttachments,
        isEditable: false,
      });
      caseDoc.auditLog.push({
        action: outcome === "closed" ? "case_closed" : "case_suspended",
        performedBy: user.userId,
        performedAt: new Date(),
        fromStage: "dc",
        toStage: "dc",
        details: `Case ${outcome} by District Commander`,
      });
      await caseDoc.save();
      return NextResponse.json({ case: await populateCase(id) });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}` },
      { status: 400 },
    );
  } catch (err) {
    console.error("PUT /cases/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to update case" },
      { status: 500 },
    );
  }
}

// ─── DELETE /api/cases/[id] ───────────────────────────────────────────────────
export async function DELETE(req: NextRequest, { params }: Params) {
  const { user, error } = requireAuth(req);
  if (error) return error;

  const { id } = await params;

  try {
    await connectDB();

    const caseDoc = await Case.findById(id);
    if (!caseDoc)
      return NextResponse.json({ error: "Case not found" }, { status: 404 });

    if (!["admin", "dc", "nco", "so"].includes(user.role))
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    await Case.findByIdAndDelete(id);
    return NextResponse.json(
      { message: "Case deleted successfully" },
      { status: 200 },
    );
  } catch (err) {
    console.error("DELETE /cases/[id] error:", err);
    return NextResponse.json(
      { error: "Failed to delete case" },
      { status: 500 },
    );
  }
}
