import { Resend } from "resend";
import * as React from "react";
import { CaseAssignedEmail } from "@/components/emails/CaseAssignedEmail";
import { LoginOtpEmail } from "@/components/emails/LoginOtpEmail";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

interface SendCaseAssignmentEmailParams {
  recipientEmail: string;
  recipientName: string;
  role: string;
  caseNumber: string;
  caseTitle: string;
  caseCategory: string;
  casePriority: string;
  caseDescription: string;
  assignedBy: string;
  caseId: string;
  notes?: string;
}

const roleDashboardPaths: Record<string, string> = {
  nco: "/nco-dashboard",
  cid: "/cid-dashboard",
  so: "/so-dashboard",
  dc: "/dc-dashboard",
};

export async function sendCaseAssignmentEmail(
  params: SendCaseAssignmentEmailParams,
) {
  const {
    recipientEmail,
    recipientName,
    role,
    caseNumber,
    caseTitle,
    caseCategory,
    casePriority,
    caseDescription,
    assignedBy,
    caseId,
    notes,
  } = params;

  const dashboardPath = roleDashboardPaths[role] || "/dashboard";
  const dashboardUrl = `${APP_URL}${dashboardPath}/cases/${caseId}`;

  try {
    const { data, error } = await resend.emails.send({
      from: `Police Management System <${FROM_EMAIL}>`,
      to: [recipientEmail],
      subject: `[${casePriority.toUpperCase()}] Case Assigned: ${caseNumber} — ${caseTitle}`,
      react: React.createElement(CaseAssignedEmail, {
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
      }),
    });

    if (error) {
      console.error("Resend email error:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err) {
    console.error("Failed to send email:", err);
    return { success: false, error: err };
  }
}

interface SendLoginOtpEmailParams {
  recipientEmail: string;
  recipientName: string;
  role: string;
  otp: string;
  expiresInMinutes: number;
}

export async function sendLoginOtpEmail(params: SendLoginOtpEmailParams) {
  const { recipientEmail, recipientName, role, otp, expiresInMinutes } = params;

  try {
    const { data, error } = await resend.emails.send({
      from: `Police Management System <${FROM_EMAIL}>`,
      to: [recipientEmail],
      subject: `Your login verification code: ${otp}`,
      react: React.createElement(LoginOtpEmail, {
        recipientName,
        role,
        otp,
        expiresInMinutes,
      }),
    });

    if (error) {
      console.error("Resend OTP email error:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err) {
    console.error("Failed to send OTP email:", err);
    return { success: false, error: err };
  }
}
