import "server-only";

import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "localhost",
  port: Number(process.env.SMTP_PORT ?? 1025),
  secure: process.env.SMTP_SECURE === "true",
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
});

const DEFAULT_FROM = "Workjournal Tool <noreply@localhost>";

// The bare sender address from MAIL_FROM (e.g. "noreply@gmail.com"), used
// when we want to keep the authorized address but change the display name.
function senderAddress(): string {
  const raw = process.env.MAIL_FROM ?? DEFAULT_FROM;
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).trim();
}

export async function sendVerificationCodeEmail({
  to,
  otp,
}: {
  to: string;
  otp: string;
}) {
  await transporter.sendMail({
    from: process.env.MAIL_FROM ?? DEFAULT_FROM,
    to,
    subject: `${otp} is your verification code`,
    text: [
      `Hi,`,
      ``,
      `Your Workjournal Tool verification code is:`,
      ``,
      `${otp}`,
      ``,
      `Enter this code on the verification page to activate your account.`,
      `The code expires in 5 minutes. If you did not sign up, you can ignore this email.`,
    ].join("\n"),
  });
}

export async function sendHostInviteEmail({
  to,
  apprenticeName,
  apprenticeEmail,
}: {
  to: string;
  apprenticeName: string;
  apprenticeEmail: string;
}) {
  const appUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

  await transporter.sendMail({
    // The address must stay the authorized sender, but the display name
    // shows the apprentice and replies go to their real email.
    from: { name: `${apprenticeName} via Workjournal`, address: senderAddress() },
    replyTo: apprenticeEmail,
    to,
    subject: `${apprenticeName} added you as their host`,
    text: [
      `Hi,`,
      ``,
      `${apprenticeName} (${apprenticeEmail}) added you as their host in the Workjournal Tool.`,
      `After you accept the invitation you can see their work journal calendar.`,
      ``,
      `Open your settings to accept the invitation:`,
      `${appUrl}/settings`,
      ``,
      `If you do not have an account yet, register with this email address first:`,
      `${appUrl}/register`,
    ].join("\n"),
  });
}
