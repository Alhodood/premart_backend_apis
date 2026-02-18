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

/**
 * Send email with attachments. attachments = [{ filename: string, content: Buffer }].
 */
async function sendMailWithAttachments(to, subject, html, text, attachments) {
  const trans = getTransporter();
  if (!trans) return { sent: false, error: 'Mail not configured' };
  if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
    return sendMail(to, subject, html, text);
  }
  try {
    await trans.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      text: text || (html ? html.replace(/<[^>]+>/g, '').trim() : ''),
      html: html || undefined,
      attachments: attachments.map((a) => ({
        filename: a.filename || 'attachment',
        content: a.content
      }))
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
// allShopsDetail: optional array of { orderId, shopName, shopAddress, shopContact, items: [...], subtotal, deliveryCharge, discount, totalPayable }
// masterOrderId: optional, shown when multiple shops
function getOrderPlacedHtml(name, orderId, totalPayable, itemsSummary, allShopsDetail, masterOrderId) {
  const displayName = name || 'Customer';
  const summary = itemsSummary || 'Your order items';
  const viewOrderUrl = `${APP_WEB_BASE_URL}?screen=order_details&order_id=${encodeURIComponent(orderId)}`;
  const totalFormatted = typeof totalPayable === 'number' ? totalPayable.toFixed(2) : totalPayable;

  let shopsHtml = '';
  if (Array.isArray(allShopsDetail) && allShopsDetail.length > 0) {
    shopsHtml = allShopsDetail.map((shop, idx) => {
      const shopOrderId = shop.orderId ? String(shop.orderId) : '';
      const shopTitle = `${idx + 1}. ${escapeHtml(shop.shopName || 'Shop')}`;
      const shopAddr = [shop.shopAddress, shop.shopContact].filter(Boolean).join(' • ');
      const rows = (shop.items || []).map((it) => {
        const desc = escapeHtml((it.partName || 'Item') + (it.partNumber ? ` (${it.partNumber})` : ''));
        const qty = it.qty ?? 1;
        const unit = typeof it.unitPrice === 'number' ? it.unitPrice.toFixed(2) : (it.unitPrice || '0');
        const line = typeof it.lineTotal === 'number' ? it.lineTotal.toFixed(2) : (it.lineTotal || '0');
        return `<tr><td>${desc}</td><td style="text-align:center">${qty}</td><td style="text-align:right">AED ${unit}</td><td style="text-align:right">AED ${line}</td></tr>`;
      }).join('');
      const subtotalStr = typeof shop.subtotal === 'number' ? shop.subtotal.toFixed(2) : (shop.subtotal || '0');
      const deliveryStr = (shop.deliveryCharge && Number(shop.deliveryCharge) > 0) ? `<tr><td colspan="3">Delivery</td><td style="text-align:right">AED ${Number(shop.deliveryCharge).toFixed(2)}</td></tr>` : '';
      const discountStr = (shop.discount && Number(shop.discount) > 0) ? `<tr><td colspan="3">Discount</td><td style="text-align:right">- AED ${Number(shop.discount).toFixed(2)}</td></tr>` : '';
      const shopTotalStr = typeof shop.totalPayable === 'number' ? shop.totalPayable.toFixed(2) : (shop.totalPayable || '0');
      return `
  <div class="shop-block">
    <p class="shop-name">${shopTitle}</p>
    ${shopOrderId ? `<p class="shop-order-id"><strong>Order ID:</strong> <span class="orderId">#${escapeHtml(shopOrderId)}</span></p>` : ''}
    ${shopAddr ? `<p class="shop-addr">${escapeHtml(shopAddr)}</p>` : ''}
    <table class="item-table">
      <thead><tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Subtotal</th></tr></thead>
      <tbody>${rows}
      <tr><td colspan="3"><strong>Subtotal</strong></td><td style="text-align:right">AED ${subtotalStr}</td></tr>${deliveryStr}${discountStr}
      <tr class="shop-total"><td colspan="3"><strong>Shop total</strong></td><td style="text-align:right"><strong>AED ${shopTotalStr}</strong></td></tr>
      </tbody>
    </table>
  </div>`;
    }).join('');
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:620px;margin:0 auto;padding:20px;}
.box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:16px 0;}
.total{font-size:20px;font-weight:bold;color:#15803d;}
.orderId{font-family:monospace;background:#f1f5f9;padding:4px 8px;border-radius:4px;}
.btn{display:inline-block;background:#2563eb;color:#fff!important;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;margin:12px 0;}
.footer{font-size:12px;color:#6b7280;margin-top:24px;}
.shop-block{margin:20px 0;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;}
.shop-name{font-weight:bold;font-size:15px;color:#1e293b;margin:0 0 8px 0;}
.shop-order-id{font-size:13px;color:#475569;margin:0 0 6px 0;}
.shop-addr{font-size:12px;color:#64748b;margin:0 0 12px 0;}
.item-table{width:100%;border-collapse:collapse;font-size:13px;}
.item-table th,.item-table td{padding:8px;border-bottom:1px solid #e2e8f0;}
.item-table th{text-align:left;background:#f1f5f9;}
.shop-total{background:#e0f2fe;}
</style></head>
<body>
  <p>Hi ${displayName},</p>
  <p>Your order has been placed successfully.</p>
  <div class="box">
    <p><strong>Order ID:</strong> <span class="orderId">#${orderId}</span></p>
    ${masterOrderId ? `<p><strong>Master Order ID:</strong> <span class="orderId">#${escapeHtml(String(masterOrderId))}</span></p>` : ''}
    <p>${summary}</p>
    ${shopsHtml ? '<p><strong>Details by shop:</strong></p>' + shopsHtml : ''}
    <p class="total" style="margin-top:16px;">Grand total: AED ${totalFormatted}</p>
  </div>
  <p><a href="${viewOrderUrl}" class="btn">View order in app</a></p>
  <p>We'll notify you when the order status changes.</p>
  <div class="footer">— ${FROM_NAME}</div>
</body>
</html>`;
}

async function sendOrderPlaced(email, name, orderData, invoicePdfBuffer) {
  if (!email) return { sent: false, error: 'Email required' };
  const { orderId, masterOrderId, totalPayable, itemsSummary, allShopsDetail } = orderData || {};
  const subject = `Order placed – #${orderId || 'Order'}`;
  const html = getOrderPlacedHtml(name, orderId || 'N/A', totalPayable, itemsSummary, allShopsDetail, masterOrderId);
  if (invoicePdfBuffer && Buffer.isBuffer(invoicePdfBuffer)) {
    return sendMailWithAttachments(
      email,
      subject,
      html + '<p><strong>Your invoice is attached as a downloadable PDF.</strong></p>',
      null,
      [{ filename: `Invoice_${orderId || 'Order'}.pdf`, content: invoicePdfBuffer }]
    );
  }
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

// ---------- Order: Cancelled ----------
function getOrderCancelledHtml(name, orderId, reason, cancelledBy) {
  const displayName = name || 'Customer';
  const reasonText = reason ? reason : 'Not specified';
  const cancelledByLabel = cancelledBy ? cancelledBy.replace(/_/g, ' ') : '—';
  const viewOrderUrl = `${APP_WEB_BASE_URL}?screen=order_details&order_id=${encodeURIComponent(orderId || '')}`;
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:520px;margin:0 auto;padding:20px;}
.box{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:20px;margin:16px 0;}
.status{font-size:18px;font-weight:bold;color:#b91c1c;}
.orderId{font-family:monospace;background:#f1f5f9;padding:4px 8px;border-radius:4px;}
.reason{color:#6b7280;margin-top:8px;}
.btn{display:inline-block;background:#2563eb;color:#fff!important;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;margin:12px 0;}
.footer{font-size:12px;color:#6b7280;margin-top:24px;}
</style></head>
<body>
  <p>Hi ${displayName},</p>
  <p>Your order <span class="orderId">#${orderId || 'N/A'}</span> has been cancelled.</p>
  <div class="box">
    <p class="status">Order cancelled</p>
    <p class="reason"><strong>Reason:</strong> ${reasonText}</p>
    <p class="reason"><strong>Cancelled by:</strong> ${cancelledByLabel}</p>
  </div>
  <p><a href="${viewOrderUrl}" class="btn">View order in app</a></p>
  <p>If you have any questions, please contact our support.</p>
  <div class="footer">— ${FROM_NAME}</div>
</body>
</html>`;
}

async function sendOrderCancelled(email, name, orderId, reason, cancelledBy) {
  if (!email) return { sent: false, error: 'Email required' };
  const subject = `Order #${orderId || 'Order'} cancelled`;
  const html = getOrderCancelledHtml(name, orderId, reason, cancelledBy);
  return sendMail(email, subject, html);
}

// ---------- Order: Invoice by email (downloadable PDF) ----------
function getOrderInvoiceEmailHtml(name, orderId) {
  const displayName = name || 'Customer';
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:520px;margin:0 auto;padding:20px;}
.box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:16px 0;}
.orderId{font-family:monospace;background:#f1f5f9;padding:4px 8px;border-radius:4px;}
.footer{font-size:12px;color:#6b7280;margin-top:24px;}
</style></head>
<body>
  <p>Hi ${displayName},</p>
  <p>Please find your invoice for order <span class="orderId">#${orderId || 'N/A'}</span> attached to this email as a downloadable PDF.</p>
  <div class="box"><p>You can download and save the PDF attachment for your records.</p></div>
  <div class="footer">— ${FROM_NAME}</div>
</body>
</html>`;
}

/**
 * Send order invoice as downloadable PDF attachment.
 * @param {string} email - Recipient email
 * @param {string} name - Customer name
 * @param {string} orderId - Order ID (for subject and filename)
 * @param {Buffer} pdfBuffer - Invoice PDF buffer
 */
async function sendOrderInvoiceEmail(email, name, orderId, pdfBuffer) {
  if (!email) return { sent: false, error: 'Email required' };
  if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) return { sent: false, error: 'PDF buffer required' };
  const subject = `Your invoice – Order #${orderId || 'Order'}`;
  const html = getOrderInvoiceEmailHtml(name, orderId);
  return sendMailWithAttachments(email, subject, html, null, [
    { filename: `Invoice_${orderId || 'Order'}.pdf`, content: pdfBuffer }
  ]);
}

module.exports = {
  getTransporter,
  sendMail,
  sendMailWithAttachments,
  sendRegisterOtp,
  sendPasswordResetOtp,
  sendGreetings,
  sendOrderPlaced,
  sendOrderStatusUpdate,
  sendOrderCancelled,
  sendOrderInvoiceEmail
};
