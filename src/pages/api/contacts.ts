export const prerender = false;

import type { APIRoute } from "astro";
import nodemailer from "nodemailer";

// Простое хранилище для rate limiting (в продакшене лучше использовать Redis)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function isJSON(req: Request) {
  return (req.headers.get("content-type") || "").includes("application/json");
}

// Проверка rate limit (3 запроса в 15 минут с одного IP)
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + 15 * 60 * 1000 }); // 15 минут
    return true;
  }
  
  if (record.count >= 3) {
    return false;
  }
  
  record.count++;
  return true;
}

// Проверка Cloudflare Turnstile
async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  if (!token) return false;
  
  try {
    const secretKey = import.meta.env.TURNSTILE_SECRET_KEY;
    if (!secretKey) {
      console.warn("TURNSTILE_SECRET_KEY not set, skipping verification");
      return true; // Для разработки пропускаем
    }
    
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: secretKey, response: token, remoteip: ip }),
    });
    
    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return false;
  }
}

export const POST: APIRoute = async ({ request }) => {
  // Получаем IP адрес клиента
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
             request.headers.get('x-real-ip') || 
             'unknown';
  
  // Проверка rate limiting
  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: "Too many requests. Please try again later." 
    }), { status: 429 });
  }

  let name = "", email = "", subject = "", message = "", website = "", turnstileToken = "";

  try {
    if (isJSON(request)) {
      const data = await request.json();
      name = (data.name ?? "").toString().trim();
      email = (data.email ?? "").toString().trim();
      subject = (data.subject ?? "").toString().trim();
      message = (data.message ?? "").toString().trim();
      website = (data.website ?? "").toString().trim();
      turnstileToken = (data['cf-turnstile-response'] ?? "").toString().trim();
    } else {
      const fd = await request.formData();
      name = (fd.get("name") ?? "").toString().trim();
      email = (fd.get("email") ?? "").toString().trim();
      subject = (fd.get("subject") ?? "").toString().trim();
      message = (fd.get("message") ?? "").toString().trim();
      website = (fd.get("website") ?? "").toString().trim();
      turnstileToken = (fd.get("cf-turnstile-response") ?? "").toString().trim();
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: "Bad request body", detail: String(err?.message || err) }), { status: 400 });
  }

  // Проверка honeypot - если поле "website" заполнено, это бот
  if (website) {
    console.warn('Honeypot triggered for IP:', ip);
    return new Response(JSON.stringify({ success: false, error: "Bot detected" }), { status: 400 });
  }

  // Проверка Turnstile
  const isTurnstileValid = await verifyTurnstile(turnstileToken, ip);
  if (!isTurnstileValid) {
    console.warn('Turnstile verification failed for IP:', ip);
    return new Response(JSON.stringify({ success: false, error: "Verification failed" }), { status: 400 });
  }

  if (!name || !email || !subject || !message) {
    return new Response(JSON.stringify({ success: false, error: "Missing fields" }), { status: 400 });
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.mail.ru",
    port: 465,
    secure: true,
    auth: { user: "ruchemax@list.ru", pass: import.meta.env.SMTP_PASSWORD },
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

    return new Response(JSON.stringify({ success: true, messageId: info.messageId }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({
      success: false,
      error: "Failed to send email",
      detail: e?.response || e?.message || String(e),
      code: e?.code || null,
    }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
