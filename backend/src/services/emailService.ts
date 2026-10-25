
import nodemailer from "nodemailer";

// =====================================================
// VaultBank — Email Service
// Purpose: Send login OTP verification emails
// File: backend/src/services/emailService.ts
// =====================================================

// Read SMTP configuration from backend/.env
const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

// Validate SMTP configuration
if (!smtpHost || !smtpUser || !smtpPass) {
  console.warn(
    "VaultBank Email Service: SMTP is not fully configured. " +
      "Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in .env."
  );
}

// Create Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: smtpHost || "smtp.gmail.com",
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
});

// Send login OTP email
export async function sendLoginOtp(
  recipientEmail: string,
  otp: string
): Promise<void> {
  // Prevent attempts to send email without SMTP credentials
  if (!smtpHost || !smtpUser || !smtpPass) {
    throw new Error(
      "Email service is not configured. Check SMTP settings in backend/.env."
    );
  }

  // Validate basic inputs
  if (!recipientEmail || !recipientEmail.trim()) {
    throw new Error("Recipient email is required.");
  }

  if (!/^\d{6}$/.test(otp)) {
    throw new Error("OTP must be a six-digit code.");
  }

  const mailOptions = {
    from: `"VaultBank Security" <${smtpUser}>`,
    to: recipientEmail,
    subject: "Your VaultBank login verification code",

    text: [
      "Hello,",
      "",
      "A login verification code was requested for your VaultBank account.",
      "",
      `Your verification code is: ${otp}`,
      "",
      "This code expires in 5 minutes.",
      "Do not share this code with anyone.",
      "If you did not attempt to log in, you can ignore this email.",
      "",
      "VaultBank Security",
    ].join("\n"),

    html: `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>VaultBank Login Verification</title>
        </head>

        <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
          <div style="max-width:480px;margin:32px auto;padding:24px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;">
            <div style="text-align:center;margin-bottom:24px;">
              <h1 style="margin:0;color:#059669;font-size:26px;">
                VaultBank
              </h1>
              <p style="margin:8px 0 0;color:#6b7280;font-size:13px;">
                Secure Banking
              </p>
            </div>

            <h2 style="color:#111827;font-size:20px;">
              Verify your login
            </h2>

            <p style="color:#4b5563;font-size:15px;line-height:1.6;">
              Use the verification code below to complete your VaultBank login.
            </p>

            <div style="padding:20px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;text-align:center;margin:24px 0;">
              <div style="font-size:12px;color:#047857;margin-bottom:8px;">
                YOUR VERIFICATION CODE
              </div>

              <div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#065f46;">
                ${otp}
              </div>
            </div>

            <p style="color:#4b5563;font-size:14px;line-height:1.6;">
              This code expires in <strong>5 minutes</strong>.
              For your security, do not share it with anyone.
            </p>

            <p style="color:#6b7280;font-size:13px;line-height:1.6;">
              If you did not attempt to log in, ignore this email and consider
              changing your password if you suspect unauthorized access.
            </p>

            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />

            <p style="margin:0;text-align:center;color:#9ca3af;font-size:12px;">
              VaultBank Security Team
            </p>
          </div>
        </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.info(`VaultBank login OTP email sent to ${recipientEmail}.`);
  } catch (error) {
    console.error("VaultBank failed to send login OTP email:", error);
    throw new Error("Failed to send login verification email.");
  }
}



export async function sendAccountOpenedEmail(
  recipientEmail: string,
  customerName: string,
  accountDetails: {
    accountNumber: string;
    accountType: string;
    balancePaise: number;
    openingDate: Date;
  }
): Promise<void> {
  if (!smtpHost || !smtpUser || !smtpPass) {
    throw new Error(
      "Email service is not configured. Check SMTP settings in backend/.env."
    );
  }

  if (!recipientEmail || !recipientEmail.trim()) {
    throw new Error("Recipient email is required.");
  }

  // Escape user-controlled text before placing it in HTML.
  const escapeHtml = (value: string): string =>
    value.replace(/[&<>"']/g, (character) => {
      const entities: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return entities[character];
    });

  const safeName = escapeHtml(customerName || "Customer");
  const safeAccountNumber = escapeHtml(accountDetails.accountNumber);
  const safeAccountType = escapeHtml(accountDetails.accountType);
  const formattedDate = accountDetails.openingDate.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    }
  );

  const openingDeposit = (accountDetails.balancePaise / 100).toLocaleString(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
    }
  );

  const mailOptions = {
    from: `"VaultBank" <${smtpUser}>`,
    to: recipientEmail,
    subject: "Your VaultBank account is now open",
    text: [
      `Hello ${customerName || "Customer"},`,
      "",
      "Your VaultBank account-opening application has been approved.",
      "",
      `Account type: ${accountDetails.accountType}`,
      `Account number: ${accountDetails.accountNumber}`,
      `Opening date: ${formattedDate}`,
      `Opening deposit: ${openingDeposit}`,
      "",
      "Please keep your account details secure.",
      "Thank you for choosing VaultBank.",
      "",
      "VaultBank Team",
    ].join("\n"),
    html: `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Your VaultBank Account</title>
        </head>
        <body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
          <div style="max-width:520px;margin:0 auto;padding:28px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">
            <h1 style="margin:0;color:#059669;text-align:center;">VaultBank</h1>
            <p style="text-align:center;color:#6b7280;">Secure Banking</p>
            <h2 style="color:#111827;">Your account is open!</h2>
            <p style="color:#4b5563;line-height:1.6;">
              Hello ${safeName}, your account-opening application has been approved.
              Your new bank account is ready.
            </p>
            <div style="padding:20px;background:#ecfdf5;border-radius:8px;">
              <p style="margin:8px 0;color:#065f46;">
                <strong>Account type:</strong> ${safeAccountType}
              </p>
              <p style="margin:8px 0;color:#065f46;">
                <strong>Account number:</strong> ${safeAccountNumber}
              </p>
              <p style="margin:8px 0;color:#065f46;">
                <strong>Opening date:</strong> ${formattedDate}
              </p>
              <p style="margin:8px 0;color:#065f46;">
                <strong>Opening deposit:</strong> ${openingDeposit}
              </p>
            </div>
            <p style="color:#4b5563;line-height:1.6;">
              Keep your account details secure. If you have questions, please contact
              your bank through its official support channel.
            </p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
            <p style="text-align:center;color:#9ca3af;font-size:12px;">
              VaultBank Team
            </p>
          </div>
        </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.info(
      `VaultBank account-opening email sent to ${recipientEmail}.`
    );
  } catch (error) {
    console.error("VaultBank account-opening email failed:", error);
    throw new Error("Failed to send account-opening confirmation email.");
  }
}



export async function sendLoanDecisionEmail(
  recipientEmail: string,
  customerName: string,
  loanDetails: {
    loanType: string;
    amountPaise: number;
    status: "approved" | "rejected";
    reviewNotes: string;
    tenureMonths: number;
    emiPaise: number;
  }
): Promise<void> {
  if (!smtpHost || !smtpUser || !smtpPass) {
    throw new Error(
      "Email service is not configured. Check SMTP settings in backend/.env."
    );
  }

  if (!recipientEmail?.trim()) {
    throw new Error("Recipient email is required.");
  }

  const escapeHtml = (value: string): string =>
    value.replace(/[&<>"']/g, (character) => {
      const entities: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return entities[character];
    });

  const safeName = escapeHtml(customerName || "Customer");
  const safeLoanType = escapeHtml(loanDetails.loanType);
  const safeNotes = escapeHtml(loanDetails.reviewNotes);
  const approved = loanDetails.status === "approved";

  const amount = (loanDetails.amountPaise / 100).toLocaleString(
    "en-IN",
    { style: "currency", currency: "INR" }
  );

  const emi = (loanDetails.emiPaise / 100).toLocaleString(
    "en-IN",
    { style: "currency", currency: "INR" }
  );

  const decision = approved ? "Approved" : "Rejected";

  const text = [
    `Hello ${customerName || "Customer"},`,
    "",
    `Your VaultBank ${loanDetails.loanType} loan application has been ${decision.toLowerCase()}.`,
    "",
    `Loan amount: ${amount}`,
    `Loan tenure: ${loanDetails.tenureMonths} months`,
    ...(approved ? [`Monthly EMI: ${emi}`] : []),
    `Review remarks: ${loanDetails.reviewNotes}`,
    "",
    "Thank you for choosing VaultBank.",
    "VaultBank Team",
  ].join("\n");

  const mailOptions = {
    from: `"VaultBank" <${smtpUser}>`,
    to: recipientEmail,
    subject: `VaultBank Loan Application ${decision}`,
    text,
    html: `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Loan Application ${decision}</title>
        </head>
        <body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
          <div style="max-width:520px;margin:0 auto;padding:28px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">
            <h1 style="margin:0;color:#059669;text-align:center;">VaultBank</h1>
            <p style="text-align:center;color:#6b7280;">Secure Banking</p>
            <h2 style="color:${approved ? "#059669" : "#dc2626"};">
              Loan Application ${decision}
            </h2>
            <p style="color:#4b5563;line-height:1.6;">
              Hello ${safeName}, your ${safeLoanType.toLowerCase()} loan application
              has been ${decision.toLowerCase()} by our bank review team.
            </p>
            <div style="padding:20px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
              <p style="color:#374151;"><strong>Loan type:</strong> ${safeLoanType}</p>
              <p style="color:#374151;"><strong>Loan amount:</strong> ${amount}</p>
              <p style="color:#374151;"><strong>Tenure:</strong> ${loanDetails.tenureMonths} months</p>
              ${approved ? `<p style="color:#374151;"><strong>Monthly EMI:</strong> ${emi}</p>` : ""}
              <p style="color:#374151;"><strong>Review remarks:</strong> ${safeNotes}</p>
            </div>
            <p style="color:#6b7280;font-size:13px;line-height:1.6;">
              If you have questions, please contact your bank through its official support channel.
            </p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
            <p style="text-align:center;color:#9ca3af;font-size:12px;">VaultBank Team</p>
          </div>
        </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
  console.info(`VaultBank loan decision email sent to ${recipientEmail}.`);
}
