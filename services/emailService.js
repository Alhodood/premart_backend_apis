// services/emailService.js
const { Resend } = require('resend');
const logger = require('../config/logger');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@autopartsnow.uk';
const APP_NAME = 'PreMart';

const ensureResend = () => {
  if (!resend) {
    logger.warn('emailService: Resend client not initialized — RESEND_API_KEY missing');
    return false;
  }
  return true;
};

// ─────────────────────────────────────────────────────────────────────────────
const sendOTPEmail = async (toEmail, otp, appName = APP_NAME) => {
  if (!ensureResend()) return false;
  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: toEmail,
      subject: `${otp} is your ${appName} verification code`,
      html: `<div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 24px; border: 1px solid #E5E7EB; border-radius: 12px;">
          <div style="background: linear-gradient(135deg, #6366F1, #4F46E5); border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <h1 style="color: white; margin: 0; font-size: 22px;">${appName}</h1>
            <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 14px;">Email Verification</p>
          </div>
          <p style="color: #374151; font-size: 15px;">Hello,</p>
          <p style="color: #374151; font-size: 15px;">Use the OTP below to verify your email — it expires in <strong>15 minutes</strong>.</p>
          <div style="font-size: 40px; font-weight: bold; letter-spacing: 10px; text-align: center; padding: 24px; background: #F3F4F6; border-radius: 10px; color: #1A1A2E; margin-bottom: 24px;">${otp}</div>
          <div style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; padding: 12px 16px;">
            <p style="color: #92400E; font-size: 13px; margin: 0;">⚠️ If you did not request this, please ignore this email.</p>
          </div>
          <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 24px;">© ${new Date().getFullYear()} ${appName}</p>
        </div>`,
    });

    if (error) {
      logger.error('sendOTPEmail: Resend returned an error', { toEmail, error });
      return false;
    }

    logger.info('sendOTPEmail: OTP email sent successfully', { toEmail, messageId: data.id });
    return true;
  } catch (err) {
    logger.error('sendOTPEmail: failed to send OTP email', { toEmail, error: err });
    return false;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
const sendOrderStatusEmail = async (toEmail, orderId, status, orderDetails) => {
  if (!ensureResend()) return false;
  try {
    const statusConfig = {
      'Pending':                    { icon: '📦', color: '#6366F1', title: 'Order Confirmed!',              message: 'We\'ve received your order' },
      'Delivery Boy Assigned':      { icon: '🚚', color: '#3B82F6', title: 'Delivery Partner Assigned',     message: 'A delivery partner has been assigned' },
      'Accepted by Delivery Boy':   { icon: '✅', color: '#10B981', title: 'Order Accepted',                message: 'Your delivery partner accepted the order' },
      'Reached Pickup':             { icon: '📍', color: '#8B5CF6', title: 'At Pickup Location',            message: 'Partner reached the shop' },
      'Waiting to Pick':            { icon: '⏳', color: '#F59E0B', title: 'Waiting to Pick Up',            message: 'Order is ready for pickup' },
      'Order Picked':               { icon: '🎒', color: '#06B6D4', title: 'Order Picked Up!',              message: 'Order is on the way to you' },
      'Reached Drop':               { icon: '🏠', color: '#EC4899', title: 'Partner at Your Location',      message: 'Partner reached your address' },
      'Delivered':                  { icon: '🎉', color: '#10B981', title: 'Order Delivered!',              message: 'Order delivered successfully!' },
    }[status] || { icon: '📦', color: '#6366F1', title: `Order ${status}`, message: `Status: ${status}` };

    const orderShortId = orderId.slice(-8).toUpperCase();
    const items = orderDetails.items || [];

    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: toEmail,
      subject: `${statusConfig.title} - Order #${orderShortId}`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; background: white;">
          <div style="background: linear-gradient(135deg, ${statusConfig.color}, ${statusConfig.color}DD); padding: 40px 20px; text-align: center;">
            <div style="font-size: 64px;">${statusConfig.icon}</div>
            <h1 style="color: white; margin: 16px 0 0; font-size: 28px;">${statusConfig.title}</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0;">Order #${orderShortId}</p>
          </div>
          <div style="padding: 32px 24px; background: #FAFAFA; text-align: center;">
            <p style="color: #374151; font-size: 16px; margin: 0;">${statusConfig.message}</p>
          </div>
          <div style="padding: 24px;">
            <h2 style="color: #111827; font-size: 20px; margin: 0 0 16px;">Order Details</h2>
            ${items.slice(0, 3).map(item => `
              <div style="padding: 12px; background: #F9FAFB; border-radius: 8px; margin-bottom: 12px;">
                <p style="color: #111827; font-weight: 600; margin: 0 0 4px; font-size: 14px;">${item.snapshot?.partName || 'Product'}</p>
                <p style="color: #6B7280; margin: 0; font-size: 13px;">Qty: ${item.quantity} × AED ${item.snapshot?.price || 0}</p>
              </div>
            `).join('')}
            <div style="border-top: 2px solid #E5E7EB; margin-top: 20px; padding-top: 16px;">
              <div style="display: flex; justify-content: space-between; padding-top: 12px; border-top: 1px solid #E5E7EB;">
                <span style="color: #111827; font-size: 18px; font-weight: bold;">Total:</span>
                <span style="color: #111827; font-size: 18px; font-weight: bold;">AED ${orderDetails.totalPayable || 0}</span>
              </div>
            </div>
          </div>
          <div style="padding: 24px; background: #111827; text-align: center;">
            <p style="color: #9CA3AF; margin: 0; font-size: 14px;">Need help? <a href="mailto:support@premart.ae" style="color: #6366F1;">support@premart.ae</a></p>
            <p style="color: #6B7280; margin: 8px 0 0; font-size: 12px;">© ${new Date().getFullYear()} ${APP_NAME}</p>
          </div>
        </div>
      `,
    });

    if (error) {
      logger.error('sendOrderStatusEmail: Resend returned an error', { toEmail, orderId, status, error });
      return false;
    }

    logger.info('sendOrderStatusEmail: order status email sent successfully', { toEmail, orderId, status, messageId: data.id });
    return true;
  } catch (err) {
    logger.error('sendOrderStatusEmail: failed to send order status email', { toEmail, orderId, status, error: err });
    return false;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
const sendShopVerificationEmail = async (toEmail, shopName, isVerified) => {
  if (!ensureResend()) return false;
  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: toEmail,
      subject: isVerified ? `✅ Your Shop is Verified - ${APP_NAME}` : `⚠️ Shop Verification Update - ${APP_NAME}`,
      html: `
        <div style="max-width: 600px; margin: auto; padding: 24px; border: 1px solid #E5E7EB; border-radius: 12px; font-family: Arial, sans-serif;">
          <div style="background: ${isVerified ? 'linear-gradient(135deg, #10B981, #059669)' : 'linear-gradient(135deg, #F59E0B, #D97706)'}; border-radius: 8px; padding: 40px 20px; text-align: center;">
            <div style="font-size: 64px;">${isVerified ? '✅' : '⚠️'}</div>
            <h1 style="color: white; margin: 16px 0 0; font-size: 28px;">${isVerified ? 'Shop Verified!' : 'Status Updated'}</h1>
          </div>
          <div style="padding: 24px; background: #FAFAFA; border-radius: 8px; margin: 24px 0;">
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0;">
              ${isVerified
                ? `Congratulations! <strong>${shopName}</strong> has been verified by the PreMart team. You can now login and start receiving orders.`
                : `Your shop <strong>${shopName}</strong> verification status was updated. Please contact support for more details.`
              }
            </p>
          </div>
          ${isVerified ? `
          <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <p style="color: #065F46; font-size: 14px; margin: 0; font-weight: 600;">🎉 What's next?</p>
            <ul style="color: #065F46; font-size: 14px; margin: 8px 0 0; padding-left: 20px; line-height: 1.8;">
              <li>Login to your shop panel</li>
              <li>Add your products and inventory</li>
              <li>Start receiving customer orders</li>
            </ul>
          </div>` : ''}
          <div style="text-align: center;">
            <a href="${process.env.ADMIN_PANEL_URL || 'https://admin.premart.ae'}" 
               style="display: inline-block; background: ${isVerified ? '#10B981' : '#6366F1'}; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
              ${isVerified ? 'Login to Shop Panel' : 'Contact Support'}
            </a>
          </div>
          <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 32px;">© ${new Date().getFullYear()} ${APP_NAME} · support@premart.ae</p>
        </div>
      `,
    });

    if (error) {
      logger.error('sendShopVerificationEmail: Resend returned an error', { toEmail, shopName, isVerified, error });
      return false;
    }

    logger.info('sendShopVerificationEmail: shop verification email sent successfully', { toEmail, shopName, isVerified, messageId: data.id });
    return true;
  } catch (err) {
    logger.error('sendShopVerificationEmail: failed to send shop verification email', { toEmail, shopName, error: err });
    return false;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
const sendDeliveryBoyWelcomeEmail = async (toEmail, name, phone) => {
  if (!ensureResend()) return false;
  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: toEmail,
      subject: `✅ Welcome to PreMart Delivery Team!`,
      html: `
        <div style="max-width: 600px; margin: auto; padding: 24px; border: 1px solid #E5E7EB; border-radius: 12px; font-family: Arial, sans-serif;">
          <div style="background: linear-gradient(135deg, #3B82F6, #1D4ED8); border-radius: 8px; padding: 40px 20px; text-align: center;">
            <div style="font-size: 64px;">🚴</div>
            <h1 style="color: white; margin: 16px 0 0; font-size: 28px;">Welcome to PreMart!</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 15px;">You're now part of our delivery team</p>
          </div>
          <div style="padding: 24px; background: #FAFAFA; border-radius: 8px; margin: 24px 0;">
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0;">
              Hi <strong>${name}</strong>,<br><br>
              Your delivery agent account has been successfully created by your agency on <strong>PreMart</strong>.
              Download the PreMart Delivery app and log in using your phone number to get started.
            </p>
          </div>
          <div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <p style="color: #1E3A8A; font-size: 14px; margin: 0; font-weight: 600;">📱 How to Login</p>
            <ul style="color: #1E3A8A; font-size: 14px; margin: 8px 0 0; padding-left: 20px; line-height: 2;">
              <li>Open the PreMart Delivery app</li>
              <li>Enter your phone number: <strong>${phone}</strong></li>
              <li>Enter the OTP sent to your phone</li>
              <li>You're in — start accepting deliveries!</li>
            </ul>
          </div>
          <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <p style="color: #065F46; font-size: 14px; margin: 0; font-weight: 600;">🚀 Getting Started</p>
            <ul style="color: #065F46; font-size: 14px; margin: 8px 0 0; padding-left: 20px; line-height: 1.8;">
              <li>Set your status to <strong>Available</strong> to receive orders</li>
              <li>Keep your location services enabled</li>
              <li>Check your assigned area in the app</li>
            </ul>
          </div>
          <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 32px;">
            © ${new Date().getFullYear()} ${APP_NAME} · support@premart.ae
          </p>
        </div>
      `,
    });

    if (error) {
      logger.error('sendDeliveryBoyWelcomeEmail: Resend returned an error', { toEmail, name, error });
      return false;
    }

    logger.info('sendDeliveryBoyWelcomeEmail: welcome email sent successfully', { toEmail, name, messageId: data.id });
    return true;
  } catch (err) {
    logger.error('sendDeliveryBoyWelcomeEmail: failed to send welcome email', { toEmail, name, error: err });
    return false;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
const sendAgencyVerificationEmail = async (toEmail, agencyName, isVerified) => {
  if (!ensureResend()) return false;
  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: toEmail,
      subject: isVerified ? `✅ Your Agency is Verified - ${APP_NAME}` : `⚠️ Agency Verification Update - ${APP_NAME}`,
      html: `
        <div style="max-width: 600px; margin: auto; padding: 24px; border: 1px solid #E5E7EB; border-radius: 12px; font-family: Arial, sans-serif;">
          <div style="background: ${isVerified ? 'linear-gradient(135deg, #3B82F6, #2563EB)' : 'linear-gradient(135deg, #F59E0B, #D97706)'}; border-radius: 8px; padding: 40px 20px; text-align: center;">
            <div style="font-size: 64px;">${isVerified ? '✅' : '⚠️'}</div>
            <h1 style="color: white; margin: 16px 0 0; font-size: 28px;">${isVerified ? 'Agency Verified!' : 'Status Updated'}</h1>
          </div>
          <div style="padding: 24px; background: #FAFAFA; border-radius: 8px; margin: 24px 0;">
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0;">
              ${isVerified
                ? `Congratulations! <strong>${agencyName}</strong> has been verified by the PreMart team. You can now login and start managing deliveries.`
                : `Your agency <strong>${agencyName}</strong> verification status was updated. Please contact support for more details.`
              }
            </p>
          </div>
          ${isVerified ? `
          <div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <p style="color: #1E3A8A; font-size: 14px; margin: 0; font-weight: 600;">🚀 What's next?</p>
            <ul style="color: #1E3A8A; font-size: 14px; margin: 8px 0 0; padding-left: 20px; line-height: 1.8;">
              <li>Login to your agency panel</li>
              <li>Add your delivery team members</li>
              <li>Start accepting delivery assignments</li>
            </ul>
          </div>` : ''}
          <div style="text-align: center;">
            <a href="${process.env.ADMIN_PANEL_URL || 'https://admin.premart.ae'}" 
               style="display: inline-block; background: ${isVerified ? '#3B82F6' : '#6366F1'}; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
              ${isVerified ? 'Login to Agency Panel' : 'Contact Support'}
            </a>
          </div>
          <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 32px;">© ${new Date().getFullYear()} ${APP_NAME} · support@premart.ae</p>
        </div>
      `,
    });

    if (error) {
      logger.error('sendAgencyVerificationEmail: Resend returned an error', { toEmail, agencyName, isVerified, error });
      return false;
    }

    logger.info('sendAgencyVerificationEmail: agency verification email sent successfully', { toEmail, agencyName, isVerified, messageId: data.id });
    return true;
  } catch (err) {
    logger.error('sendAgencyVerificationEmail: failed to send agency verification email', { toEmail, agencyName, error: err });
    return false;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
const sendShopRejectionEmail = async (toEmail, shopName, rejectionReason) => {
  if (!ensureResend()) return false;
  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: toEmail,
      subject: `❌ Shop Registration Rejected - ${APP_NAME}`,
      html: `
        <div style="max-width: 600px; margin: auto; padding: 24px; border: 1px solid #E5E7EB; border-radius: 12px; font-family: Arial, sans-serif;">
          <div style="background: linear-gradient(135deg, #EF4444, #DC2626); border-radius: 8px; padding: 40px 20px; text-align: center;">
            <div style="font-size: 64px;">❌</div>
            <h1 style="color: white; margin: 16px 0 0; font-size: 28px;">Registration Rejected</h1>
          </div>
          <div style="padding: 24px; background: #FEF2F2; border-radius: 8px; margin: 24px 0;">
            <p style="color: #991B1B; font-size: 16px; line-height: 1.6; margin: 0;">
              Unfortunately, your shop registration for <strong>${shopName}</strong> has been rejected by the PreMart admin team.
            </p>
          </div>
          ${rejectionReason ? `
          <div style="background: #FFF7ED; border: 1px solid #FED7AA; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <p style="color: #9A3412; font-size: 14px; margin: 0 0 8px; font-weight: 600;">📋 Rejection Reason:</p>
            <p style="color: #9A3412; font-size: 14px; margin: 0; line-height: 1.6;">${rejectionReason}</p>
          </div>` : ''}
          <div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <p style="color: #1E3A8A; font-size: 14px; margin: 0; font-weight: 600;">💡 What can you do?</p>
            <ul style="color: #1E3A8A; font-size: 14px; margin: 8px 0 0; padding-left: 20px; line-height: 1.8;">
              <li>Review and correct the issues mentioned above</li>
              <li>Re-submit your registration with updated documents</li>
              <li>Contact our support team if you need clarification</li>
            </ul>
          </div>
          <div style="text-align: center;">
            <a href="${process.env.ADMIN_PANEL_URL || 'https://admin.premart.ae'}/register" 
               style="display: inline-block; background: #6366F1; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
              Register Again
            </a>
          </div>
          <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #E5E7EB; text-align: center;">
            <p style="color: #6B7280; font-size: 13px; margin: 0;">Need help? Contact us at:</p>
            <p style="color: #6366F1; font-size: 14px; margin: 4px 0 0; font-weight: 600;">
              <a href="mailto:support@premart.ae" style="color: #6366F1; text-decoration: none;">support@premart.ae</a>
            </p>
          </div>
          <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 32px;">© ${new Date().getFullYear()} ${APP_NAME}</p>
        </div>
      `,
    });

    if (error) {
      logger.error('sendShopRejectionEmail: Resend returned an error', { toEmail, shopName, error });
      return false;
    }

    logger.info('sendShopRejectionEmail: shop rejection email sent successfully', { toEmail, shopName, messageId: data.id });
    return true;
  } catch (err) {
    logger.error('sendShopRejectionEmail: failed to send shop rejection email', { toEmail, shopName, error: err });
    return false;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
const sendAgencyRejectionEmail = async (toEmail, agencyName, rejectionReason) => {
  if (!ensureResend()) return false;
  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: toEmail,
      subject: `❌ Agency Registration Rejected - ${APP_NAME}`,
      html: `
        <div style="max-width: 600px; margin: auto; padding: 24px; border: 1px solid #E5E7EB; border-radius: 12px; font-family: Arial, sans-serif;">
          <div style="background: linear-gradient(135deg, #EF4444, #DC2626); border-radius: 8px; padding: 40px 20px; text-align: center;">
            <div style="font-size: 64px;">❌</div>
            <h1 style="color: white; margin: 16px 0 0; font-size: 28px;">Registration Rejected</h1>
          </div>
          <div style="padding: 24px; background: #FEF2F2; border-radius: 8px; margin: 24px 0;">
            <p style="color: #991B1B; font-size: 16px; line-height: 1.6; margin: 0;">
              Unfortunately, your agency registration for <strong>${agencyName}</strong> has been rejected by the PreMart admin team.
            </p>
          </div>
          ${rejectionReason ? `
          <div style="background: #FFF7ED; border: 1px solid #FED7AA; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <p style="color: #9A3412; font-size: 14px; margin: 0 0 8px; font-weight: 600;">📋 Rejection Reason:</p>
            <p style="color: #9A3412; font-size: 14px; margin: 0; line-height: 1.6;">${rejectionReason}</p>
          </div>` : ''}
          <div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <p style="color: #1E3A8A; font-size: 14px; margin: 0; font-weight: 600;">💡 What can you do?</p>
            <ul style="color: #1E3A8A; font-size: 14px; margin: 8px 0 0; padding-left: 20px; line-height: 1.8;">
              <li>Review and correct the issues mentioned above</li>
              <li>Re-submit your registration with updated documents</li>
              <li>Contact our support team if you need clarification</li>
            </ul>
          </div>
          <div style="text-align: center;">
            <a href="${process.env.ADMIN_PANEL_URL || 'https://admin.premart.ae'}/register" 
               style="display: inline-block; background: #6366F1; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
              Register Again
            </a>
          </div>
          <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #E5E7EB; text-align: center;">
            <p style="color: #6B7280; font-size: 13px; margin: 0;">Need help? Contact us at:</p>
            <p style="color: #6366F1; font-size: 14px; margin: 4px 0 0; font-weight: 600;">
              <a href="mailto:support@premart.ae" style="color: #6366F1; text-decoration: none;">support@premart.ae</a>
            </p>
          </div>
          <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 32px;">© ${new Date().getFullYear()} ${APP_NAME}</p>
        </div>
      `,
    });

    if (error) {
      logger.error('sendAgencyRejectionEmail: Resend returned an error', { toEmail, agencyName, error });
      return false;
    }

    logger.info('sendAgencyRejectionEmail: agency rejection email sent successfully', { toEmail, agencyName, messageId: data.id });
    return true;
  } catch (err) {
    logger.error('sendAgencyRejectionEmail: failed to send agency rejection email', { toEmail, agencyName, error: err });
    return false;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  sendOTPEmail,
  sendOrderStatusEmail,
  sendShopVerificationEmail,
  sendAgencyVerificationEmail,
  sendDeliveryBoyWelcomeEmail,
  sendShopRejectionEmail,
  sendAgencyRejectionEmail,
};