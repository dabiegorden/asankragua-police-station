// src/app/api/cases/[id]/pdf/route.ts
// Digital Case Book — PDF Export (GET) + Case Update (PUT) + Delete (DELETE)
// PDF generation uses pdf-lib only.

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Case from "@/models/Case";
import { requireAuth } from "@/middleware/auth";
import { parseAttachments } from "@/lib/parseAttachments";
import { populateCase } from "@/app/api/cases/route";
import { PDFDocument, PDFFont, StandardFonts, rgb, degrees } from "pdf-lib";
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
  // ── Page constants ────────────────────────────────────────────────────────
  const PAGE_W = 595.28; // A4 width  (pt)
  const PAGE_H = 841.89; // A4 height (pt)
  const ML = 40;
  const MR = 40;
  const CW = PAGE_W - ML - MR; // 515.28
  const MB = 50;
  const FOOTER_Y = PAGE_H - MB; // top-down: footer zone starts here

  // ── Create document ───────────────────────────────────────────────────────
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`Case Book — ${caseData.caseNumber || "N/A"}`);
  pdfDoc.setAuthor("Ghana Police Service");
  pdfDoc.setSubject("Digital Case Book Official Record");
  pdfDoc.setCreator("Digital Case Book System");

  // ── Embed standard fonts ──────────────────────────────────────────────────
  const F: PDFFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const FB: PDFFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const FI: PDFFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // ── Color helper (hex → pdf-lib rgb) ─────────────────────────────────────
  function col(hex: string) {
    return rgb(
      parseInt(hex.slice(1, 3), 16) / 255,
      parseInt(hex.slice(3, 5), 16) / 255,
      parseInt(hex.slice(5, 7), 16) / 255,
    );
  }

  // ── Coordinate converters (pdfkit top-down → pdf-lib bottom-up) ───────────
  // Rectangle bottom-left y in pdf-lib coords
  const ry = (topY: number, h: number) => PAGE_H - topY - h;
  // Point y for lines
  const ly = (topY: number) => PAGE_H - topY;
  // Text baseline y (Helvetica cap-height ≈ 72% of size above baseline)
  const ty = (topY: number, size: number) => PAGE_H - topY - size * 0.75;

  // ── Text wrapping ─────────────────────────────────────────────────────────
  function sanitize(text: string): string {
    return String(text || "")
      .replace(/→/g, "->").replace(/←/g, "<-")
      .replace(/↑/g, "^").replace(/↓/g, "v")
      .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
      .replace(/•/g, "*").replace(/…/g, "...")
      .replace(/[^\x20-\xFF–—]/g, "?");
  }

  function wrapLines(
    text: string,
    font: PDFFont,
    size: number,
    maxW: number,
  ): string[] {
    const str = sanitize(text) || "—";
    const result: string[] = [];
    for (const para of str.split("\n")) {
      const words = para.split(" ").filter(Boolean);
      if (!words.length) {
        result.push(" ");
        continue;
      }
      let line = "";
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(test, size) > maxW && line) {
          result.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      if (line) result.push(line);
    }
    return result.length ? result : ["—"];
  }

  function calcH(
    text: string,
    font: PDFFont,
    size: number,
    maxW: number,
    gap = 0,
  ): number {
    return wrapLines(text || "—", font, size, maxW).length * (size + gap);
  }

  // ── Page state ────────────────────────────────────────────────────────────
  let pg = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let curY = 36; // top-down cursor, starts below running header

  // ── Drawing helpers ───────────────────────────────────────────────────────

  function drawStr(
    text: string,
    x: number,
    topY: number,
    maxW: number,
    font: PDFFont,
    size: number,
    colorHex: string,
    gap = 0,
    align: "left" | "right" | "center" = "left",
  ): void {
    const lines = wrapLines(text || "—", font, size, maxW);
    const lh = size + gap;
    lines.forEach((line, i) => {
      let tx = x;
      const lw = font.widthOfTextAtSize(line, size);
      if (align === "right") tx = x + maxW - lw;
      else if (align === "center") tx = x + (maxW - lw) / 2;
      pg.drawText(line, {
        x: Math.max(0, tx),
        y: ty(topY + i * lh, size),
        font,
        size,
        color: col(colorHex),
      });
    });
  }

  function fillRect(
    x: number,
    topY: number,
    w: number,
    h: number,
    fillHex: string,
  ) {
    pg.drawRectangle({
      x,
      y: ry(topY, h),
      width: w,
      height: h,
      color: col(fillHex),
    });
  }

  function strokeRect(
    x: number,
    topY: number,
    w: number,
    h: number,
    strokeHex: string,
    lw = 0.75,
  ) {
    pg.drawRectangle({
      x,
      y: ry(topY, h),
      width: w,
      height: h,
      borderColor: col(strokeHex),
      borderWidth: lw,
    });
  }

  function hLine(topY: number, colorHex = "#e2e8f0", lw = 0.5) {
    pg.drawLine({
      start: { x: ML, y: ly(topY) },
      end: { x: ML + CW, y: ly(topY) },
      thickness: lw,
      color: col(colorHex),
    });
  }

  function labelTxt(text: string, x: number, topY: number, w = 120) {
    drawStr((text || "").toUpperCase(), x, topY, w, FB, 6.5, "#64748b");
  }

  function bodyTxt(
    text: string,
    x: number,
    topY: number,
    w: number,
    colorHex = "#334155",
    size = 9,
  ) {
    drawStr(text || "—", x, topY, w, F, size, colorHex, 1.5);
  }

  function boldTxt(
    text: string,
    x: number,
    topY: number,
    w: number,
    colorHex = "#0f172a",
    size = 9,
  ) {
    drawStr(text || "—", x, topY, w, FB, size, colorHex);
  }

  // ── Running header / footer ───────────────────────────────────────────────
  function stampPage() {
    pg.drawText("GHANA POLICE SERVICE — DIGITAL CASE BOOK", {
      x: ML,
      y: ty(18, 7),
      font: F,
      size: 7,
      color: col("#94a3b8"),
    });
    const cn = String(caseData.caseNumber || "");
    if (cn) {
      const cnW = F.widthOfTextAtSize(cn, 7);
      pg.drawText(cn, {
        x: ML + CW - cnW,
        y: ty(18, 7),
        font: F,
        size: 7,
        color: col("#94a3b8"),
      });
    }
    pg.drawLine({
      start: { x: ML, y: ly(28) },
      end: { x: ML + CW, y: ly(28) },
      thickness: 0.4,
      color: col("#e2e8f0"),
    });
    pg.drawText("CONFIDENTIAL — FOR OFFICIAL USE ONLY", {
      x: ML,
      y: ty(FOOTER_Y + 4, 7),
      font: FI,
      size: 7,
      color: col("#94a3b8"),
    });
    const genText = `Generated by Digital Case Book System · ${new Date().toLocaleDateString("en-GB")}`;
    const genW = F.widthOfTextAtSize(genText, 7);
    pg.drawText(genText, {
      x: ML + CW - genW,
      y: ty(FOOTER_Y + 4, 7),
      font: F,
      size: 7,
      color: col("#94a3b8"),
    });
  }

  // ── Page-break guard ──────────────────────────────────────────────────────
  function ensureSpace(needed: number): number {
    if (curY + needed > FOOTER_Y - 6) {
      pg = pdfDoc.addPage([PAGE_W, PAGE_H]);
      curY = 36;
      stampPage();
    }
    return curY;
  }

  // ── Section band ──────────────────────────────────────────────────────────
  function sectionBand(title: string, color = "#1e3a8a"): number {
    const BAND_H = 22;
    ensureSpace(BAND_H + 10);
    const y = curY + 8;
    fillRect(ML, y, CW, BAND_H, color);
    pg.drawText((title || "").toUpperCase(), {
      x: ML + 10,
      y: ty(y + 7, 8),
      font: FB,
      size: 8,
      color: col("#ffffff"),
    });
    curY = y + BAND_H + 6;
    return curY;
  }

  // ── Logo ──────────────────────────────────────────────────────────────────
  let logoImage: any = null;
  try {
    const logoPath = path.join(
      process.cwd(),
      "public",
      "assets",
      "officer.jpg",
    );
    if (fs.existsSync(logoPath)) {
      const logoBytes = fs.readFileSync(logoPath);
      logoImage = await pdfDoc.embedJpg(logoBytes);
    }
  } catch {
    /* logo optional */
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 1 — LETTERHEAD + COVER HEADER
  // ═══════════════════════════════════════════════════════════════════════════
  stampPage();

  const LETTERHEAD_H = logoImage ? 110 : 88;
  fillRect(ML, 36, CW, LETTERHEAD_H, "#f0f4ff");
  strokeRect(ML, 36, CW, LETTERHEAD_H, "#1e3a8a", 1);

  const LOGO_W = 72,
    LOGO_H = 72;
  const LOGO_X = ML + 12;
  const LOGO_Y = 36 + (LETTERHEAD_H - LOGO_H) / 2;

  if (logoImage) {
    pg.drawImage(logoImage, {
      x: LOGO_X,
      y: ry(LOGO_Y, LOGO_H),
      width: LOGO_W,
      height: LOGO_H,
    });
  }

  const TEXT_X = logoImage ? LOGO_X + LOGO_W + 12 : ML + 12;
  const TEXT_W = logoImage ? CW - LOGO_W - 36 : CW - 24;
  let tCursor = 36 + 10;

  drawStr("GHANA POLICE SERVICE", TEXT_X, tCursor, TEXT_W, FB, 13, "#1e3a8a", 0, "center"); tCursor += 17;
  drawStr("Ghana Police Station", TEXT_X, tCursor, TEXT_W, FB, 10, "#1e3a8a", 0, "center"); tCursor += 13;
  drawStr("Asankragwa Police District", TEXT_X, tCursor, TEXT_W, FB, 9, "#374151", 0, "center"); tCursor += 12;
  drawStr("Post Office Box 8, Asankragwa, Western Region", TEXT_X, tCursor, TEXT_W, F, 8, "#475569", 0, "center"); tCursor += 11;
  drawStr("Tel: ...................................................", TEXT_X, tCursor, TEXT_W, F, 8, "#475569", 0, "center"); tCursor += 11;
  drawStr("asankragwadistrict@gmail.com", TEXT_X, tCursor, TEXT_W, F, 8, "#1d4ed8", 0, "center");

  curY = 36 + LETTERHEAD_H + 8;

  const BANNER_H = 44;
  fillRect(ML, curY, CW, BANNER_H, "#1e3a8a");
  drawStr("DIGITAL CASE BOOK", ML, curY + 6, CW, FB, 14, "#ffffff", 0, "center");
  drawStr("OFFICIAL RECORD — FOR OFFICIAL USE ONLY", ML, curY + 24, CW, F, 8, "#bfdbfe", 0, "center");
  curY += BANNER_H + 10;

  // ═══════════════════════════════════════════════════════════════════════════
  // CASE IDENTITY BOX
  // ═══════════════════════════════════════════════════════════════════════════
  // Left column holds case number / title / description; its width is reduced
  // so it never overlaps the status block on the right. The box grows to fit
  // the full (wrapped) description instead of clipping it at a fixed height.
  const idLeftW = CW - 180;
  const descH = calcH(
    caseData.description || "(No description)",
    F,
    8.5,
    idLeftW,
    1.5,
  );
  const ID_H = Math.max(108, 69 + descH + 12);
  ensureSpace(ID_H + 10);
  const idY = curY;
  fillRect(ML, idY, CW, ID_H, "#f8fafc");
  strokeRect(ML, idY, CW, ID_H, "#cbd5e1", 1);

  labelTxt("Case Number", ML + 12, idY + 10);
  boldTxt(caseData.caseNumber || "N/A", ML + 12, idY + 20, idLeftW, "#1e3a8a", 22);
  boldTxt(caseData.title || "(No title)", ML + 12, idY + 54, idLeftW, "#0f172a", 11);
  bodyTxt(caseData.description || "(No description)", ML + 12, idY + 69, idLeftW, "#475569", 8.5);

  const rX = ML + CW - 160;
  labelTxt("Status", rX, idY + 10, 155);
  boldTxt(statusLabel(caseData.status), rX, idY + 21, 155, "#1e3a8a", 10);
  labelTxt("Priority", rX, idY + 46, 155);
  boldTxt(caseData.priority || "—", rX, idY + 57, 155, priorityColor(caseData.priority), 10);
  labelTxt("Current Stage", rX, idY + 78, 155);
  boldTxt(
    ROLE_LABELS[caseData.currentStage] || caseData.currentStage || "—",
    rX, idY + 89, 155, "#374151", 8,
  );

  curY = idY + ID_H + 10;

  // ═══════════════════════════════════════════════════════════════════════════
  // KEY DETAILS GRID  (3 rows × 4 columns)
  // ═══════════════════════════════════════════════════════════════════════════
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
  const ROW_H = 52;

  for (let ri = 0; ri < gridRows.length; ri++) {
    ensureSpace(ROW_H + 2);
    const rY = curY;
    fillRect(ML, rY, CW, ROW_H, ri % 2 === 0 ? "#f8fafc" : "#ffffff");
    strokeRect(ML, rY, CW, ROW_H, "#e2e8f0", 0.5);
    for (let ci = 0; ci < gridRows[ri].length; ci++) {
      const [label, value] = gridRows[ri][ci];
      const cx = ML + ci * COL4 + 6;
      labelTxt(label, cx, rY + 8, COL4 - 10);
      bodyTxt(value || "—", cx, rY + 22, COL4 - 12, "#1e293b", 8);
    }
    curY = rY + ROW_H;
  }
  curY += 6;

  // ═══════════════════════════════════════════════════════════════════════════
  // WORKFLOW TIMELINE
  // ═══════════════════════════════════════════════════════════════════════════
  sectionBand("Case Workflow Progress");
  ensureSpace(70);
  const tlY = curY;
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
      pg.drawLine({
        start: { x: cx + 16, y: ly(tlY + 16) },
        end: { x: cx + colWt - 16, y: ly(tlY + 16) },
        thickness: 2,
        color: col(isPast ? "#475569" : "#e2e8f0"),
      });
    }

    pg.drawEllipse({
      x: cx,
      y: ly(tlY + 16),
      xScale: 14,
      yScale: 14,
      color: col(circleColor),
    });

    const stageLabel = stage.toUpperCase();
    const slw = FB.widthOfTextAtSize(stageLabel, 7.5);
    pg.drawText(stageLabel, {
      x: cx - slw / 2,
      y: ty(tlY + 11, 7.5),
      font: FB,
      size: 7.5,
      color: col("#ffffff"),
    });

    drawStr(ROLE_LABELS[stage] || stage, cx - colWt / 2 + 4, tlY + 34, colWt - 8, FB, 7, labelColor, 0, "center");
    drawStr(statusText, cx - colWt / 2 + 4, tlY + 46, colWt - 8, FB, 6.5, statusColor, 0, "center");
  });
  curY = tlY + 64;

  // ═══════════════════════════════════════════════════════════════════════════
  // DIGITAL CASE BOOK ENTRIES  (NCO → CID → SO → DC)
  // ═══════════════════════════════════════════════════════════════════════════
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

    ensureSpace(36);
    const shY = curY + 4;
    fillRect(ML, shY, CW, 22, pal.header);
    pg.drawText(stageLbl.toUpperCase(), {
      x: ML + 10,
      y: ty(shY + 7, 9),
      font: FB,
      size: 9,
      color: col("#ffffff"),
    });
    drawStr(countTxt, ML + CW / 2, shY + 8, CW / 2 - 10, F, 8, "#bfdbfe", 0, "right");
    curY = shY + 28;

    if (!entries.length) {
      pg.drawText("No case book entries were recorded at this stage.", {
        x: ML + 12,
        y: ty(curY, 9),
        font: FI,
        size: 9,
        color: col("#94a3b8"),
      });
      curY += 16;
      continue;
    }

    for (const entry of entries) {
      const typeLabel =
        ENTRY_TYPE_LABELS[entry.entryType] || entry.entryType || "Remark";
      const aObj = entry.addedBy;
      let oName = "Unknown Officer",
        badgeStr = "";
      if (aObj && typeof aObj === "object" && aObj.fullName) {
        oName = aObj.fullName;
        badgeStr = aObj.badgeNumber ? ` · Badge: ${aObj.badgeNumber}` : "";
      }
      const oRole =
        ROLE_LABELS[entry.roleSnapshot] || entry.roleSnapshot || stage;
      const content = (entry.content || "").trim() || "(No content)";
      const addedAt = entry.addedAt || entry.createdAt;

      const measured = calcH(content, F, 9, CW - 28, 1.5);
      const boxH = Math.max(90, 46 + measured + 26);

      ensureSpace(boxH + 14);
      const eY = curY + 4;

      fillRect(ML, eY, CW, boxH, pal.light);
      strokeRect(ML, eY, CW, boxH, pal.accent, 1.5);
      fillRect(ML, eY, 5, boxH, pal.header);

      fillRect(ML + 14, eY + 7, 114, 16, pal.accent);
      pg.drawText(typeLabel.toUpperCase(), {
        x: ML + 16,
        y: ty(eY + 10, 7),
        font: FB,
        size: 7,
        color: col("#ffffff"),
      });

      boldTxt(`${oName}  (${oRole})${badgeStr}`, ML + 136, eY + 8, CW - 274, pal.header, 8.5);
      drawStr(fmt(addedAt), ML + CW - 130, eY + 8, 120, F, 7.5, "#64748b", 0, "right");
      hLine(eY + 32, pal.accent, 0.5);
      bodyTxt(content, ML + 14, eY + 40, CW - 28, "#1e293b", 9);
      pg.drawText("Entry locked — immutable after submission", {
        x: ML + 14,
        y: ty(eY + boxH - 14, 7),
        font: FI,
        size: 7,
        color: col("#94a3b8"),
      });

      curY = eY + boxH + 8;
    }
    curY += 4;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OFFICIAL HANDOFF NOTES
  // ═══════════════════════════════════════════════════════════════════════════
  const handoffs = [
    { label: "NCO Referral Note", val: caseData.ncoReferralNote, color: "#1d4ed8" },
    { label: "CID Submission / Findings", val: caseData.cidSubmissionNote, color: "#4338ca" },
    { label: "Station Officer Review Note", val: caseData.soReviewNote, color: "#7c3aed" },
    { label: "Station Officer Directive", val: caseData.soDirective, color: "#dc2626" },
    { label: "District Commander Decision", val: caseData.dcNote, color: "#92400e" },
  ].filter((n) => n.val?.trim());

  if (handoffs.length) {
    sectionBand("Official Handoff Notes", "#374151");
    for (const hn of handoffs) {
      const measured = calcH(hn.val || "", F, 9, CW - 28, 1.5);
      const boxH = Math.max(60, measured + 46);
      ensureSpace(boxH + 14);
      const hnY = curY + 4;
      fillRect(ML, hnY, CW, boxH, "#f8fafc");
      strokeRect(ML, hnY, CW, boxH, "#e2e8f0", 1);
      fillRect(ML, hnY, 5, boxH, hn.color);
      boldTxt(hn.label.toUpperCase(), ML + 14, hnY + 12, CW - 24, hn.color, 8);
      bodyTxt(hn.val || "", ML + 14, hnY + 32, CW - 28, "#334155", 9);
      curY = hnY + boxH + 8;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INTERNAL NOTES
  // ═══════════════════════════════════════════════════════════════════════════
  const internalNotes: any[] = Array.isArray(caseData.notes)
    ? caseData.notes
    : [];
  if (internalNotes.length) {
    sectionBand("Internal Notes", "#374151");
    for (const note of internalNotes) {
      const nByObj = note.addedBy;
      let noteName = "Unknown Officer";
      if (nByObj && typeof nByObj === "object" && nByObj.fullName)
        noteName = nByObj.fullName;
      const noteRole =
        ROLE_LABELS[note.roleSnapshot] || note.roleSnapshot || "—";
      const noteContent = (note.content || "").trim() || "(No content)";
      const measured = calcH(noteContent, F, 9, CW - 28, 1.5);
      const boxH = Math.max(60, measured + 46);
      ensureSpace(boxH + 10);
      const nY = curY + 4;
      fillRect(ML, nY, CW, boxH, "#f8fafc");
      strokeRect(ML, nY, CW, boxH, "#e2e8f0", 1);
      fillRect(ML, nY, 5, boxH, "#64748b");
      boldTxt(`${noteName}  (${noteRole})`, ML + 14, nY + 12, CW * 0.6, "#374151", 8.5);
      drawStr(fmt(note.addedAt), ML + CW - 130, nY + 12, 120, F, 7.5, "#64748b", 0, "right");
      bodyTxt(noteContent, ML + 14, nY + 32, CW - 28, "#334155", 9);
      curY = nY + boxH + 6;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUSPECTS & WITNESSES
  // ═══════════════════════════════════════════════════════════════════════════
  const suspects = Array.isArray(caseData.suspects) ? caseData.suspects : [];
  const witnesses = Array.isArray(caseData.witnesses) ? caseData.witnesses : [];

  if (suspects.length || witnesses.length) {
    sectionBand("Parties Involved", "#374151");

    const drawTable = (
      items: any[],
      headers: string[],
      widths: number[],
      rowFn: (item: any) => string[],
    ) => {
      ensureSpace(28);
      const hY = curY;
      fillRect(ML, hY, CW, 22, "#374151");
      let xPos = ML;
      headers.forEach((h, i) => {
        pg.drawText(h, {
          x: xPos + 5,
          y: ty(hY + 7, 8),
          font: FB,
          size: 8,
          color: col("#ffffff"),
        });
        xPos += widths[i];
      });
      curY = hY + 24;

      items.forEach((item, ri) => {
        const cells = rowFn(item);
        const maxH = Math.max(
          ...cells.map((c, ci) => calcH(c || "—", F, 8, widths[ci] - 10, 1.5)),
        );
        const rowH = Math.max(26, maxH + 18);
        ensureSpace(rowH + 2);
        const rY = curY;
        fillRect(ML, rY, CW, rowH, ri % 2 === 0 ? "#f8fafc" : "#ffffff");
        strokeRect(ML, rY, CW, rowH, "#e2e8f0", 0.5);
        let cx = ML;
        cells.forEach((cell, i) => {
          bodyTxt(cell || "—", cx + 5, rY + 9, widths[i] - 10, "#334155", 8);
          cx += widths[i];
        });
        curY = rY + rowH;
      });
      curY += 8;
    };

    if (suspects.length) {
      ensureSpace(24);
      pg.drawText("SUSPECTS", {
        x: ML,
        y: ty(curY, 8.5),
        font: FB,
        size: 8.5,
        color: col("#dc2626"),
      });
      curY += 6;
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
      pg.drawText("WITNESSES", {
        x: ML,
        y: ty(curY, 8.5),
        font: FB,
        size: 8.5,
        color: col("#16a34a"),
      });
      curY += 6;
      drawTable(
        witnesses,
        ["NAME", "PHONE", "STATEMENT"],
        [CW * 0.25, CW * 0.2, CW * 0.55],
        (w: any) => [w.name || "—", w.phone || "—", w.statement || "—"],
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUDIT TRAIL
  // ═══════════════════════════════════════════════════════════════════════════
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
    const ahY = curY;
    fillRect(ML, ahY, CW, 22, "#1e3a8a");
    let axPos = ML;
    aHeaders.forEach((h, i) => {
      pg.drawText(h, {
        x: axPos + 5,
        y: ty(ahY + 7, 8),
        font: FB,
        size: 8,
        color: col("#ffffff"),
      });
      axPos += aW[i];
    });
    curY = ahY + 24;

    auditLog.forEach((e: any, i: number) => {
      const pbObj = e.performedBy;
      const officerStr =
        pbObj && typeof pbObj === "object" && pbObj.fullName
          ? pbObj.fullName
          : "System";
      const transition =
        e.fromStage && e.toStage && e.fromStage !== e.toStage
          ? `${(e.fromStage || "").toUpperCase()} -> ${(e.toStage || "").toUpperCase()}`
          : e.fromStage
            ? (e.fromStage || "").toUpperCase()
            : "—";
      const actionLabel = (e.details || e.action || "")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c: string) => c.toUpperCase());
      const cells = [fmt(e.performedAt), actionLabel, officerStr, transition];
      const measured = Math.max(
        ...cells.map((c, ci) => calcH(c || "—", F, 8, aW[ci] - 10, 1.5)),
      );
      const rowH = Math.max(26, measured + 18);
      ensureSpace(rowH + 2);
      const rY = curY;
      fillRect(ML, rY, CW, rowH, i % 2 === 0 ? "#f8fafc" : "#ffffff");
      strokeRect(ML, rY, CW, rowH, "#e2e8f0", 0.5);
      let cx = ML;
      cells.forEach((cell, ci) => {
        bodyTxt(cell, cx + 5, rY + 9, aW[ci] - 10, "#334155", 8);
        cx += aW[ci];
      });
      curY = rY + rowH;
    });
    curY += 8;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CASE TIMELINE
  // ═══════════════════════════════════════════════════════════════════════════
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
      const tH = 26;
      ensureSpace(tH + 2);
      const tY = curY;
      fillRect(ML, tY, CW, tH, i % 2 === 0 ? "#f8fafc" : "#ffffff");
      strokeRect(ML, tY, CW, tH, "#e2e8f0", 0.5);
      pg.drawEllipse({
        x: ML + 14,
        y: ly(tY + 13),
        xScale: 4,
        yScale: 4,
        color: col(
          i === 0
            ? "#1e40af"
            : i === timestamps.length - 1
              ? "#16a34a"
              : "#64748b",
        ),
      });
      boldTxt(t.label, ML + 26, tY + 8, CW * 0.38, "#374151", 9);
      bodyTxt(fmt(t.val as string), ML + CW * 0.4, tY + 8, CW * 0.58, "#475569", 9);
      curY = tY + tH;
    });
    curY += 10;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CERTIFICATION + SIGNATURE BLOCK
  // ═══════════════════════════════════════════════════════════════════════════
  ensureSpace(170);
  curY += 12;
  hLine(curY, "#cbd5e1", 1);
  curY += 10;

  const certY = curY;

  boldTxt("CERTIFICATION OF AUTHENTICITY", ML, certY, CW * 0.55, "#374151", 8);
  bodyTxt(
    "This is a certified digital copy of the official case record generated by the Ghana Police Service Digital Case Book System. This document is an accurate representation of all entries made by authorised officers.",
    ML, certY + 14, CW * 0.55, "#64748b", 7.5,
  );

  const dX = ML + CW * 0.6;
  const dW = CW * 0.4;
  boldTxt("DOCUMENT DETAILS", dX, certY, dW, "#374151", 8);
  drawStr(`Generated: ${fmt(new Date())}`, dX, certY + 14, dW, F, 7.5, "#64748b", 0, "right");
  drawStr(`Case Number: ${caseData.caseNumber || "N/A"}`, dX, certY + 25, dW, F, 7.5, "#64748b", 0, "right");
  drawStr(`Status: ${statusLabel(caseData.status)}`, dX, certY + 36, dW, F, 7.5, "#64748b", 0, "right");
  drawStr("CONFIDENTIAL — FOR OFFICIAL USE ONLY", dX, certY + 48, dW, FB, 7, "#dc2626", 0, "right");

  curY = certY + 66;
  hLine(curY);
  curY += 16;

  // Signature blocks (4 across)
  ensureSpace(80);
  const sigW = CW / 4;
  const sigY = curY;
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
    pg.drawLine({
      start: { x: sx + 4, y: ly(sigY + 22) },
      end: { x: sx + sigW - 12, y: ly(sigY + 22) },
      thickness: 0.8,
      color: col("#374151"),
    });
    boldTxt(oObj?.fullName || "_______________", sx + 4, sigY + 26, sigW - 16, "#1e293b", 8);
    bodyTxt(role, sx + 4, sigY + 38, sigW - 16, "#64748b", 7);
    if (oObj?.badgeNumber)
      bodyTxt(`Badge: ${oObj.badgeNumber}`, sx + 4, sigY + 49, sigW - 16, "#94a3b8", 7);
    bodyTxt("Date: _______________", sx + 4, sigY + 60, sigW - 16, "#94a3b8", 7);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // WATERMARK — stamp every page
  // ═══════════════════════════════════════════════════════════════════════════
  const wmText = "CONFIDENTIAL";
  const wmSize = 64;
  const wmW = FB.widthOfTextAtSize(wmText, wmSize);
  for (const wPage of pdfDoc.getPages()) {
    wPage.drawText(wmText, {
      x: (PAGE_W - wmW) / 2,
      y: (PAGE_H - wmSize) / 2,
      font: FB,
      size: wmSize,
      color: rgb(0.612, 0.639, 0.678),
      opacity: 0.07,
      rotate: degrees(-45),
    });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
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
