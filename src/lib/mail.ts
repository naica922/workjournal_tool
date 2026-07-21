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
    from: process.env.MAIL_FROM ?? "Arbeitsjournal Tool <noreply@localhost>",
    to,
    subject: `${apprenticeName} added you as their host`,
    text: [
      `Hi,`,
      ``,
      `${apprenticeName} (${apprenticeEmail}) added you as their host in the Arbeitsjournal Tool.`,
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
