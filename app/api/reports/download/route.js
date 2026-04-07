import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { verifyToken } from "@/utils/jwt";
import Case from "@/models/Case";
import Personnel from "@/models/Personnel";
import RifleBooking from "@/models/RifleBooking";
import jsPDF from "jspdf";

export async function POST(request) {
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

    const { type, dateRange } = await request.json();
    const { from, to } = dateRange;

    const dateFilter = {
      createdAt: {
        $gte: new Date(from),
        $lte: new Date(to),
      },
    };

    let data = [];
    let reportTitle = "";
    const filename = `${type}-report-${
      new Date().toISOString().split("T")[0]
    }.pdf`;

    switch (type) {
      case "cases":
        data = await Case.find(dateFilter).populate(
          "assignedOfficer",
          "firstName lastName",
        );
        reportTitle = "Cases Report";
        break;
      case "personnel":
        data = await Personnel.find(dateFilter).populate(
          "user",
          "firstName lastName",
        );
        reportTitle = "Personnel Report";
        break;
      case "rifle-bookings":
        data = await RifleBooking.find(dateFilter);
        reportTitle = "Rifle Bookings Report";
        break;
      default:
        return NextResponse.json(
          { error: "Invalid report type" },
          { status: 400 },
        );
    }

    // Create PDF using jsPDF with cross-browser compatibility
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    // Set up the document with safe font handling
    try {
      doc.setFont("helvetica", "bold");
    } catch (e) {
      // Fallback to default font if helvetica is not available
      console.warn("Helvetica font not available, using default");
    }

    doc.setFontSize(20);
    doc.text(reportTitle, 20, 30);

    doc.setFontSize(12);
    try {
      doc.setFont("helvetica", "normal");
    } catch (e) {
      // Fallback for font issues
    }

    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 45);
    doc.text(
      `Period: ${new Date(from).toLocaleDateString()} - ${new Date(
        to,
      ).toLocaleDateString()}`,
      20,
      55,
    );

    let yPosition = 75;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;

    if (type === "cases") {
      doc.setFontSize(14);
      try {
        doc.setFont("helvetica", "bold");
      } catch (e) {
        // Fallback
      }
      doc.text("Cases Summary", margin, yPosition);
      yPosition += 15;

      doc.setFontSize(10);
      try {
        doc.setFont("helvetica", "normal");
      } catch (e) {
        // Fallback
      }

      data.forEach((item, index) => {
        if (yPosition > pageHeight - 50) {
          doc.addPage();
          yPosition = 30;
        }

        const caseText = [
          `${index + 1}. Case: ${item.caseNumber || "N/A"}`,
          `   Title: ${item.title || "N/A"}`,
          `   Status: ${item.status || "N/A"}`,
          `   Category: ${item.category || "N/A"}`,
          `   Date: ${
            item.createdAt ? item.createdAt.toLocaleDateString() : "N/A"
          }`,
        ];

        if (item.assignedOfficer) {
          caseText.push(
            `   Officer: ${item.assignedOfficer.firstName || ""} ${
              item.assignedOfficer.lastName || ""
            }`,
          );
        }

        caseText.forEach((line) => {
          // Ensure text fits within page width
          const textWidth = doc.getTextWidth(line);
          const maxWidth = doc.internal.pageSize.width - margin * 2;

          if (textWidth > maxWidth) {
            const splitText = doc.splitTextToSize(line, maxWidth);
            splitText.forEach((splitLine) => {
              doc.text(splitLine, margin, yPosition);
              yPosition += 8;
            });
          } else {
            doc.text(line, margin, yPosition);
            yPosition += 8;
          }
        });

        yPosition += 5;
      });

      // Add summary statistics
      if (yPosition > pageHeight - 80) {
        doc.addPage();
        yPosition = 30;
      }

      yPosition += 10;
      try {
        doc.setFont("helvetica", "bold");
      } catch (e) {
        // Fallback
      }
      doc.text("Summary Statistics:", margin, yPosition);
      yPosition += 10;

      try {
        doc.setFont("helvetica", "normal");
      } catch (e) {
        // Fallback
      }
      doc.text(`Total Cases: ${data.length}`, margin, yPosition);
      yPosition += 8;

      const statusCounts = data.reduce((acc, item) => {
        acc[item.status || "Unknown"] =
          (acc[item.status || "Unknown"] || 0) + 1;
        return acc;
      }, {});

      Object.entries(statusCounts).forEach(([status, count]) => {
        doc.text(`${status}: ${count}`, margin + 10, yPosition);
        yPosition += 8;
      });
    } else if (type === "personnel") {
      doc.setFontSize(14);
      try {
        doc.setFont("helvetica", "bold");
      } catch (e) {
        // Fallback
      }
      doc.text("Personnel Summary", margin, yPosition);
      yPosition += 15;

      doc.setFontSize(10);
      try {
        doc.setFont("helvetica", "normal");
      } catch (e) {
        // Fallback
      }

      data.forEach((item, index) => {
        if (yPosition > pageHeight - 50) {
          doc.addPage();
          yPosition = 30;
        }

        const personnelText = [
          `${index + 1}. Employee ID: ${item.employeeId || "N/A"}`,
          `   Name: ${item.user?.firstName || "N/A"} ${
            item.user?.lastName || ""
          }`,
          `   Rank: ${item.rank || "N/A"}`,
          `   Specialization: ${item.specialization || "N/A"}`,
          `   Status: ${item.status || "N/A"}`,
          `   Date Joined: ${
            item.dateJoined ? item.dateJoined.toLocaleDateString() : "N/A"
          }`,
        ];

        personnelText.forEach((line) => {
          const textWidth = doc.getTextWidth(line);
          const maxWidth = doc.internal.pageSize.width - margin * 2;

          if (textWidth > maxWidth) {
            const splitText = doc.splitTextToSize(line, maxWidth);
            splitText.forEach((splitLine) => {
              doc.text(splitLine, margin, yPosition);
              yPosition += 8;
            });
          } else {
            doc.text(line, margin, yPosition);
            yPosition += 8;
          }
        });

        yPosition += 5;
      });

      // Add summary statistics
      if (yPosition > pageHeight - 80) {
        doc.addPage();
        yPosition = 30;
      }

      yPosition += 10;
      try {
        doc.setFont("helvetica", "bold");
      } catch (e) {
        // Fallback
      }
      doc.text("Summary Statistics:", margin, yPosition);
      yPosition += 10;

      try {
        doc.setFont("helvetica", "normal");
      } catch (e) {
        // Fallback
      }
      doc.text(`Total Personnel: ${data.length}`, margin, yPosition);
      yPosition += 8;

      const rankCounts = data.reduce((acc, item) => {
        acc[item.rank || "Unknown"] = (acc[item.rank || "Unknown"] || 0) + 1;
        return acc;
      }, {});

      Object.entries(rankCounts).forEach(([rank, count]) => {
        doc.text(`${rank}: ${count}`, margin + 10, yPosition);
        yPosition += 8;
      });
    } else if (type === "rifle-bookings") {
      doc.setFontSize(14);
      try {
        doc.setFont("helvetica", "bold");
      } catch (e) {
        // Fallback
      }
      doc.text("Rifle Bookings Summary", margin, yPosition);
      yPosition += 15;

      doc.setFontSize(10);
      try {
        doc.setFont("helvetica", "normal");
      } catch (e) {
        // Fallback
      }

      data.forEach((item, index) => {
        if (yPosition > pageHeight - 50) {
          doc.addPage();
          yPosition = 30;
        }

        const bookingText = [
          `${index + 1}. Booking: ${item.bookingNumber || "N/A"}`,
          `   Personnel: ${item.nameOfPersonnel || "N/A"}`,
          `   Rifle Type: ${item.typeOfRifle || "N/A"}`,
          `   Rifle Number: ${item.rifleNumber || "N/A"}`,
          `   Serial Number: ${item.serialNumber || "N/A"}`,
          `   Status: ${item.status || "N/A"}`,
          `   Booking Date: ${
            item.dateOfBooking
              ? new Date(item.dateOfBooking).toLocaleDateString()
              : "N/A"
          }`,
          `   Return Date: ${
            item.returnDate
              ? new Date(item.returnDate).toLocaleDateString()
              : "Not returned yet"
          }`,
          `   Duty Type: ${item.typeOfDuty || "N/A"}`,
        ];

        bookingText.forEach((line) => {
          const textWidth = doc.getTextWidth(line);
          const maxWidth = doc.internal.pageSize.width - margin * 2;

          if (textWidth > maxWidth) {
            const splitText = doc.splitTextToSize(line, maxWidth);
            splitText.forEach((splitLine) => {
              doc.text(splitLine, margin, yPosition);
              yPosition += 8;
            });
          } else {
            doc.text(line, margin, yPosition);
            yPosition += 8;
          }
        });

        yPosition += 5;
      });

      // Add summary statistics
      if (yPosition > pageHeight - 80) {
        doc.addPage();
        yPosition = 30;
      }

      yPosition += 10;
      try {
        doc.setFont("helvetica", "bold");
      } catch (e) {
        // Fallback
      }
      doc.text("Summary Statistics:", margin, yPosition);
      yPosition += 10;

      try {
        doc.setFont("helvetica", "normal");
      } catch (e) {
        // Fallback
      }
      doc.text(`Total Bookings: ${data.length}`, margin, yPosition);
      yPosition += 8;

      const statusCounts = data.reduce((acc, item) => {
        acc[item.status || "Unknown"] =
          (acc[item.status || "Unknown"] || 0) + 1;
        return acc;
      }, {});

      Object.entries(statusCounts).forEach(([status, count]) => {
        doc.text(`${status}: ${count}`, margin + 10, yPosition);
        yPosition += 8;
      });

      const rifleTypeCounts = data.reduce((acc, item) => {
        acc[item.typeOfRifle || "Unknown"] =
          (acc[item.typeOfRifle || "Unknown"] || 0) + 1;
        return acc;
      }, {});

      yPosition += 5;
      doc.text("By Rifle Type:", margin, yPosition);
      yPosition += 8;

      Object.entries(rifleTypeCounts).forEach(([type, count]) => {
        doc.text(`${type}: ${count}`, margin + 10, yPosition);
        yPosition += 8;
      });
    }

    // Generate PDF with error handling
    let pdfBuffer;
    try {
      pdfBuffer = Buffer.from(doc.output("arraybuffer"));
    } catch (error) {
      console.error("PDF generation error:", error);
      // Fallback to base64 output
      const pdfBase64 = doc.output("datauristring");
      const base64Data = pdfBase64.split(",")[1];
      pdfBuffer = Buffer.from(base64Data, "base64");
    }

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Report download error:", error);
    return NextResponse.json(
      { error: "Failed to download report" },
      { status: 500 },
    );
  }
}
