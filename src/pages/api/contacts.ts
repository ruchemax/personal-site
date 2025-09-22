export const prerender = false;

import type { APIRoute } from "astro";
import nodemailer from "nodemailer";

function isJSON(req: Request) {
  return (req.headers.get("content-type") || "").includes("application/json");
}

export const POST: APIRoute = async ({ request }) => {
  let name = "", email = "", subject = "", message = "";

  try {
    if (isJSON(request)) {
      const data = await request.json();
      name = (data.name ?? "").toString().trim();
      email = (data.email ?? "").toString().trim();
      subject = (data.subject ?? "").toString().trim();
      message = (data.message ?? "").toString().trim();
    } else {
      const fd = await request.formData();
      name = (fd.get("name") ?? "").toString().trim();
      email = (fd.get("email") ?? "").toString().trim();
      subject = (fd.get("subject") ?? "").toString().trim();
      message = (fd.get("message") ?? "").toString().trim();
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: "Bad request body", detail: String(err?.message || err) }), { status: 400 });
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
