import type { Express, Request, Response } from "express";
import nodemailer from "nodemailer";
import { z } from "zod";
import { db } from "./db";
import { contactSubmissions } from "@shared/schema";

const contactBodySchema = z.object({
  fullName: z.string().min(2).max(255),
  email: z.string().email().max(255),
  phone: z.string().max(50).nullable().optional(),
  subject: z.string().max(255).nullable().optional(),
  message: z.string().min(10).max(10000),
});

function getSmtpConfig() {
  const host = (process.env.SMTP_HOST || "").trim();
  const user = (process.env.SMTP_USER || "").trim();
  const passRaw = process.env.SMTP_PASS;
  const pass = passRaw ? String(passRaw).replace(/\s/g, "") : "";
  const from = (process.env.EMAIL_FROM || "").trim();
  if (!host || !user || !pass || !from) {
    return null;
  }
  const port = Number(process.env.SMTP_PORT || "587");
  const secure = String(process.env.SMTP_SECURE || "").toLowerCase() === "true";
  return { host, port, secure, user, pass, from };
}

function createMailer() {
  const cfg = getSmtpConfig();
  if (!cfg) return null;
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });
}

function inboxAddress(): string | null {
  const to = (process.env.CONTACT_INBOX_EMAIL || process.env.EMAIL_FROM || "").trim();
  return to || null;
}

export function registerContactRoutes(app: Express) {
  app.post("/api/contact", async (req: Request, res: Response) => {
    const parsed = contactBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid form data",
        details: parsed.error.flatten(),
      });
    }

    const { fullName, email, phone, subject, message } = parsed.data;
    const subjectLine = (subject && subject.trim()) || "(no subject)";

    const transporter = createMailer();
    const toInbox = inboxAddress();
    if (!transporter || !toInbox) {
      console.error(
        "[contact] SMTP not configured: set SMTP_HOST, SMTP_USER, SMTP_PASS, EMAIL_FROM (and optionally CONTACT_INBOX_EMAIL)",
      );
      return res.status(503).json({
        error: "Email is not configured on the server. Please try again later.",
      });
    }

    const fromName = (process.env.EMAIL_FROM_NAME || "Support").trim();

    try {
      await db.insert(contactSubmissions).values({
        fullName,
        email,
        phone: phone?.trim() || null,
        subject: subjectLine,
        message,
        status: "new",
      });
    } catch (e) {
      console.error("[contact] Failed to save submission:", e);
      return res.status(500).json({ error: "Could not save your message. Please try again." });
    }

    const teamText = [
      `New contact form submission`,
      ``,
      `Name: ${fullName}`,
      `Email: ${email}`,
      `Phone: ${phone?.trim() || "—"}`,
      `Subject: ${subjectLine}`,
      ``,
      message,
    ].join("\n");

    const teamHtml = `
      <h2>New contact form submission</h2>
      <p><strong>Name:</strong> ${escapeHtml(fullName)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(phone?.trim() || "—")}</p>
      <p><strong>Subject:</strong> ${escapeHtml(subjectLine)}</p>
      <hr />
      <pre style="white-space:pre-wrap;font-family:inherit;">${escapeHtml(message)}</pre>
    `;

    const autoText = [
      `Hi ${fullName},`,
      ``,
      `Thanks for contacting ${fromName}. We received your message regarding "${subjectLine}" and will respond shortly.`,
      ``,
      `If you did not send this request, you can ignore this email.`,
      ``,
      `— ${fromName}`,
    ].join("\n");

    const autoHtml = `
      <p>Hi ${escapeHtml(fullName)},</p>
      <p>Thanks for contacting <strong>${escapeHtml(fromName)}</strong>. We received your message regarding
      "<strong>${escapeHtml(subjectLine)}</strong>" and will respond shortly.</p>
      <p>If you did not send this request, you can ignore this email.</p>
      <p>— ${escapeHtml(fromName)}</p>
    `;

    const cfg = getSmtpConfig()!;
    const fromAddr = `${fromName} <${cfg.from}>`;

    try {
      await transporter.sendMail({
        from: fromAddr,
        to: toInbox,
        replyTo: email,
        subject: `[Contact] ${subjectLine}`,
        text: teamText,
        html: teamHtml,
      });

      await transporter.sendMail({
        from: fromAddr,
        to: email,
        subject: `We received your message — ${fromName}`,
        text: autoText,
        html: autoHtml,
      });
    } catch (e) {
      console.error("[contact] SMTP send failed:", e);
      return res.status(502).json({
        error: "Your message was saved but email delivery failed. Please try again or call us directly.",
      });
    }

    return res.json({
      success: true,
      message:
        "Thank you for contacting us. We have sent a confirmation to your email and will get back to you shortly.",
    });
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
