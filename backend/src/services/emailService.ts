
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
