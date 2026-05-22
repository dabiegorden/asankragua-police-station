// src/app/api/cases/[id]/pdf/route.ts
// Digital Case Book — PDF Export (GET) + Case Update (PUT) + Delete (DELETE)
// PDF generation uses pdfkit only. No pdfmake, no jsPDF.

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Case from "@/models/Case";
import { requireAuth } from "@/middleware/auth";
import { parseAttachments } from "@/lib/parseAttachments";
import { populateCase } from "@/app/api/cases/route";
import path from "path";
import fs from "fs";

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

function officerName(o: any): string {
  if (!o) return "—";
  if (typeof o === "object" && o.fullName) {
    return `${o.fullName}${o.badgeNumber ? ` (${o.badgeNumber})` : ""}`;
  }
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

  // ── Page constants ────────────────────────────────────────────────────────
  const PAGE_W = 595.28; // A4 width  (pt)
  const PAGE_H = 841.89; // A4 height (pt)
  const ML = 40; // left margin
  const MR = 40; // right margin
  const MT = 40; // top margin (content starts here on page 1)
  const MB = 50; // bottom margin / footer zone
  const CW = PAGE_W - ML - MR; // 515.28
  const FOOTER_Y = PAGE_H - MB; // content must stay above this

  const doc = new PDFDocument({
    size: "A4",
    // We manage margins manually so pdfkit doesn't auto-add page padding.
    margins: { top: MT, bottom: MB, left: ML, right: MR },
    bufferPages: true, // needed for watermark pass at the end
    info: {
      Title: `Case Book — ${caseData.caseNumber || "N/A"}`,
      Author: "Ghana Police Service",
      Subject: "Digital Case Book Official Record",
      Creator: "Digital Case Book System",
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  // ── Logo (optional — if the file is missing we skip gracefully) ───────────
  let logoBuffer: Buffer | null = null;
  try {
    const logoPath = path.join(
      process.cwd(),
      "public",
      "assets",
      "officer.jpg",
    );
    if (fs.existsSync(logoPath)) logoBuffer = fs.readFileSync(logoPath);
  } catch {
    /* logo optional */
  }

  // ── Drawing primitives ────────────────────────────────────────────────────

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
      .moveTo(ML, y)
      .lineTo(ML + CW, y)
      .strokeColor(color)
      .lineWidth(lw)
      .stroke()
      .restore();
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

  // ── Running header / footer stamped on every page ─────────────────────────
  // Call after addPage() to stamp header/footer, then reset doc.y to the
  // top content area (MT).
  function stampPage() {
    // Running header (top strip)
    doc
      .save()
      .font("Helvetica")
      .fontSize(7)
      .fillColor("#94a3b8")
      .text("GHANA POLICE SERVICE — DIGITAL CASE BOOK", ML, 18, {
        width: CW / 2,
      })
      .text(caseData.caseNumber || "", ML + CW / 2, 18, {
        width: CW / 2,
        align: "right",
      })
      .restore();

    // Thin rule under header
    doc
      .save()
      .moveTo(ML, 28)
      .lineTo(ML + CW, 28)
      .strokeColor("#e2e8f0")
      .lineWidth(0.4)
      .stroke()
      .restore();

    // Footer
    doc
      .save()
      .font("Helvetica-Oblique")
      .fontSize(7)
      .fillColor("#94a3b8")
      .text("CONFIDENTIAL — FOR OFFICIAL USE ONLY", ML, FOOTER_Y + 4, {
        width: CW / 2,
      })
      .font("Helvetica")
      .text(
        `Generated by Digital Case Book System · ${new Date().toLocaleDateString("en-GB")}`,
        ML + CW / 2,
        FOOTER_Y + 4,
        { width: CW / 2, align: "right" },
      )
      .restore();

    // Reset cursor to below the running header
    doc.y = 36;
  }

  // ── Page-break guard ──────────────────────────────────────────────────────
  // Returns the Y position where drawing should begin.
  // If there is not enough vertical room, adds a new page first.
  function ensureSpace(needed: number): number {
    if (doc.y + needed > FOOTER_Y - 6) {
      doc.addPage();
      stampPage();
    }
    return doc.y;
  }

  // ── Section band (coloured header bar) ───────────────────────────────────
  // Returns the Y immediately below the band so callers can set doc.y.
  function sectionBand(title: string, color = "#1e3a8a"): number {
    const BAND_H = 22;
    ensureSpace(BAND_H + 10);
    const y = doc.y + 8;
    filledRect(ML, y, CW, BAND_H, color, 3);
    doc
      .save()
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor("#ffffff")
      .text((title || "").toUpperCase(), ML + 10, y + 7, {
        width: CW - 20,
        characterSpacing: 1.2,
      })
      .restore();
    doc.y = y + BAND_H + 6;
    return doc.y;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PAGE 1 — LETTERHEAD + COVER HEADER
  // ─────────────────────────────────────────────────────────────────────────

  // Outer border for the letterhead block
  const LETTERHEAD_H = logoBuffer ? 110 : 88;
  filledRect(ML, 36, CW, LETTERHEAD_H, "#f0f4ff", 4);
  strokedRect(ML, 36, CW, LETTERHEAD_H, "#1e3a8a", 1);

  // Logo (left side)
  const LOGO_W = 72;
  const LOGO_H = 72;
  const LOGO_X = ML + 12;
  const LOGO_Y = 36 + (LETTERHEAD_H - LOGO_H) / 2;

  if (logoBuffer) {
    doc.image(logoBuffer, LOGO_X, LOGO_Y, { width: LOGO_W, height: LOGO_H });
  }

  // Text block (centred in remaining space)
  const TEXT_X = logoBuffer ? LOGO_X + LOGO_W + 12 : ML + 12;
  const TEXT_W = logoBuffer ? CW - LOGO_W - 36 : CW - 24;
  let textCursor = 36 + 10;

  doc
    .save()
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor("#1e3a8a")
    .text("GHANA POLICE SERVICE", TEXT_X, textCursor, {
      width: TEXT_W,
      align: "center",
    })
    .restore();
  textCursor += 17;

  doc
    .save()
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#1e3a8a")
    .text("Ghana Police Station", TEXT_X, textCursor, {
      width: TEXT_W,
      align: "center",
    })
    .restore();
  textCursor += 13;

  doc
    .save()
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor("#374151")
    .text("Asankragwa Police District", TEXT_X, textCursor, {
      width: TEXT_W,
      align: "center",
    })
    .restore();
  textCursor += 12;

  doc
    .save()
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#475569")
    .text("Post Office Box 8, Asankragwa, Western Region", TEXT_X, textCursor, {
      width: TEXT_W,
      align: "center",
    })
    .restore();
  textCursor += 11;

  doc
    .save()
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#475569")
    .text(
      "Tel: ...................................................",
      TEXT_X,
      textCursor,
      { width: TEXT_W, align: "center" },
    )
    .restore();
  textCursor += 11;

  doc
    .save()
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#1d4ed8")
    .text("asankragwadistrict@gmail.com", TEXT_X, textCursor, {
      width: TEXT_W,
      align: "center",
    })
    .restore();

  doc.y = 36 + LETTERHEAD_H + 8;

  // Blue title banner
  const BANNER_H = 44;
  filledRect(ML, doc.y, CW, BANNER_H, "#1e3a8a", 4);
  doc
    .save()
    .font("Helvetica-Bold")
    .fontSize(14)
    .fillColor("#ffffff")
    .text("DIGITAL CASE BOOK", ML, doc.y + 6, { width: CW, align: "center" })
    .restore();
  doc
    .save()
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#bfdbfe")
    .text("OFFICIAL RECORD — FOR OFFICIAL USE ONLY", ML, doc.y + 24, {
      width: CW,
      align: "center",
      characterSpacing: 1,
    })
    .restore();
  doc.y += BANNER_H + 10;

  // Stamp running header/footer on page 1 (without resetting doc.y)
  {
    const saved = doc.y;
    doc
      .save()
      .font("Helvetica")
      .fontSize(7)
      .fillColor("#94a3b8")
      .text("GHANA POLICE SERVICE — DIGITAL CASE BOOK", ML, 18, {
        width: CW / 2,
      })
      .text(caseData.caseNumber || "", ML + CW / 2, 18, {
        width: CW / 2,
        align: "right",
      })
      .restore();
    doc
      .save()
      .moveTo(ML, 28)
      .lineTo(ML + CW, 28)
      .strokeColor("#e2e8f0")
      .lineWidth(0.4)
      .stroke()
      .restore();
    doc
      .save()
      .font("Helvetica-Oblique")
      .fontSize(7)
      .fillColor("#94a3b8")
      .text("CONFIDENTIAL — FOR OFFICIAL USE ONLY", ML, FOOTER_Y + 4, {
        width: CW / 2,
      })
      .font("Helvetica")
      .text(
        `Generated by Digital Case Book System · ${new Date().toLocaleDateString("en-GB")}`,
        ML + CW / 2,
        FOOTER_Y + 4,
        { width: CW / 2, align: "right" },
      )
      .restore();
    doc.y = saved;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CASE IDENTITY BOX
  // ─────────────────────────────────────────────────────────────────────────
  ensureSpace(110);
  const idY = doc.y;
  const ID_H = 108;
  filledRect(ML, idY, CW, ID_H, "#f8fafc", 4);
  strokedRect(ML, idY, CW, ID_H, "#cbd5e1", 1);

  labelText("Case Number", ML + 12, idY + 10);
  boldText(
    caseData.caseNumber || "N/A",
    ML + 12,
    idY + 20,
    CW - 180,
    "#1e3a8a",
    22,
  );
  boldText(
    caseData.title || "(No title)",
    ML + 12,
    idY + 54,
    CW - 180,
    "#0f172a",
    11,
  );
  bodyText(
    caseData.description || "(No description)",
    ML + 12,
    idY + 69,
    CW - 180,
    "#475569",
    8.5,
  );

  const rX = ML + CW - 160;
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

  doc.y = idY + ID_H + 10;

  // ─────────────────────────────────────────────────────────────────────────
  // KEY DETAILS GRID  (3 rows × 4 columns)
  // ─────────────────────────────────────────────────────────────────────────
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

  const COL4 = CW / 4;
  const ROW_H = 44;

  for (let ri = 0; ri < gridRows.length; ri++) {
    ensureSpace(ROW_H + 2);
    const rY = doc.y;
    filledRect(ML, rY, CW, ROW_H, ri % 2 === 0 ? "#f8fafc" : "#ffffff");
    strokedRect(ML, rY, CW, ROW_H, "#e2e8f0", 0.5);
    for (let ci = 0; ci < gridRows[ri].length; ci++) {
      const [label, value] = gridRows[ri][ci];
      const cx = ML + ci * COL4 + 6;
      labelText(label, cx, rY + 6, COL4 - 10);
      bodyText(value || "—", cx, rY + 18, COL4 - 12, "#1e293b", 8);
    }
    doc.y = rY + ROW_H;
  }
  doc.y += 6;

  // ─────────────────────────────────────────────────────────────────────────
  // WORKFLOW TIMELINE
  // ─────────────────────────────────────────────────────────────────────────
  sectionBand("Case Workflow Progress");
  ensureSpace(70);
  const tlY = doc.y;
  const colWt = CW / 4;
  const curIdx = STAGE_ORDER.indexOf(caseData.currentStage);

  STAGE_ORDER.forEach((stage, idx) => {
    const pal = STAGE_COLORS[stage];
    const cx = ML + idx * colWt + colWt / 2;
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

  // ─────────────────────────────────────────────────────────────────────────
  // DIGITAL CASE BOOK ENTRIES  (NCO → CID → SO → DC)
  // ─────────────────────────────────────────────────────────────────────────
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

    // Stage sub-header
    ensureSpace(36);
    const shY = doc.y + 4;
    filledRect(ML, shY, CW, 22, pal.header, 3);
    doc
      .save()
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor("#ffffff")
      .text(stageLbl.toUpperCase(), ML + 10, shY + 7, {
        width: CW / 2,
        characterSpacing: 0.5,
      })
      .restore();
    doc
      .save()
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#bfdbfe")
      .text(countTxt, ML + CW / 2, shY + 8, {
        width: CW / 2 - 10,
        align: "right",
      })
      .restore();
    doc.y = shY + 28;

    if (entries.length === 0) {
      doc
        .save()
        .font("Helvetica-Oblique")
        .fontSize(9)
        .fillColor("#94a3b8")
        .text(
          "No case book entries were recorded at this stage.",
          ML + 12,
          doc.y,
          { width: CW - 24 },
        )
        .restore();
      doc.y += 16;
      continue;
    }

    for (const entry of entries) {
      const typeLabel =
        ENTRY_TYPE_LABELS[entry.entryType] || entry.entryType || "Remark";

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

      // Accurately measure the text height pdfkit will use
      const measured = doc.heightOfString(content, {
        width: CW - 28,
        lineGap: 2.5,
      });
      // Box = pill row (30 pt) + divider (2 pt) + content + bottom notice (18 pt) + padding (12 pt)
      const boxH = Math.max(80, 30 + 2 + measured + 18 + 12);

      ensureSpace(boxH + 14);
      const eY = doc.y + 4;

      filledRect(ML, eY, CW, boxH, pal.light, 4);
      strokedRect(ML, eY, CW, boxH, pal.accent, 1.5);
      filledRect(ML, eY, 5, boxH, pal.header, 2); // left accent bar

      // Entry type pill
      filledRect(ML + 14, eY + 7, 114, 16, pal.accent, 3);
      doc
        .save()
        .font("Helvetica-Bold")
        .fontSize(7)
        .fillColor("#ffffff")
        .text(typeLabel.toUpperCase(), ML + 16, eY + 10, {
          width: 110,
          characterSpacing: 0.3,
        })
        .restore();

      // Officer name + role
      boldText(
        `${oName}  (${oRole})${badgeStr}`,
        ML + 136,
        eY + 8,
        CW - 274,
        pal.header,
        8.5,
      );

      // Timestamp
      doc
        .save()
        .font("Helvetica")
        .fontSize(7.5)
        .fillColor("#64748b")
        .text(fmt(addedAt), ML + CW - 130, eY + 8, {
          width: 120,
          align: "right",
        })
        .restore();

      // Divider
      hLine(eY + 28, pal.accent, 0.5);

      // Content
      doc
        .save()
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#1e293b")
        .text(content, ML + 14, eY + 34, { width: CW - 28, lineGap: 2.5 })
        .restore();

      // Locked notice
      doc
        .save()
        .font("Helvetica-Oblique")
        .fontSize(7)
        .fillColor("#94a3b8")
        .text(
          "Entry locked — immutable after submission",
          ML + 14,
          eY + boxH - 13,
          { width: CW - 28 },
        )
        .restore();

      doc.y = eY + boxH + 8;
    }
    doc.y += 4;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // OFFICIAL HANDOFF NOTES
  // ─────────────────────────────────────────────────────────────────────────
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
      const measured = doc.heightOfString(hn.val || "", {
        width: CW - 28,
        lineGap: 1.5,
      });
      const boxH = Math.max(50, measured + 36);

      ensureSpace(boxH + 14);
      const hnY = doc.y + 4;
      filledRect(ML, hnY, CW, boxH, "#f8fafc", 3);
      strokedRect(ML, hnY, CW, boxH, "#e2e8f0", 1);
      filledRect(ML, hnY, 5, boxH, hn.color, 2);

      boldText(hn.label.toUpperCase(), ML + 14, hnY + 10, CW - 24, hn.color, 8);
      bodyText(hn.val || "", ML + 14, hnY + 26, CW - 28, "#334155", 9);

      doc.y = hnY + boxH + 8;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INTERNAL NOTES
  // ─────────────────────────────────────────────────────────────────────────
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
      const measured = doc.heightOfString(noteContent, {
        width: CW - 28,
        lineGap: 1.5,
      });
      const boxH = Math.max(50, measured + 36);

      ensureSpace(boxH + 10);
      const nY = doc.y + 4;
      filledRect(ML, nY, CW, boxH, "#f8fafc", 3);
      strokedRect(ML, nY, CW, boxH, "#e2e8f0", 1);
      filledRect(ML, nY, 5, boxH, "#64748b", 2);

      boldText(
        `${noteName}  (${noteRole})`,
        ML + 14,
        nY + 10,
        CW * 0.6,
        "#374151",
        8.5,
      );
      doc
        .save()
        .font("Helvetica")
        .fontSize(7.5)
        .fillColor("#64748b")
        .text(fmt(note.addedAt), ML + CW - 130, nY + 10, {
          width: 120,
          align: "right",
        })
        .restore();
      bodyText(noteContent, ML + 14, nY + 26, CW - 28, "#334155", 9);

      doc.y = nY + boxH + 6;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SUSPECTS & WITNESSES
  // ─────────────────────────────────────────────────────────────────────────
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
      ensureSpace(28);
      const hY = doc.y;
      filledRect(ML, hY, CW, 22, "#374151");
      let xPos = ML;
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
        // Measure each cell accurately
        const maxH = Math.max(
          ...cells.map((c) =>
            doc.heightOfString(c || "—", {
              width: widths[cells.indexOf(c)] - 10,
              lineGap: 1.5,
            }),
          ),
        );
        const rowH = Math.max(22, maxH + 14);

        ensureSpace(rowH + 2);
        const rY = doc.y;
        filledRect(ML, rY, CW, rowH, ri % 2 === 0 ? "#f8fafc" : "#ffffff");
        strokedRect(ML, rY, CW, rowH, "#e2e8f0", 0.5);
        let cx = ML;
        cells.forEach((cell, i) => {
          bodyText(cell || "—", cx + 5, rY + 7, widths[i] - 10, "#334155", 8);
          cx += widths[i];
        });
        doc.y = rY + rowH;
      });
      doc.y += 8;
    }

    if (suspects.length) {
      ensureSpace(24);
      doc
        .save()
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor("#dc2626")
        .text("SUSPECTS", ML, doc.y, { characterSpacing: 1 })
        .restore();
      doc.y += 6;
      drawTable(
        suspects,
        ["NAME", "AGE", "DESCRIPTION", "ADDRESS"],
        [CW * 0.25, CW * 0.1, CW * 0.35, CW * 0.3],
        (s: any) => [
          s.name || "—",
          s.age ? String(s.age) : "—",
          s.description || "—",
          s.address || "—",
        ],
      );
    }

    if (witnesses.length) {
      ensureSpace(24);
      doc
        .save()
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor("#16a34a")
        .text("WITNESSES", ML, doc.y, { characterSpacing: 1 })
        .restore();
      doc.y += 6;
      drawTable(
        witnesses,
        ["NAME", "PHONE", "STATEMENT"],
        [CW * 0.25, CW * 0.2, CW * 0.55],
        (w: any) => [w.name || "—", w.phone || "—", w.statement || "—"],
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AUDIT TRAIL
  // ─────────────────────────────────────────────────────────────────────────
  const auditLog: any[] = Array.isArray(caseData.auditLog)
    ? caseData.auditLog
    : [];

  if (auditLog.length) {
    sectionBand("Audit Trail", "#374151");

    const aW = [CW * 0.22, CW * 0.34, CW * 0.24, CW * 0.2];
    const aHeaders = [
      "DATE & TIME",
      "ACTION / DETAILS",
      "PERFORMED BY",
      "STAGE TRANSITION",
    ];

    ensureSpace(26);
    const ahY = doc.y;
    filledRect(ML, ahY, CW, 22, "#1e3a8a");
    let axPos = ML;
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
      const measured = Math.max(
        ...cells.map((c, ci) =>
          doc.heightOfString(c || "—", { width: aW[ci] - 10, lineGap: 1.5 }),
        ),
      );
      const rowH = Math.max(22, measured + 14);

      ensureSpace(rowH + 2);
      const rY = doc.y;
      filledRect(ML, rY, CW, rowH, i % 2 === 0 ? "#f8fafc" : "#ffffff");
      strokedRect(ML, rY, CW, rowH, "#e2e8f0", 0.5);
      let cx = ML;
      cells.forEach((cell, ci) => {
        bodyText(cell, cx + 5, rY + 6, aW[ci] - 10, "#334155", 8);
        cx += aW[ci];
      });
      doc.y = rY + rowH;
    });
    doc.y += 8;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CASE TIMELINE
  // ─────────────────────────────────────────────────────────────────────────
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
      ensureSpace(tH + 2);
      const tY = doc.y;
      filledRect(ML, tY, CW, tH, i % 2 === 0 ? "#f8fafc" : "#ffffff");
      strokedRect(ML, tY, CW, tH, "#e2e8f0", 0.5);
      doc
        .save()
        .circle(ML + 14, tY + 11, 4)
        .fill(
          i === 0
            ? "#1e40af"
            : i === timestamps.length - 1
              ? "#16a34a"
              : "#64748b",
        )
        .restore();
      boldText(t.label, ML + 26, tY + 6, CW * 0.38, "#374151", 9);
      bodyText(
        fmt(t.val as string),
        ML + CW * 0.4,
        tY + 6,
        CW * 0.58,
        "#475569",
        9,
      );
      doc.y = tY + tH;
    });
    doc.y += 10;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CERTIFICATION + SIGNATURE BLOCK
  // ─────────────────────────────────────────────────────────────────────────
  ensureSpace(170);
  doc.y += 12;
  hLine(doc.y, "#cbd5e1", 1);
  doc.y += 10;

  const certY = doc.y;

  boldText("CERTIFICATION OF AUTHENTICITY", ML, certY, CW * 0.55, "#374151", 8);
  bodyText(
    "This is a certified digital copy of the official case record generated by the Ghana Police Service Digital Case Book System. This document is an accurate representation of all entries made by authorised officers.",
    ML,
    certY + 14,
    CW * 0.55,
    "#64748b",
    7.5,
  );

  const dX = ML + CW * 0.6;
  const dW = CW * 0.4;
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

  // Signature blocks (4 across)
  ensureSpace(80);
  const sigW = CW / 4;
  const sigY = doc.y;
  const sigOfficers = [
    { role: "NCO / Station Orderly", officer: caseData.loggedBy },
    { role: "CID Investigator", officer: caseData.assignedOfficer },
    { role: "Station Officer", officer: caseData.assignedSO },
    { role: "District Commander", officer: caseData.assignedDC },
  ];

  sigOfficers.forEach(({ role, officer }, i) => {
    const sx = ML + i * sigW;
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

  // ─────────────────────────────────────────────────────────────────────────
  // WATERMARK  — stamp every buffered page
  // ─────────────────────────────────────────────────────────────────────────
  doc.flushPages();
  const { start, count } = doc.bufferedPageRange();
  for (let pi = start; pi < start + count; pi++) {
    doc.switchToPage(pi);
    doc
      .save()
      .translate(PAGE_W / 2, PAGE_H / 2)
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

    const caseData = await Case.findById(id)
      .populate("loggedBy", "fullName email role badgeNumber")
      .populate("assignedOfficer", "fullName email role badgeNumber")
      .populate("assignedSO", "fullName email role badgeNumber")
      .populate("assignedDC", "fullName email role badgeNumber")
      .populate("caseBookEntries.addedBy", "fullName role badgeNumber")
      .populate("auditLog.performedBy", "fullName role badgeNumber")
      .populate("notes.addedBy", "fullName role badgeNumber")
      .lean();

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
