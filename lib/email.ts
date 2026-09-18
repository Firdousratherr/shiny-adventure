import nodemailer from 'nodemailer';

type Mail = { to: string; subject: string; text: string; html: string };

const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

function transport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) return null;
  const port = Number(SMTP_PORT || 587);
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  });
}

export async function sendEmail(mail: Mail) {
  const t = transport();
  if (!t) return false;
  try {
    await t.sendMail({ ...mail, from: process.env.SMTP_FROM || process.env.SMTP_USER });
    return true;
  } catch (error) {
    console.error('email notification failed', error);
    return false;
  }
}

export async function notifyCustomer(to: string, orderNumber: string, status: string, extra = '') {
  const safeOrderNumber = escapeHtml(orderNumber);
  const safeStatus = escapeHtml(status.replaceAll('_', ' '));
  const safeExtra = escapeHtml(extra);
  const subject = `Zenvora order ${orderNumber} — ${status.replaceAll('_', ' ')}`;
  const text = `Your Zenvora order ${orderNumber} is now ${status.replaceAll('_', ' ')}. ${extra}`.trim();
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px"><h2>Zenvora order update</h2><p>Order <b>${safeOrderNumber}</b> is now <b>${safeStatus}</b>.</p>${safeExtra ? `<p>${safeExtra}</p>` : ''}<p>You can use the Zenvora order tracking page to check the latest status.</p></div>`;
  return sendEmail({ to, subject, text, html });
}


export async function sendSignupOtp(to: string, otp: string) {
  const safeOtp = escapeHtml(otp);
  return sendEmail({
    to,
    subject: 'Your Zenvora verification code',
    text: `Your Zenvora verification code is ${otp}. It expires in 10 minutes.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px"><h2>Zenvora email verification</h2><p>Your verification code is:</p><p style="font-size:32px;font-weight:800;letter-spacing:8px">${safeOtp}</p><p>This code expires in 10 minutes. If you did not request this, you can ignore this email.</p></div>`,
  });
}
