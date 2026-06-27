import * as React from "react";

interface LoginOtpEmailProps {
  recipientName: string;
  role: string;
  otp: string;
  expiresInMinutes: number;
}

const roleLabel: Record<string, string> = {
  admin: "Administrator",
  nco: "NCO / Station Orderly",
  cid: "Investigator / CID",
  so: "Station Officer",
  dc: "District Commander",
};

export function LoginOtpEmail({
  recipientName,
  role,
  otp,
  expiresInMinutes,
}: LoginOtpEmailProps) {
  return (
    <div
      style={{
        backgroundColor: "#f1f5f9",
        fontFamily:
          "Segoe UI, Helvetica, Arial, sans-serif",
        padding: "32px 0",
      }}
    >
      <div
        style={{
          maxWidth: "480px",
          margin: "0 auto",
          backgroundColor: "#ffffff",
          borderRadius: "12px",
          overflow: "hidden",
          border: "1px solid #e2e8f0",
        }}
      >
        <div
          style={{
            backgroundColor: "#1e3a8a",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              color: "#ffffff",
              fontSize: "18px",
              fontWeight: 700,
              margin: 0,
            }}
          >
            Ghana Police Service
          </p>
          <p
            style={{
              color: "#bfdbfe",
              fontSize: "13px",
              margin: "4px 0 0",
            }}
          >
            Asankragwa Police District — Secure Login
          </p>
        </div>

        <div style={{ padding: "28px 24px" }}>
          <p style={{ fontSize: "15px", color: "#0f172a", marginTop: 0 }}>
            Hello {recipientName},
          </p>
          <p style={{ fontSize: "14px", color: "#475569", lineHeight: 1.6 }}>
            A sign-in attempt was made to the Police Management System for your
            account
            {role ? ` (${roleLabel[role] || role})` : ""}. Use the one-time
            verification code below to complete your login.
          </p>

          <div
            style={{
              backgroundColor: "#f8fafc",
              border: "1px dashed #cbd5e1",
              borderRadius: "10px",
              textAlign: "center",
              padding: "20px",
              margin: "24px 0",
            }}
          >
            <p
              style={{
                fontSize: "11px",
                letterSpacing: "1px",
                color: "#64748b",
                textTransform: "uppercase",
                margin: "0 0 8px",
              }}
            >
              Your verification code
            </p>
            <p
              style={{
                fontSize: "34px",
                fontWeight: 700,
                letterSpacing: "10px",
                color: "#1e3a8a",
                margin: 0,
              }}
            >
              {otp}
            </p>
          </div>

          <p style={{ fontSize: "13px", color: "#475569", lineHeight: 1.6 }}>
            This code expires in{" "}
            <strong>{expiresInMinutes} minutes</strong>. Do not share it with
            anyone. If you did not attempt to sign in, please contact your
            station administrator immediately and change your password.
          </p>
        </div>

        <div
          style={{
            borderTop: "1px solid #e2e8f0",
            padding: "16px 24px",
            backgroundColor: "#f8fafc",
          }}
        >
          <p style={{ fontSize: "11px", color: "#94a3b8", margin: 0 }}>
            CONFIDENTIAL — FOR OFFICIAL USE ONLY · This is an automated message
            from the Digital Police Management System.
          </p>
        </div>
      </div>
    </div>
  );
}
