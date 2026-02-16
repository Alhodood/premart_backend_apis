const nodemailer = require('nodemailer');

const FROM_NAME = process.env.MAIL_FROM_NAME || 'Premart';
const FROM_EMAIL = process.env.MAIL_FROM_EMAIL || process.env.MAIL_USER || 'noreply@premart.com';

/** App web / dynamic link base (e.g. https://premart-52ca5.web.app). Used in emails for "View order" link. */
const APP_WEB_BASE_URL = (process.env.APP_WEB_BASE_URL || process.env.PREMART_WEB_URL || 'https://premart-52ca5.web.app').replace(/\/$/, '');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.MAIL_HOST;
  const port = parseInt(process.env.MAIL_PORT || '587', 10);
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASS;
  const secure = process.env.MAIL_SECURE === 'true';

  if (!host || !user || !pass) {
    console.warn('⚠️ Mail not configured (MAIL_HOST, MAIL_USER, MAIL_PASS). Emails will be skipped.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });
  return transporter;
}

/**
 * Send a generic email. Returns { sent: true } or { sent: false, error }.
 */
async function sendMail(to, subject, html, text) {
  const trans = getTransporter();
  if (!trans) return { sent: false, error: 'Mail not configured' };

  try {
    await trans.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      text: text || (html ? html.replace(/<[^>]+>/g, '').trim() : ''),
      html: html || undefined
    });
    return { sent: true };
  } catch (err) {
    console.error('Mail send error:', err.message);
    return { sent: false, error: err.message };
  }
}

// ---------- Register OTP ----------
function getRegisterOtpHtml(name, otp) {
  const displayName = name || 'User';
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:480px;margin:0 auto;padding:20px;}
.box{background:#f8f9fa;border-radius:8px;padding:24px;margin:16px 0;}
.otp{font-size:28px;font-weight:bold;letter-spacing:6px;color:#2563eb;margin:12px 0;}
.footer{font-size:12px;color:#6b7280;margin-top:24px;}
</style></head>
<body>
  <p>Hi ${displayName},</p>
  <p>Use this OTP to complete your registration:</p>
  <div class="box"><span class="otp">${otp}</span></div>
  <p>This code is valid for 15 minutes. Do not share it with anyone.</p>
  <div class="footer">— ${FROM_NAME}</div>
</body>
</html>`;
}

async function sendRegisterOtp(email, otp, name) {
  if (!email) return { sent: false, error: 'Email required' };
  const subject = `Your ${FROM_NAME} registration OTP`;
  const html = getRegisterOtpHtml(name, otp);
  return sendMail(email, subject, html);
}

// ---------- Password reset OTP ----------
function getPasswordResetOtpHtml(name, otp) {
  const displayName = name || 'User';
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:480px;margin:0 auto;padding:20px;}
.box{background:#fef3c7;border-radius:8px;padding:24px;margin:16px 0;}
.otp{font-size:28px;font-weight:bold;letter-spacing:6px;color:#b45309;margin:12px 0;}
.footer{font-size:12px;color:#6b7280;margin-top:24px;}
</style></head>
<body>
  <p>Hi ${displayName},</p>
  <p>Use this OTP to reset your password:</p>
  <div class="box"><span class="otp">${otp}</span></div>
  <p>This code is valid for 15 minutes. If you didn't request this, please ignore this email.</p>
  <div class="footer">— ${FROM_NAME}</div>
</body>
</html>`;
}

async function sendPasswordResetOtp(email, otp, name) {
  if (!email) return { sent: false, error: 'Email required' };
  const subject = `Reset your password – ${FROM_NAME}`;
  const html = getPasswordResetOtpHtml(name, otp);
  return sendMail(email, subject, html);
}

// ---------- Greetings (welcome after registration) ----------
function getGreetingsHtml(name) {
  const displayName = name || 'there';
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:520px;margin:0 auto;padding:20px;}
.hero{background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);color:#fff;border-radius:12px;padding:32px;text-align:center;margin:16px 0;}
.hero h1{margin:0;font-size:24px;}
.footer{font-size:12px;color:#6b7280;margin-top:24px;}
</style></head>
<body>
  <div class="hero"><h1>Welcome to ${FROM_NAME}</h1></div>
  <p>Hi ${displayName},</p>
  <p>Thanks for signing up. We're glad to have you on board.</p>
  <p>You can now log in and start using your account.</p>
  <div class="footer">— The ${FROM_NAME} team</div>
</body>
</html>`;
}

async function sendGreetings(email, name) {
  if (!email) return { sent: false, error: 'Email required' };
  const subject = `Welcome to ${FROM_NAME}`;
  const html = getGreetingsHtml(name);
  return sendMail(email, subject, html);
}

// ---------- Order: Placed ----------
function getOrderPlacedHtml(name, orderId, totalPayable, itemsSummary) {
  const displayName = name || 'Customer';
  const summary = itemsSummary || 'Your order items';
  const viewOrderUrl = `${APP_WEB_BASE_URL}?screen=order_details&order_id=${encodeURIComponent(orderId)}`;
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:520px;margin:0 auto;padding:20px;}
.box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:16px 0;}
.total{font-size:20px;font-weight:bold;color:#15803d;}
.orderId{font-family:monospace;background:#f1f5f9;padding:4px 8px;border-radius:4px;}
.btn{display:inline-block;background:#2563eb;color:#fff!important;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;margin:12px 0;}
.footer{font-size:12px;color:#6b7280;margin-top:24px;}
</style></head>
<body>
  <p>Hi ${displayName},</p>
  <p>Your order has been placed successfully.</p>
  <div class="box">
    <p><strong>Order ID:</strong> <span class="orderId">#${orderId}</span></p>
    <p>${summary}</p>
    <p class="total">Total: ${typeof totalPayable === 'number' ? totalPayable.toFixed(2) : totalPayable}</p>
  </div>
  <p><a href="${viewOrderUrl}" class="btn">View order in app</a></p>
  <p>We'll notify you when the order status changes.</p>
  <div class="footer">— ${FROM_NAME}</div>
</body>
</html>`;
}

async function sendOrderPlaced(email, name, orderData) {
  if (!email) return { sent: false, error: 'Email required' };
  const { orderId, totalPayable, itemsSummary } = orderData || {};
  const subject = `Order placed – #${orderId || 'Order'}`;
  const html = getOrderPlacedHtml(name, orderId || 'N/A', totalPayable, itemsSummary);
  return sendMail(email, subject, html);
}

// ---------- Order: Status update (confirmed, shipped, delivered, cancelled, etc.) ----------
function getOrderStatusHtml(name, orderId, status, message) {
  const displayName = name || 'Customer';
  const statusLabel = (status || '').replace(/_/g, ' ');
  const extra = message ? `<p>${message}</p>` : '';
  const viewOrderUrl = `${APP_WEB_BASE_URL}?screen=order_details&order_id=${encodeURIComponent(orderId || '')}`;
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:520px;margin:0 auto;padding:20px;}
.box{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:20px;margin:16px 0;}
.status{font-size:18px;font-weight:bold;color:#1d4ed8;}
.orderId{font-family:monospace;background:#f1f5f9;padding:4px 8px;border-radius:4px;}
.btn{display:inline-block;background:#2563eb;color:#fff!important;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;margin:12px 0;}
.footer{font-size:12px;color:#6b7280;margin-top:24px;}
</style></head>
<body>
  <p>Hi ${displayName},</p>
  <p>Your order <span class="orderId">#${orderId || 'N/A'}</span> has been updated.</p>
  <div class="box"><p class="status">Status: ${statusLabel}</p>${extra}</div>
  <p><a href="${viewOrderUrl}" class="btn">View order in app</a></p>
  <div class="footer">— ${FROM_NAME}</div>
</body>
</html>`;
}

async function sendOrderStatusUpdate(email, name, orderId, status, message) {
  if (!email) return { sent: false, error: 'Email required' };
  const subject = `Order #${orderId || 'Order'} – ${(status || 'Update').replace(/_/g, ' ')}`;
  const html = getOrderStatusHtml(name, orderId, status, message);
  return sendMail(email, subject, html);
}

module.exports = {
  getTransporter,
  sendMail,
  sendRegisterOtp,
  sendPasswordResetOtp,
  sendGreetings,
  sendOrderPlaced,
  sendOrderStatusUpdate
};
