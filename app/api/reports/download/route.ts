// src/app/api/reports/download/route.ts

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Case from "@/models/Case";
import Personnel from "@/models/Personnel";
import RifleBooking from "@/models/RifleBooking";
import jsPDF from "jspdf";
import { verifyToken } from "@/lib/jwt";
import type { ReportType } from "@/app/api/reports/generate/route";

// ─── Types ──────────────────────────────────────────────────────────────────

interface DownloadReportBody {
  type: ReportType;
  dateRange: { from: string; to: string };
}

// ─── PDF helpers ─────────────────────────────────────────────────────────────

function setFont(doc: jsPDF, style: "bold" | "normal"): void {
  try {
    doc.setFont("helvetica", style);
  } catch {
    // helvetica unavailable — silently fall through to jsPDF default
  }
}

/**
 * Write a line of text with automatic word-wrapping and page overflow handling.
 * Returns the updated `yPosition`.
 */
function writeLine(
  doc: jsPDF,
  text: string,
  yPosition: number,
  margin: number,
  lineHeight = 8,
): number {
  const pageHeight = doc.internal.pageSize.height;
  const maxWidth = doc.internal.pageSize.width - margin * 2;

  if (yPosition > pageHeight - 50) {
    doc.addPage();
    yPosition = 30;
  }

  const textWidth = doc.getTextWidth(text);
  if (textWidth > maxWidth) {
    const lines = doc.splitTextToSize(text, maxWidth) as string[];
    lines.forEach((line: string) => {
      doc.text(line, margin, yPosition);
      yPosition += lineHeight;
    });
  } else {
    doc.text(text, margin, yPosition);
    yPosition += lineHeight;
  }

  return yPosition;
}

function addSectionHeader(
  doc: jsPDF,
  title: string,
  y: number,
  margin: number,
): number {
  if (y > doc.internal.pageSize.height - 80) {
    doc.addPage();
    y = 30;
  }
  doc.setFontSize(14);
  setFont(doc, "bold");
  doc.text(title, margin, y);
  return y + 15;
}

function addSummaryStats(
  doc: jsPDF,
  label: string,
  counts: Record<string, number>,
  y: number,
  margin: number,
): number {
  if (y > doc.internal.pageSize.height - 80) {
    doc.addPage();
    y = 30;
  }

  y += 10;
  doc.setFontSize(11);
  setFont(doc, "bold");
  doc.text("Summary Statistics:", margin, y);
  y += 10;

  doc.setFontSize(10);
  setFont(doc, "normal");
  doc.text(`${label}: ${Object.values(counts).reduce((a, b) => a + b, 0)}`, margin, y);
  y += 8;

  Object.entries(counts).forEach(([key, count]) => {
    doc.text(`${key}: ${count}`, margin + 10, y);
    y += 8;
  });

  return y;
}

// ─── POST handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await connectDB();

    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const body: DownloadReportBody = await request.json();
    const { type, dateRange } = body;
    const { from, to } = dateRange;

    const dateFilter = {
      createdAt: {
        $gte: new Date(from),
        $lte: new Date(to),
      },
    };

    // ── Fetch data ─────────────────────────────────────────────────────────

    type DataItem = Record<string, unknown>;
    let data: DataItem[] = [];
    let reportTitle = "";

    switch (type) {
      case "cases":
        data = (await Case.find(dateFilter)
          .populate("assignedOfficer", "firstName lastName")
          .lean()) as DataItem[];
        reportTitle = "Cases Report";
        break;

      case "personnel":
        data = (await Personnel.find(dateFilter).lean()) as unknown as DataItem[];
        reportTitle = "Personnel Report";
        break;

      case "incidents":
        data = (await Case.find({
          ...dateFilter,
          category: { $in: ["assault", "theft", "domestic", "other"] },
        }).lean()) as DataItem[];
        reportTitle = "Incidents Report";
        break;

      case "performance":
        data = (await Case.find(dateFilter).lean()) as DataItem[];
        reportTitle = "Performance Report";
        break;

      case "rifle-bookings":
        data = (await RifleBooking.find(dateFilter).lean()) as unknown as DataItem[];
        reportTitle = "Rifle Bookings Report";
        break;

      default:
        return NextResponse.json(
          { error: "Invalid report type" },
          { status: 400 },
        );
    }

    // ── Build PDF ──────────────────────────────────────────────────────────

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const margin = 20;
    const lineHeight = 8;

    // Cover section
    setFont(doc, "bold");
    doc.setFontSize(20);
    doc.text(reportTitle, margin, 30);

    setFont(doc, "normal");
    doc.setFontSize(12);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, margin, 45);
    doc.text(
      `Period: ${new Date(from).toLocaleDateString()} – ${new Date(to).toLocaleDateString()}`,
      margin,
      55,
    );
    doc.text(`Total records: ${data.length}`, margin, 65);

    let y = 80;

    // ── Cases / Incidents / Performance ───────────────────────────────────

    if (type === "cases" || type === "incidents" || type === "performance") {
      y = addSectionHeader(doc, `${reportTitle} – Detail`, y, margin);
      doc.setFontSize(10);
      setFont(doc, "normal");

      data.forEach((item, index) => {
        const officer = item.assignedOfficer as
          | { firstName?: string; lastName?: string }
          | undefined;

        const lines: string[] = [
          `${index + 1}. Case: ${(item.caseNumber as string) ?? "N/A"}`,
          `   Title: ${(item.title as string) ?? "N/A"}`,
          `   Status: ${(item.status as string) ?? "N/A"}`,
          `   Category: ${(item.category as string) ?? "N/A"}`,
          `   Priority: ${(item.priority as string) ?? "N/A"}`,
          `   Location: ${(item.location as string) ?? "N/A"}`,
          `   Date: ${item.createdAt ? new Date(item.createdAt as string).toLocaleDateString() : "N/A"}`,
        ];

        if (officer) {
          lines.push(
            `   Officer: ${officer.firstName ?? ""} ${officer.lastName ?? ""}`.trim(),
          );
        }

        lines.forEach((line) => {
          y = writeLine(doc, line, y, margin, lineHeight);
        });
        y += 5;
      });

      const statusCounts = data.reduce<Record<string, number>>((acc, item) => {
        const key = (item.status as string) ?? "Unknown";
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {});

      y = addSummaryStats(doc, "Total Cases", statusCounts, y, margin);
    }

    // ── Personnel ─────────────────────────────────────────────────────────

    if (type === "personnel") {
      y = addSectionHeader(doc, "Personnel – Detail", y, margin);
      doc.setFontSize(10);
      setFont(doc, "normal");

      data.forEach((item, index) => {
        const lines: string[] = [
          `${index + 1}. Name: ${(item.firstName as string) ?? "N/A"} ${(item.lastName as string) ?? ""}`,
          `   Badge: ${(item.badgeNumber as string) ?? "N/A"}`,
          `   Rank: ${(item.rank as string) ?? "N/A"}`,
          `   Specialization: ${(item.specialization as string) ?? "N/A"}`,
          `   Shift: ${(item.shift as string) ?? "N/A"}`,
          `   Status: ${(item.status as string) ?? "N/A"}`,
          `   Date Joined: ${item.dateJoined ? new Date(item.dateJoined as string).toLocaleDateString() : "N/A"}`,
        ];

        lines.forEach((line) => {
          y = writeLine(doc, line, y, margin, lineHeight);
        });
        y += 5;
      });

      const rankCounts = data.reduce<Record<string, number>>((acc, item) => {
        const key = (item.rank as string) ?? "Unknown";
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {});

      y = addSummaryStats(doc, "Total Personnel", rankCounts, y, margin);
    }

    // ── Rifle Bookings ────────────────────────────────────────────────────

    if (type === "rifle-bookings") {
      y = addSectionHeader(doc, "Rifle Bookings – Detail", y, margin);
      doc.setFontSize(10);
      setFont(doc, "normal");

      data.forEach((item, index) => {
        const returnDetails = item.weaponReturn as
          | { returnDate?: string }
          | undefined;

        const lines: string[] = [
          `${index + 1}. Booking: ${(item.bookingNumber as string) ?? "N/A"}`,
          `   Personnel: ${(item.nameOfPersonnel as string) ?? "N/A"}`,
          `   Rifle Type: ${(item.typeOfRifle as string) ?? "N/A"}`,
          `   Rifle Number: ${(item.rifleNumber as string) ?? "N/A"}`,
          `   Serial Number: ${(item.serialNumber as string) ?? "N/A"}`,
          `   SD Number: ${(item.sdNumber as string) ?? "N/A"}`,
          `   Ammunition Type: ${(item.ammunitionType as string) ?? "N/A"}`,
          `   Ammunition Count: ${(item.numberOfAmmunition as number) ?? "N/A"}`,
          `   Duty Type: ${(item.typeOfDuty as string) ?? "N/A"}`,
          `   Issued By: ${(item.issuedBy as string) ?? "N/A"}`,
          `   Status: ${(item.status as string) ?? "N/A"}`,
          `   Booking Date: ${item.dateOfBooking ? new Date(item.dateOfBooking as string).toLocaleDateString() : "N/A"}`,
          `   Return Date: ${returnDetails?.returnDate ? new Date(returnDetails.returnDate).toLocaleDateString() : "Not returned yet"}`,
        ];

        lines.forEach((line) => {
          y = writeLine(doc, line, y, margin, lineHeight);
        });
        y += 5;
      });

      const statusCounts = data.reduce<Record<string, number>>((acc, item) => {
        const key = (item.status as string) ?? "Unknown";
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {});

      const rifleTypeCounts = data.reduce<Record<string, number>>(
        (acc, item) => {
          const key = (item.typeOfRifle as string) ?? "Unknown";
          acc[key] = (acc[key] ?? 0) + 1;
          return acc;
        },
        {},
      );

      y = addSummaryStats(doc, "Total Bookings", statusCounts, y, margin);

      y += 5;
      doc.setFontSize(10);
      setFont(doc, "bold");
      doc.text("By Rifle Type:", margin, y);
      y += 8;
      setFont(doc, "normal");
      Object.entries(rifleTypeCounts).forEach(([rifleType, count]) => {
        doc.text(`${rifleType}: ${count}`, margin + 10, y);
        y += 8;
      });
    }

    // ── Serialise ──────────────────────────────────────────────────────────

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = Buffer.from(doc.output("arraybuffer"));
    } catch (pdfError) {
      console.error("[reports/download] arraybuffer fallback:", pdfError);
      const base64 = (doc.output("datauristring") as string).split(",")[1];
      pdfBuffer = Buffer.from(base64, "base64");
    }

    const filename = `${type}-report-${new Date().toISOString().split("T")[0]}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("[reports/download]", error);
    return NextResponse.json(
      { error: "Failed to download report" },
      { status: 500 },
    );
  }
}