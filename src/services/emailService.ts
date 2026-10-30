import nodemailer, { type Transporter } from 'nodemailer';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (!host || !user || !pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  return transporter;
}

/**
 * Checks if the email delivery service is configured.
 */
export function isEmailConfigured(): boolean {
  return !!getTransporter();
}

/**
 * Sends a 6-digit OTP verification email to the user's Gmail address.
 * Never logs or exposes the OTP.
 */
export async function sendOtpEmail(email: string, otp: string): Promise<void> {
  const mailer = getTransporter();

  if (!mailer) {
    throw new Error(
      'Email delivery service is not configured. Please configure SMTP credentials (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS) in environment variables.'
    );
  }

  const fromAddress = process.env.SMTP_FROM || `"Virtual Manager" <${process.env.SMTP_USER}>`;

  const mailOptions = {
    from: fromAddress,
    to: email,
    subject: 'ভার্চুয়াল ম্যানেজার - রেজিস্ট্রেশন ভেরিফিকেশন কোড / Verification Code',
    text: `আপনার ভার্চুয়াল ম্যানেজার একাউন্ট রেজিস্ট্রেশনের ভেরিফিকেশন কোড: ${otp}\nএই কোডটি আগামী ৫ মিনিট কার্যকর থাকবে।\n\nYour Virtual Manager account verification code is: ${otp}\nThis code is valid for 5 minutes.`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #0f172a; margin: 0 0 8px 0; font-size: 22px;">ভার্চুয়াল ম্যানেজার</h2>
          <p style="color: #0f766e; margin: 0; font-size: 13px; font-weight: 600;">Virtual Manager - ডিজিটাল খাতা ও হিসাব</p>
        </div>

        <div style="background-color: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
          <p style="color: #115e59; font-size: 13px; margin: 0 0 12px 0;">আপনার ইমেইল যাচাইকরণের ৬-সংখ্যার কোড:</p>
          <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #0f766e; font-family: monospace; padding: 10px; background: #ffffff; border-radius: 6px; display: inline-block; border: 1px solid #99f6e4;">
            ${otp}
          </div>
          <p style="color: #64748b; font-size: 12px; margin: 12px 0 0 0;">(কোডটি ৫ মিনিটের জন্য কার্যকর থাকবে / Valid for 5 minutes)</p>
        </div>

        <p style="color: #475569; font-size: 12px; line-height: 1.6; margin: 0 0 16px 0;">
          আপনি যদি এই অ্যাকাউন্ট তৈরির জন্য আবেদন না করে থাকেন, তবে অনুগ্রহ করে এই ইমেইলটি উপেক্ষা করুন।<br>
          If you did not request this verification, please safely ignore this email.
        </p>

        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;">
        <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
          Virtual Manager • Online Due Ledger & Accounting
        </p>
      </div>
    `,
  };

  await mailer.sendMail(mailOptions);
}
