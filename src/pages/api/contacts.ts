export const prerender = false;

import type { APIRoute } from "astro";
import nodemailer from "nodemailer";

// In-memory rate limiting. Use a shared store for multi-instance deployments.
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function isJSON(request: Request) {
  return (request.headers.get("content-type") || "").includes("application/json");
}

// Allow three requests per IP address every 15 minutes.
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + 15 * 60 * 1000 });
    return true;
  }

  if (record.count >= 3) return false;

  record.count++;
  return true;
}

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  if (!token) return false;

  const secretKey = import.meta.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    console.error("TURNSTILE_SECRET_KEY is not configured");
    return false;
  }

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: secretKey, response: token, remoteip: ip }),
    });

    const data = await response.json() as { success?: boolean };
    return data.success === true;
  } catch (error) {
    console.error("Turnstile verification failed", error);
    return false;
  }
}

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";

  if (!checkRateLimit(ip)) {
    return jsonResponse({ success: false, error: "Too many requests. Please try again later." }, 429);
  }

  let name = "";
  let email = "";
  let subject = "";
  let message = "";
  let website = "";
  let turnstileToken = "";

  try {
    if (isJSON(request)) {
      const data = await request.json();
      name = (data.name ?? "").toString().trim();
      email = (data.email ?? "").toString().trim();
      subject = (data.subject ?? "").toString().trim();
      message = (data.message ?? "").toString().trim();
      website = (data.website ?? "").toString().trim();
      turnstileToken = (data["cf-turnstile-response"] ?? "").toString().trim();
    } else {
      const form = await request.formData();
      name = (form.get("name") ?? "").toString().trim();
      email = (form.get("email") ?? "").toString().trim();
      subject = (form.get("subject") ?? "").toString().trim();
      message = (form.get("message") ?? "").toString().trim();
      website = (form.get("website") ?? "").toString().trim();
      turnstileToken = (form.get("cf-turnstile-response") ?? "").toString().trim();
    }
  } catch {
    return jsonResponse({ success: false, error: "Bad request body" }, 400);
  }

  if (website) {
    console.warn("Contact form honeypot triggered");
    return jsonResponse({ success: false, error: "Bot detected" }, 400);
  }

  if (!await verifyTurnstile(turnstileToken, ip)) {
    return jsonResponse({ success: false, error: "Verification failed" }, 400);
  }

  if (!name || !email || !subject || !message) {
    return jsonResponse({ success: false, error: "Missing fields" }, 400);
  }

  if (name.length > 200 || email.length > 320 || subject.length > 300 || message.length > 20_000) {
    return jsonResponse({ success: false, error: "Field too long" }, 400);
  }

  const smtpPassword = import.meta.env.SMTP_PASSWORD;
  if (!smtpPassword) {
    console.error("SMTP_PASSWORD is not configured");
    return jsonResponse({ success: false, error: "Service unavailable" }, 503);
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.mail.ru",
    port: 465,
    secure: true,
    auth: { user: "ruchemax@list.ru", pass: smtpPassword },
  });

  try {
    await transporter.verify();
    const info = await transporter.sendMail({
      from: '"Website Contact" <ruchemax@list.ru>',
      replyTo: `"${name}" <${email}>`,
      to: "ruchemax@list.ru",
      subject,
      text: `From: ${name} <${email}>\n\n${message}`,
    });

    return jsonResponse({ success: true, messageId: info.messageId }, 200);
  } catch (error) {
    console.error("Contact email delivery failed", error);
    return jsonResponse({ success: false, error: "Failed to send email" }, 500);
  }
};
