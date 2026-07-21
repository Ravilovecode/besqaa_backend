import nodemailer from 'nodemailer';
import env, { isMailConfigured } from '../config/env.js';

let transporter = null;
if (isMailConfigured) {
  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: { user: env.smtp.user, pass: env.smtp.pass },
  });
}

// Sends an email; without SMTP credentials it logs to the console instead
// (same dev pattern as OTPs) so flows remain testable.
export async function sendMail({ to, subject, html }) {
  if (!transporter) {
    console.log(`📧 [mail:dev] To: ${to} | Subject: ${subject}\n${html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`);
    return { dev: true };
  }
  return transporter.sendMail({ from: env.smtp.from, to, subject, html });
}

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export function orderConfirmedEmail(order, user) {
  const rows = order.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0;">${i.name} × ${i.quantity}</td><td align="right">${inr(i.price * i.quantity)}</td></tr>`
    )
    .join('');
  return {
    to: user.email,
    subject: `🎉 Order ${order.orderNumber} confirmed — Besqaa`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#0a1024;color:#f3f5fd;padding:28px;border-radius:14px;">
        <h1 style="color:#d4af37;margin:0 0 6px;">Order confirmed! 🎉</h1>
        <p style="color:#9aa3c7;margin:0 0 18px;">Hi ${user.name}, your order <strong style="color:#f3f5fd;">${order.orderNumber}</strong> has been verified and confirmed.</p>
        <table width="100%" style="border-top:1px solid #26305a;border-bottom:1px solid #26305a;padding:8px 0;color:#f3f5fd;">
          ${rows}
        </table>
        <p style="display:flex;justify-content:space-between;font-size:18px;">
          <strong>Total&nbsp;</strong> <strong style="color:#d4af37;">${inr(order.total)}</strong>
        </p>
        ${order.estimatedDelivery ? `<p style="color:#9aa3c7;">Estimated delivery: ${new Date(order.estimatedDelivery).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>` : ''}
        <p style="color:#9aa3c7;font-size:13px;margin-top:22px;">Track your order in the Besqaa app → My Orders.<br/>Thank you for shopping with Besqaa!</p>
      </div>`,
  };
}
