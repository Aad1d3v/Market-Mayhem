/**
 * Mailer. Uses SMTP when configured; otherwise prints emails to the server
 * console so development and testing work without any email provider.
 */

import nodemailer from "nodemailer";
import { config } from "../config.js";

let transporter: nodemailer.Transporter | null = null;

if (config.smtp.host) {
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: config.smtp.user
      ? { user: config.smtp.user, pass: config.smtp.password }
      : undefined,
  });
}

export async function sendMail(to: string, subject: string, text: string) {
  if (transporter) {
    await transporter.sendMail({ from: config.smtp.from, to, subject, text });
    return;
  }
  console.log("──────────────────────────────────────────────");
  console.log("📧 DEV MAIL (no SMTP configured — not sent)");
  console.log(`To:      ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(text);
  console.log("──────────────────────────────────────────────");
}
