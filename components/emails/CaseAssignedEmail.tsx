import * as React from "react";

interface CaseAssignedEmailProps {
  recipientName: string;
  role: string;
  caseNumber: string;
  caseTitle: string;
  caseCategory: string;
  casePriority: string;
  caseDescription: string;
  assignedBy: string;
  dashboardUrl: string;
  notes?: string;
}

export function CaseAssignedEmail({
  recipientName,
  role,
  caseNumber,
  caseTitle,
  caseCategory,
  casePriority,
  caseDescription,
  assignedBy,
  dashboardUrl,
  notes,
}: CaseAssignedEmailProps) {
  const priorityColor =
    casePriority === "Felony"
      ? "#dc2626"
      : casePriority === "Misdemeanour"
        ? "#d97706"
        : "#2563eb";

  const roleLabel: Record<string, string> = {
    nco: "NCO / Station Orderly",
    cid: "Investigator / CID",
    so: "Station Officer",
    dc: "District Commander",
  };

  return (
    <div
      style={{
        fontFamily: "'Georgia', 'Times New Roman', serif",
        backgroundColor: "#0f172a",
        minHeight: "100vh",
        padding: "0",
        margin: "0",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)",
          borderBottom: "3px solid #3b82f6",
          padding: "32px 40px",
          textAlign: "center" as const,
        }}
      >
        <div
          style={{
            display: "inline-block",
            backgroundColor: "#1e3a5f",
            border: "1px solid #3b82f6",
            borderRadius: "4px",
            padding: "6px 16px",
            marginBottom: "16px",
          }}
        >
          <span
            style={{
              color: "#93c5fd",
              fontSize: "11px",
              letterSpacing: "3px",
              fontFamily: "'Courier New', monospace",
              fontWeight: "bold",
            }}
          >
            CLASSIFIED — OFFICIAL USE ONLY
          </span>
        </div>
        <div style={{ marginBottom: "8px" }}>
          <span
            style={{
              fontSize: "28px",
              fontWeight: "bold",
              color: "#f8fafc",
              letterSpacing: "1px",
            }}
          >
            ⚖ POLICE MANAGEMENT SYSTEM
          </span>
        </div>
        <p
          style={{
            color: "#94a3b8",
            fontSize: "13px",
            margin: "0",
            letterSpacing: "2px",
            fontFamily: "'Courier New', monospace",
          }}
        >
          CASE ASSIGNMENT NOTIFICATION
        </p>
      </div>

      {/* Body */}
      <div style={{ padding: "40px", maxWidth: "600px", margin: "0 auto" }}>
        {/* Greeting */}
        <div style={{ marginBottom: "32px" }}>
          <p
            style={{
              color: "#cbd5e1",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0 0 8px 0",
            }}
          >
            Dear <strong style={{ color: "#f8fafc" }}>{recipientName}</strong>,
          </p>
          <p
            style={{
              color: "#94a3b8",
              fontSize: "14px",
              margin: "0",
              fontFamily: "'Courier New', monospace",
            }}
          >
            Role: {roleLabel[role] || role}
          </p>
        </div>

        <p
          style={{
            color: "#cbd5e1",
            fontSize: "15px",
            lineHeight: "1.7",
            marginBottom: "32px",
          }}
        >
          A case has been assigned to you and requires your immediate attention.
          Please review the case details below and take the appropriate action
          through the Police Management System.
        </p>

        {/* Case Details Card */}
        <div
          style={{
            backgroundColor: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "8px",
            overflow: "hidden",
            marginBottom: "32px",
          }}
        >
          {/* Card Header */}
          <div
            style={{
              backgroundColor: "#1e3a5f",
              borderBottom: "1px solid #334155",
              padding: "16px 24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{
                color: "#93c5fd",
                fontFamily: "'Courier New', monospace",
                fontSize: "13px",
                letterSpacing: "1px",
                fontWeight: "bold",
              }}
            >
              {caseNumber}
            </span>
            <span
              style={{
                backgroundColor: priorityColor,
                color: "#fff",
                fontSize: "11px",
                fontWeight: "bold",
                padding: "3px 10px",
                borderRadius: "3px",
                letterSpacing: "1px",
                fontFamily: "'Courier New', monospace",
              }}
            >
              {casePriority.toUpperCase()}
            </span>
          </div>

          {/* Card Body */}
          <div style={{ padding: "24px" }}>
            <h2
              style={{
                color: "#f8fafc",
                fontSize: "18px",
                fontWeight: "bold",
                margin: "0 0 16px 0",
              }}
            >
              {caseTitle}
            </h2>

            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginBottom: "16px",
              }}
            >
              <tbody>
                <tr>
                  <td
                    style={{
                      color: "#64748b",
                      fontSize: "12px",
                      fontFamily: "'Courier New', monospace",
                      letterSpacing: "1px",
                      padding: "6px 0",
                      width: "130px",
                    }}
                  >
                    CATEGORY
                  </td>
                  <td
                    style={{
                      color: "#cbd5e1",
                      fontSize: "14px",
                      padding: "6px 0",
                      textTransform: "capitalize" as const,
                    }}
                  >
                    {caseCategory}
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      color: "#64748b",
                      fontSize: "12px",
                      fontFamily: "'Courier New', monospace",
                      letterSpacing: "1px",
                      padding: "6px 0",
                    }}
                  >
                    ASSIGNED BY
                  </td>
                  <td
                    style={{
                      color: "#cbd5e1",
                      fontSize: "14px",
                      padding: "6px 0",
                    }}
                  >
                    {assignedBy}
                  </td>
                </tr>
              </tbody>
            </table>

            <div
              style={{
                borderTop: "1px solid #334155",
                paddingTop: "16px",
                marginTop: "8px",
              }}
            >
              <p
                style={{
                  color: "#64748b",
                  fontSize: "12px",
                  fontFamily: "'Courier New', monospace",
                  letterSpacing: "1px",
                  margin: "0 0 8px 0",
                }}
              >
                DESCRIPTION
              </p>
              <p
                style={{
                  color: "#94a3b8",
                  fontSize: "14px",
                  lineHeight: "1.6",
                  margin: "0",
                }}
              >
                {caseDescription}
              </p>
            </div>

            {notes && (
              <div
                style={{
                  borderTop: "1px solid #334155",
                  paddingTop: "16px",
                  marginTop: "16px",
                  backgroundColor: "#0f172a",
                  borderRadius: "4px",
                  padding: "12px 16px",
                }}
              >
                <p
                  style={{
                    color: "#f59e0b",
                    fontSize: "12px",
                    fontFamily: "'Courier New', monospace",
                    letterSpacing: "1px",
                    margin: "0 0 8px 0",
                  }}
                >
                  ⚠ NOTE FROM ASSIGNING OFFICER
                </p>
                <p
                  style={{
                    color: "#fbbf24",
                    fontSize: "14px",
                    lineHeight: "1.6",
                    margin: "0",
                    fontStyle: "italic",
                  }}
                >
                  {notes}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* CTA Button */}
        <div style={{ textAlign: "center" as const, marginBottom: "40px" }}>
          <a
            href={dashboardUrl}
            style={{
              display: "inline-block",
              backgroundColor: "#2563eb",
              color: "#ffffff",
              textDecoration: "none",
              padding: "14px 40px",
              borderRadius: "4px",
              fontSize: "14px",
              fontWeight: "bold",
              letterSpacing: "2px",
              fontFamily: "'Courier New', monospace",
              border: "1px solid #3b82f6",
            }}
          >
            ACCESS CASE DASHBOARD →
          </a>
        </div>

        {/* Warning */}
        <div
          style={{
            backgroundColor: "#1e293b",
            border: "1px solid #475569",
            borderLeft: "3px solid #ef4444",
            borderRadius: "4px",
            padding: "16px 20px",
            marginBottom: "32px",
          }}
        >
          <p
            style={{
              color: "#94a3b8",
              fontSize: "13px",
              lineHeight: "1.6",
              margin: "0",
            }}
          >
            <strong style={{ color: "#f87171" }}>
              CONFIDENTIALITY NOTICE:
            </strong>{" "}
            This email and the information contained herein are strictly
            confidential and intended solely for the named recipient. Any
            unauthorized review, use, disclosure, or distribution is prohibited.
          </p>
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: "1px solid #1e293b",
            paddingTop: "24px",
            textAlign: "center" as const,
          }}
        >
          <p
            style={{
              color: "#475569",
              fontSize: "12px",
              margin: "0 0 4px 0",
              fontFamily: "'Courier New', monospace",
              letterSpacing: "1px",
            }}
          >
            POLICE MANAGEMENT SYSTEM — AUTOMATED NOTIFICATION
          </p>
          <p
            style={{
              color: "#334155",
              fontSize: "11px",
              margin: "0",
            }}
          >
            Do not reply to this email. Contact your supervisor for assistance.
          </p>
        </div>
      </div>
    </div>
  );
}
