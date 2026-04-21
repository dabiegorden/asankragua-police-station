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
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function fmtDate(d?: Date | string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function cap(s?: string): string {
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Extract the display name from an officer field.
 * Works whether the field is:
 *  - a populated object  { fullName, badgeNumber, ... }
 *  - a lean plain object
 *  - still an ObjectId   (population failed)
 *  - null / undefined
 */
function officerName(o: any): string {
  if (!o) return "—";
  // Populated object (or lean object with fullName)
  if (typeof o === "object" && o.fullName) {
    const badge = o.badgeNumber ? ` (${o.badgeNumber})` : "";
    return `${o.fullName}${badge}`;
  }
  // Fallback: it's an un-populated ObjectId-like value
  return "—";
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
  return m[s] || s || "—";
}

function priorityColor(p: string): string {
  return p === "Felony"
    ? "#dc2626"
    : p === "Misdemeanour"
      ? "#ca8a04"
      : "#374151";
}

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
      Title: `Case Book — ${caseData.caseNumber || "N/A"}`,
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
  const cW = pageW - mL - 40; // 515.28

  // ── Drawing primitives ──────────────────────────────────────────────────────

  function filledRect(
    x: number,
    y: number,
    w: number,
    h: number,
    fill: string,
    r = 0,
  ) {
    doc.save().roundedRect(x, y, w, h, Math.max(r, 0)).fill(fill).restore();
  }

  function strokedRect(
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

  function hLine(y: number, color = "#e2e8f0", lw = 0.5) {
    doc
      .save()
      .moveTo(mL, y)
      .lineTo(mL + cW, y)
      .strokeColor(color)
      .lineWidth(lw)
      .stroke()
      .restore();
  }

  function need(h: number) {
    if (doc.y + h > pageH - 70) {
      doc.addPage();
      stampHeaderFooter();
    }
  }

  function labelText(text: string, x: number, y: number, w = 120) {
    doc
      .save()
      .font("Helvetica-Bold")
      .fontSize(6.5)
      .fillColor("#64748b")
      .text((text || "").toUpperCase(), x, y, {
        width: w,
        characterSpacing: 0.6,
      })
      .restore();
  }

  function bodyText(
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
      .text(text || "—", x, y, { width: w, lineGap: 1.5 })
      .restore();
  }

  function boldText(
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
      .text(text || "—", x, y, { width: w })
      .restore();
  }

  function sectionBand(title: string, color = "#1e3a8a") {
    need(34);
    const y = doc.y + 8;
    filledRect(mL, y, cW, 22, color, 3);
    doc
      .save()
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor("#ffffff")
      .text((title || "").toUpperCase(), mL + 10, y + 7, {
        width: cW - 20,
        characterSpacing: 1.2,
      })
      .restore();
    doc.y = y + 30;
  }

  function stampHeaderFooter() {
    const savedY = doc.y;
    doc
      .save()
      .font("Helvetica")
      .fontSize(7)
      .fillColor("#94a3b8")
      .text("GHANA POLICE SERVICE — DIGITAL CASE BOOK", mL, 22, {
        width: cW / 2,
      })
      .text(caseData.caseNumber || "", mL + cW / 2, 22, {
        width: cW / 2,
        align: "right",
      })
      .restore();
    const fY = pageH - 34;
    doc
      .save()
      .font("Helvetica-Oblique")
      .fontSize(7)
      .fillColor("#94a3b8")
      .text("CONFIDENTIAL — FOR OFFICIAL USE ONLY", mL, fY, { width: cW / 2 })
      .font("Helvetica")
      .text(
        `Generated by Digital Case Book System · ${new Date().toLocaleDateString("en-GB")}`,
        mL + cW / 2,
        fY,
        { width: cW / 2, align: "right" },
      )
      .restore();
    doc.y = savedY;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // PAGE 1 — COVER HEADER
  // ────────────────────────────────────────────────────────────────────────────
  filledRect(mL, 56, cW, 80, "#1e3a8a", 6);
  doc
    .save()
    .font("Helvetica-Bold")
    .fontSize(20)
    .fillColor("#ffffff")
    .text("GHANA POLICE SERVICE", mL, 74, { width: cW, align: "center" })
    .restore();
  doc
    .save()
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#bfdbfe")
    .text("DIGITAL CASE BOOK — OFFICIAL RECORD", mL, 104, {
      width: cW,
      align: "center",
      characterSpacing: 1.4,
    })
    .restore();
  doc
    .save()
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor("#93c5fd")
    .text(`Generated: ${fmt(new Date())}`, mL, 122, {
      width: cW,
      align: "center",
    })
    .restore();
  doc.y = 154;
  stampHeaderFooter();

  // ────────────────────────────────────────────────────────────────────────────
  // CASE IDENTITY BOX
  // ────────────────────────────────────────────────────────────────────────────
  const idY = doc.y;
  const idH = 110;
  filledRect(mL, idY, cW, idH, "#f8fafc", 4);
  strokedRect(mL, idY, cW, idH, "#cbd5e1", 1);

  labelText("Case Number", mL + 12, idY + 10);
  boldText(
    caseData.caseNumber || "N/A",
    mL + 12,
    idY + 20,
    cW - 180,
    "#1e3a8a",
    22,
  );
  boldText(
    caseData.title || "(No title)",
    mL + 12,
    idY + 54,
    cW - 180,
    "#0f172a",
    11,
  );
  bodyText(
    caseData.description || "(No description)",
    mL + 12,
    idY + 70,
    cW - 180,
    "#475569",
    8.5,
  );

  const rX = mL + cW - 160;
  labelText("Status", rX, idY + 10, 155);
  boldText(statusLabel(caseData.status), rX, idY + 21, 155, "#1e3a8a", 10);
  labelText("Priority", rX, idY + 46, 155);
  boldText(
    caseData.priority || "—",
    rX,
    idY + 57,
    155,
    priorityColor(caseData.priority),
    10,
  );
  labelText("Current Stage", rX, idY + 78, 155);
  boldText(
    ROLE_LABELS[caseData.currentStage] || caseData.currentStage || "—",
    rX,
    idY + 89,
    155,
    "#374151",
    8,
  );

  doc.y = idY + idH + 10;

  // ────────────────────────────────────────────────────────────────────────────
  // KEY DETAILS GRID
  // ────────────────────────────────────────────────────────────────────────────
  const gridRows: [string, string][][] = [
    [
      ["Category", cap(caseData.category)],
      ["Location", caseData.location || "—"],
      ["Date Occurred", fmtDate(caseData.dateOccurred)],
      ["Date Reported", fmtDate(caseData.dateReported)],
    ],
    [
      [
        "Reporter",
        `${caseData.reportedBy?.name || "—"}${caseData.reportedBy?.phone ? "\n" + caseData.reportedBy.phone : ""}`,
      ],
      ["Reporter Email", caseData.reportedBy?.email || "—"],
      ["Reporter Address", caseData.reportedBy?.address || "—"],
      ["Logged By (NCO)", officerName(caseData.loggedBy)],
    ],
    [
      ["CID Investigator", officerName(caseData.assignedOfficer)],
      ["Station Officer", officerName(caseData.assignedSO)],
      ["District Commander", officerName(caseData.assignedDC)],
      ["Case Number", caseData.caseNumber || "—"],
    ],
  ];

  const colW4 = cW / 4;
  gridRows.forEach((row, ri) => {
    const rH = 44;
    need(rH + 2);
    const rY = doc.y;
    filledRect(mL, rY, cW, rH, ri % 2 === 0 ? "#f8fafc" : "#ffffff");
    strokedRect(mL, rY, cW, rH, "#e2e8f0", 0.5);
    row.forEach(([label, value], ci) => {
      const cx = mL + ci * colW4 + 6;
      labelText(label, cx, rY + 6, colW4 - 10);
      bodyText(value || "—", cx, rY + 18, colW4 - 12, "#1e293b", 8);
    });
    doc.y = rY + rH;
  });
  doc.y += 6;

  // ────────────────────────────────────────────────────────────────────────────
  // WORKFLOW TIMELINE
  // ────────────────────────────────────────────────────────────────────────────
  sectionBand("Case Workflow Progress");
  need(70);
  const tlY = doc.y;
  const colWt = cW / 4;
  const curIdx = STAGE_ORDER.indexOf(caseData.currentStage);

  STAGE_ORDER.forEach((stage, idx) => {
    const pal = STAGE_COLORS[stage];
    const cx = mL + idx * colWt + colWt / 2;
    const isPast = idx < curIdx;
    const isCur = idx === curIdx;
    const circleColor = isCur ? pal.header : isPast ? "#475569" : "#cbd5e1";
    const labelColor = isCur ? pal.header : isPast ? "#475569" : "#94a3b8";
    const statusColor = isCur ? pal.accent : isPast ? "#16a34a" : "#cbd5e1";
    const statusText = isCur ? "CURRENT" : isPast ? "DONE" : "PENDING";

    if (idx < 3) {
      doc
        .save()
        .moveTo(cx + 16, tlY + 16)
        .lineTo(cx + colWt - 16, tlY + 16)
        .strokeColor(isPast ? "#475569" : "#e2e8f0")
        .lineWidth(2)
        .stroke()
        .restore();
    }
    doc
      .save()
      .circle(cx, tlY + 16, 14)
      .fill(circleColor)
      .restore();
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
    doc
      .save()
      .font("Helvetica-Bold")
      .fontSize(7)
      .fillColor(labelColor)
      .text(ROLE_LABELS[stage] || stage, cx - colWt / 2 + 4, tlY + 34, {
        width: colWt - 8,
        align: "center",
      })
      .restore();
    doc
      .save()
      .font("Helvetica-Bold")
      .fontSize(6.5)
      .fillColor(statusColor)
      .text(statusText, cx - colWt / 2 + 4, tlY + 46, {
        width: colWt - 8,
        align: "center",
      })
      .restore();
  });
  doc.y = tlY + 64;

  // ────────────────────────────────────────────────────────────────────────────
  // DIGITAL CASE BOOK ENTRIES — NCO → CID → SO → DC
  // ────────────────────────────────────────────────────────────────────────────
  sectionBand("Digital Case Book — Officer Entries");

  const grouped: Record<string, any[]> = { nco: [], cid: [], so: [], dc: [] };
  const allEntries: any[] = Array.isArray(caseData.caseBookEntries)
    ? caseData.caseBookEntries
    : [];

  allEntries.forEach((e: any) => {
    const stage = e?.stage || "nco";
    if (grouped[stage]) grouped[stage].push(e);
  });

  for (const stage of STAGE_ORDER) {
    const entries = grouped[stage] || [];
    const pal = STAGE_COLORS[stage];
    const stageLbl = ROLE_LABELS[stage] || stage.toUpperCase();
    const countTxt = entries.length
      ? `${entries.length} entr${entries.length === 1 ? "y" : "ies"}`
      : "No entries recorded";

    need(38);
    const shY = doc.y + 6;
    filledRect(mL, shY, cW, 24, pal.header, 3);
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
    doc.y = shY + 32;

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
      doc.y += 14;
      continue;
    }

    for (const entry of entries) {
      const typeLabel =
        ENTRY_TYPE_LABELS[entry.entryType] || entry.entryType || "Remark";

      // ── Resolve officer name from addedBy ─────────────────────────────────
      // After .lean() + .populate(), entry.addedBy is a plain JS object with fullName.
      // We check both patterns defensively.
      const addedByObj = entry.addedBy;
      let oName = "Unknown Officer";
      let badgeStr = "";
      if (addedByObj && typeof addedByObj === "object" && addedByObj.fullName) {
        oName = addedByObj.fullName;
        badgeStr = addedByObj.badgeNumber
          ? ` · Badge: ${addedByObj.badgeNumber}`
          : "";
      }
      const oRole =
        ROLE_LABELS[entry.roleSnapshot] || entry.roleSnapshot || stage;
      const content = (entry.content || "").trim() || "(No content)";
      const addedAt = entry.addedAt || entry.createdAt;

      const estimatedLines = Math.ceil(content.length / 78) + 2;
      const boxH = Math.max(80, estimatedLines * 13 + 58);

      need(boxH + 14);
      const eY = doc.y + 4;

      filledRect(mL, eY, cW, boxH, pal.light, 4);
      strokedRect(mL, eY, cW, boxH, pal.accent, 1.5);
      filledRect(mL, eY, 5, boxH, pal.header, 2); // left accent bar

      // Entry type pill
      filledRect(mL + 14, eY + 9, 110, 16, pal.accent, 3);
      doc
        .save()
        .font("Helvetica-Bold")
        .fontSize(7)
        .fillColor("#ffffff")
        .text(typeLabel.toUpperCase(), mL + 16, eY + 12, {
          width: 106,
          characterSpacing: 0.3,
        })
        .restore();

      // Officer name + role
      boldText(
        `${oName}  (${oRole})${badgeStr}`,
        mL + 132,
        eY + 10,
        cW - 270,
        pal.header,
        8.5,
      );

      // Timestamp
      doc
        .save()
        .font("Helvetica")
        .fontSize(7.5)
        .fillColor("#64748b")
        .text(fmt(addedAt), mL + cW - 130, eY + 10, {
          width: 120,
          align: "right",
        })
        .restore();

      // Divider — use a plain solid color, NOT hex+opacity string concatenation
      hLine(eY + 30, pal.accent, 0.5);

      // Entry content
      doc
        .save()
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#1e293b")
        .text(content, mL + 14, eY + 36, { width: cW - 28, lineGap: 2.5 })
        .restore();

      // Locked notice
      doc
        .save()
        .font("Helvetica-Oblique")
        .fontSize(7)
        .fillColor("#94a3b8")
        .text(
          "Entry locked — immutable after submission",
          mL + 14,
          eY + boxH - 13,
          { width: cW - 28 },
        )
        .restore();

      doc.y = eY + boxH + 8;
    }

    doc.y += 4;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // OFFICIAL HANDOFF NOTES
  // ────────────────────────────────────────────────────────────────────────────
  const handoffs = [
    {
      label: "NCO Referral Note",
      val: caseData.ncoReferralNote,
      color: "#1d4ed8",
    },
    {
      label: "CID Submission / Findings",
      val: caseData.cidSubmissionNote,
      color: "#4338ca",
    },
    {
      label: "Station Officer Review Note",
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
      const tLines = Math.ceil((hn.val || "").length / 88) + 1;
      const boxH = Math.max(52, tLines * 12 + 30);
      need(boxH + 14);

      const hnY = doc.y + 4;
      filledRect(mL, hnY, cW, boxH, "#f8fafc", 3);
      strokedRect(mL, hnY, cW, boxH, "#e2e8f0", 1);
      filledRect(mL, hnY, 5, boxH, hn.color, 2);

      boldText(hn.label.toUpperCase(), mL + 14, hnY + 10, cW - 24, hn.color, 8);
      bodyText(hn.val || "", mL + 14, hnY + 26, cW - 28, "#334155", 9);

      doc.y = hnY + boxH + 8;
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // INTERNAL NOTES
  // ────────────────────────────────────────────────────────────────────────────
  const notes: any[] = Array.isArray(caseData.notes) ? caseData.notes : [];
  if (notes.length) {
    sectionBand("Internal Notes", "#374151");

    for (const note of notes) {
      const noteByObj = note.addedBy;
      let noteName = "Unknown Officer";
      if (noteByObj && typeof noteByObj === "object" && noteByObj.fullName) {
        noteName = noteByObj.fullName;
      }
      const noteRole =
        ROLE_LABELS[note.roleSnapshot] || note.roleSnapshot || "—";
      const noteContent = (note.content || "").trim() || "(No content)";
      const lines = Math.ceil(noteContent.length / 78) + 1;
      const boxH = Math.max(50, lines * 13 + 28);

      need(boxH + 10);
      const nY = doc.y + 4;
      filledRect(mL, nY, cW, boxH, "#f8fafc", 3);
      strokedRect(mL, nY, cW, boxH, "#e2e8f0", 1);
      filledRect(mL, nY, 5, boxH, "#64748b", 2);

      boldText(
        `${noteName}  (${noteRole})`,
        mL + 14,
        nY + 10,
        cW * 0.6,
        "#374151",
        8.5,
      );
      doc
        .save()
        .font("Helvetica")
        .fontSize(7.5)
        .fillColor("#64748b")
        .text(fmt(note.addedAt), mL + cW - 130, nY + 10, {
          width: 120,
          align: "right",
        })
        .restore();
      bodyText(noteContent, mL + 14, nY + 26, cW - 28, "#334155", 9);

      doc.y = nY + boxH + 6;
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // SUSPECTS & WITNESSES
  // ────────────────────────────────────────────────────────────────────────────
  const suspects = Array.isArray(caseData.suspects) ? caseData.suspects : [];
  const witnesses = Array.isArray(caseData.witnesses) ? caseData.witnesses : [];

  if (suspects.length || witnesses.length) {
    sectionBand("Parties Involved", "#374151");

    function drawTable(
      items: any[],
      headers: string[],
      widths: number[],
      rowFn: (item: any) => string[],
    ) {
      need(30);
      const hY = doc.y;
      filledRect(mL, hY, cW, 22, "#374151");
      let xPos = mL;
      headers.forEach((h, i) => {
        doc
          .save()
          .font("Helvetica-Bold")
          .fontSize(8)
          .fillColor("#ffffff")
          .text(h, xPos + 5, hY + 7, { width: widths[i] - 10 })
          .restore();
        xPos += widths[i];
      });
      doc.y = hY + 24;
      items.forEach((item, ri) => {
        const cells = rowFn(item);
        const maxLen = Math.max(...cells.map((c) => (c || "").length));
        const rowH = Math.max(24, Math.ceil(maxLen / 36) * 11 + 14);
        need(rowH + 2);
        const rY = doc.y;
        filledRect(mL, rY, cW, rowH, ri % 2 === 0 ? "#f8fafc" : "#ffffff");
        strokedRect(mL, rY, cW, rowH, "#e2e8f0", 0.5);
        let cx = mL;
        cells.forEach((cell, i) => {
          bodyText(cell || "—", cx + 5, rY + 7, widths[i] - 10, "#334155", 8);
          cx += widths[i];
        });
        doc.y = rY + rowH;
      });
      doc.y += 8;
    }

    if (suspects.length) {
      need(26);
      doc
        .save()
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor("#dc2626")
        .text("SUSPECTS", mL, doc.y, { characterSpacing: 1 })
        .restore();
      doc.y += 6;
      drawTable(
        suspects,
        ["NAME", "AGE", "DESCRIPTION", "ADDRESS"],
        [cW * 0.25, cW * 0.1, cW * 0.35, cW * 0.3],
        (s: any) => [
          s.name || "—",
          s.age ? String(s.age) : "—",
          s.description || "—",
          s.address || "—",
        ],
      );
    }

    if (witnesses.length) {
      need(26);
      doc
        .save()
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor("#16a34a")
        .text("WITNESSES", mL, doc.y, { characterSpacing: 1 })
        .restore();
      doc.y += 6;
      drawTable(
        witnesses,
        ["NAME", "PHONE", "STATEMENT"],
        [cW * 0.25, cW * 0.2, cW * 0.55],
        (w: any) => [w.name || "—", w.phone || "—", w.statement || "—"],
      );
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // AUDIT TRAIL
  // ────────────────────────────────────────────────────────────────────────────
  const auditLog: any[] = Array.isArray(caseData.auditLog)
    ? caseData.auditLog
    : [];

  if (auditLog.length) {
    sectionBand("Audit Trail", "#374151");

    const aW = [cW * 0.22, cW * 0.34, cW * 0.24, cW * 0.2];
    const aHeaders = [
      "DATE & TIME",
      "ACTION / DETAILS",
      "PERFORMED BY",
      "STAGE TRANSITION",
    ];

    need(28);
    const ahY = doc.y;
    filledRect(mL, ahY, cW, 22, "#1e3a8a");
    let axPos = mL;
    aHeaders.forEach((h, i) => {
      doc
        .save()
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor("#ffffff")
        .text(h, axPos + 5, ahY + 7, { width: aW[i] - 10 })
        .restore();
      axPos += aW[i];
    });
    doc.y = ahY + 24;

    auditLog.forEach((e: any, i: number) => {
      // Resolve performedBy the same safe way
      const pbObj = e.performedBy;
      const officerStr =
        pbObj && typeof pbObj === "object" && pbObj.fullName
          ? pbObj.fullName
          : "System";

      const transition =
        e.fromStage && e.toStage && e.fromStage !== e.toStage
          ? `${(e.fromStage || "").toUpperCase()} → ${(e.toStage || "").toUpperCase()}`
          : e.fromStage
            ? (e.fromStage || "").toUpperCase()
            : "—";

      const actionLabel = (e.details || e.action || "")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c: string) => c.toUpperCase());

      const cells = [fmt(e.performedAt), actionLabel, officerStr, transition];
      const maxLen = Math.max(...cells.map((c) => (c || "").length));
      const rowH = Math.max(22, Math.ceil(maxLen / 36) * 11 + 10);

      need(rowH + 2);
      const rY = doc.y;
      filledRect(mL, rY, cW, rowH, i % 2 === 0 ? "#f8fafc" : "#ffffff");
      strokedRect(mL, rY, cW, rowH, "#e2e8f0", 0.5);
      let cx = mL;
      cells.forEach((cell, ci) => {
        bodyText(cell, cx + 5, rY + 6, aW[ci] - 10, "#334155", 8);
        cx += aW[ci];
      });
      doc.y = rY + rowH;
    });
    doc.y += 8;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // CASE TIMELINE
  // ────────────────────────────────────────────────────────────────────────────
  const timestamps = [
    { label: "Case Reported", val: caseData.dateReported },
    { label: "Referred to CID", val: caseData.referredAt },
    { label: "Investigation Started", val: caseData.investigationStartedAt },
    { label: "Submitted for Review", val: caseData.submittedForReviewAt },
    { label: "SO Reviewed", val: caseData.soReviewedAt },
    { label: "DC Reviewed", val: caseData.dcReviewedAt },
    { label: "Case Closed", val: caseData.closedAt },
  ].filter((t) => t.val);

  if (timestamps.length >= 1) {
    sectionBand("Case Timeline", "#374151");

    timestamps.forEach((t, i) => {
      const tH = 22;
      need(tH + 2);
      const tY = doc.y;
      filledRect(mL, tY, cW, tH, i % 2 === 0 ? "#f8fafc" : "#ffffff");
      strokedRect(mL, tY, cW, tH, "#e2e8f0", 0.5);
      doc
        .save()
        .circle(mL + 14, tY + 11, 4)
        .fill(
          i === 0
            ? "#1e40af"
            : i === timestamps.length - 1
              ? "#16a34a"
              : "#64748b",
        )
        .restore();
      boldText(t.label, mL + 26, tY + 6, cW * 0.38, "#374151", 9);
      bodyText(
        fmt(t.val as string),
        mL + cW * 0.4,
        tY + 6,
        cW * 0.58,
        "#475569",
        9,
      );
      doc.y = tY + tH;
    });
    doc.y += 10;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // CERTIFICATION + SIGNATURE BLOCK
  // ────────────────────────────────────────────────────────────────────────────
  need(170);
  doc.y += 14;
  hLine(doc.y, "#cbd5e1", 1);
  doc.y += 10;

  const certY = doc.y;

  boldText("CERTIFICATION OF AUTHENTICITY", mL, certY, cW * 0.55, "#374151", 8);
  bodyText(
    "This is a certified digital copy of the official case record generated by the Ghana Police Service Digital Case Book System. This document is an accurate representation of all entries made by authorised officers.",
    mL,
    certY + 14,
    cW * 0.55,
    "#64748b",
    7.5,
  );

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
    .fontSize(7.5)
    .fillColor("#64748b")
    .text(`Generated: ${fmt(new Date())}`, dX, certY + 14, {
      width: dW,
      align: "right",
    })
    .text(`Case Number: ${caseData.caseNumber || "N/A"}`, dX, certY + 25, {
      width: dW,
      align: "right",
    })
    .text(`Status: ${statusLabel(caseData.status)}`, dX, certY + 36, {
      width: dW,
      align: "right",
    })
    .restore();
  doc
    .save()
    .font("Helvetica-Bold")
    .fontSize(7)
    .fillColor("#dc2626")
    .text("CONFIDENTIAL — FOR OFFICIAL USE ONLY", dX, certY + 48, {
      width: dW,
      align: "right",
    })
    .restore();

  doc.y = certY + 66;
  hLine(doc.y);
  doc.y += 16;

  // Signature blocks
  need(80);
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
    const oObj =
      officer && typeof officer === "object" && officer.fullName
        ? officer
        : null;
    doc
      .save()
      .moveTo(sx + 4, sigY + 22)
      .lineTo(sx + sigW - 12, sigY + 22)
      .strokeColor("#374151")
      .lineWidth(0.8)
      .stroke()
      .restore();
    boldText(
      oObj?.fullName || "_______________",
      sx + 4,
      sigY + 26,
      sigW - 16,
      "#1e293b",
      8,
    );
    bodyText(role, sx + 4, sigY + 38, sigW - 16, "#64748b", 7);
    if (oObj?.badgeNumber) {
      bodyText(
        `Badge: ${oObj.badgeNumber}`,
        sx + 4,
        sigY + 49,
        sigW - 16,
        "#94a3b8",
        7,
      );
    }
    bodyText(
      "Date: _______________",
      sx + 4,
      sigY + 60,
      sigW - 16,
      "#94a3b8",
      7,
    );
  });

  // ────────────────────────────────────────────────────────────────────────────
  // WATERMARK — stamp every buffered page
  // ────────────────────────────────────────────────────────────────────────────
  doc.flushPages();
  const { start, count } = doc.bufferedPageRange();
  for (let pi = start; pi < start + count; pi++) {
    doc.switchToPage(pi);
    doc
      .save()
      .translate(pageW / 2, pageH / 2)
      .rotate(-45)
      .font("Helvetica-Bold")
      .fontSize(64)
      .fillColor("#9ca3af")
      .fillOpacity(0.07)
      .text("CONFIDENTIAL", -185, -32, { width: 370, align: "center" })
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

    // Use .lean() with full population so every sub-document addedBy / performedBy
    // is resolved to a plain JS object containing { fullName, badgeNumber, role }.
    const caseData = await Case.findById(id)
      .populate("loggedBy", "fullName email role badgeNumber")
      .populate("assignedOfficer", "fullName email role badgeNumber")
      .populate("assignedSO", "fullName email role badgeNumber")
      .populate("assignedDC", "fullName email role badgeNumber")
      .populate("caseBookEntries.addedBy", "fullName role badgeNumber")
      .populate("auditLog.performedBy", "fullName role badgeNumber")
      .populate("notes.addedBy", "fullName role badgeNumber")
      .lean(); // ← lean() gives plain JS objects; populated refs are plain objects too

    if (!caseData) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

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
    console.error("[PDF] generation error:", err);
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

    if (action === "dc-decide") {
      if (!["dc", "admin"].includes(user.role))
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      const { dcNote, outcome } = fields;
      if (!dcNote?.trim())
        return NextResponse.json(
          { error: "Decision note required" },
          { status: 400 },
        );
      if (!["closed", "suspended", "investigating"].includes(outcome))
        return NextResponse.json(
          {
            error: "Valid outcome required: closed | suspended | investigating",
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
        action:
          outcome === "closed"
            ? "case_closed"
            : outcome === "suspended"
              ? "case_suspended"
              : "case_updated",
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
