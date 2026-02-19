// services/emailService.js - Enhanced with all order status templates
const { Resend } = require('resend');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@autopartsnow.uk';
const APP_NAME = 'PreMart';

const ensureResend = () => {
  if (!resend) {
    console.warn('⚠️ Resend API key (RESEND_API_KEY) not set — email sending skipped.');
    return false;
  }
  return true;
};

// [Previous sendOTPEmail function remains the same...]
const sendOTPEmail = async (toEmail, otp, appName = APP_NAME) => {
  if (!ensureResend()) return false;
  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: toEmail,
      subject: `${otp} is your ${appName} password reset OTP`,
      html: `<div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 24px; border: 1px solid #E5E7EB; border-radius: 12px;">
          <div style="background: linear-gradient(135deg, #6366F1, #4F46E5); border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <h1 style="color: white; margin: 0; font-size: 22px;">${appName}</h1>
            <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 14px;">Password Reset Request</p>
          </div>
          <p style="color: #374151; font-size: 15px;">Hello,</p>
          <p style="color: #374151; font-size: 15px;">We received a request to reset your password. Use the OTP below — it expires in <strong>15 minutes</strong>.</p>
          <div style="font-size: 40px; font-weight: bold; letter-spacing: 10px; text-align: center; padding: 24px; background: #F3F4F6; border-radius: 10px; color: #1A1A2E; margin-bottom: 24px;">${otp}</div>
          <div style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; padding: 12px 16px;">
            <p style="color: #92400E; font-size: 13px; margin: 0;">⚠️ If you did not request this, please ignore this email.</p>
          </div>
          <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 24px;">© ${new Date().getFullYear()} ${appName}</p>
        </div>`,
    });
    if (error) {
      console.error('❌ Resend OTP error:', error);
      return false;
    }
    console.log('✅ OTP email sent — ID:', data.id);
    return true;
  } catch (err) {
    console.error('❌ Failed to send OTP email:', err.message);
    return false;
  }
};

// Order status email function
const sendOrderStatusEmail = async (toEmail, orderId, status, orderDetails) => {
  if (!ensureResend()) return false;
  try {
    const statusConfig = {
      'Pending': { icon: '📦', color: '#6366F1', title: 'Order Confirmed!', message: 'We\'ve received your order' },
      'Delivery Boy Assigned': { icon: '🚚', color: '#3B82F6', title: 'Delivery Partner Assigned', message: 'A delivery partner has been assigned' },
      'Accepted by Delivery Boy': { icon: '✅', color: '#10B981', title: 'Order Accepted', message: 'Your delivery partner accepted the order' },
      'Reached Pickup': { icon: '📍', color: '#8B5CF6', title: 'At Pickup Location', message: 'Partner reached the shop' },
      'Waiting to Pick': { icon: '⏳', color: '#F59E0B', title: 'Waiting to Pick Up', message: 'Order is ready for pickup' },
      'Order Picked': { icon: '🎒', color: '#06B6D4', title: 'Order Picked Up!', message: 'Order is on the way to you' },
      'Reached Drop': { icon: '🏠', color: '#EC4899', title: 'Partner at Your Location', message: 'Partner reached your address' },
      'Delivered': { icon: '🎉', color: '#10B981', title: 'Order Delivered!', message: 'Order delivered successfully!' },
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
      console.error('❌ Order status email error:', error);
      return false;
    }
    console.log(`✅ Order status email sent (${status}) — ID:`, data.id);
    return true;
  } catch (err) {
    console.error('❌ Failed to send order status email:', err.message);
    return false;
  }
};

const sendShopVerificationEmail = async (toEmail, shopName, isVerified) => {
  if (!ensureResend()) return false;
  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: toEmail,
      subject: isVerified ? `✅ Shop Verified - ${APP_NAME}` : `⚠️ Verification Updated - ${APP_NAME}`,
      html: `
        <div style="max-width: 600px; margin: auto; padding: 24px; border: 1px solid #E5E7EB; border-radius: 12px; font-family: Arial, sans-serif;">
          <div style="background: ${isVerified ? 'linear-gradient(135deg, #10B981, #059669)' : 'linear-gradient(135deg, #F59E0B, #D97706)'}; border-radius: 8px; padding: 40px 20px; text-align: center;">
            <div style="font-size: 64px;">${isVerified ? '✅' : '⚠️'}</div>
            <h1 style="color: white; margin: 16px 0 0; font-size: 28px;">${isVerified ? 'Shop Verified!' : 'Status Updated'}</h1>
          </div>
          <div style="padding: 24px; background: #FAFAFA; border-radius: 8px; margin: 24px 0;">
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0;">
              ${isVerified ? `Congratulations! <strong>${shopName}</strong> has been verified. You can now start receiving orders.` 
                         : `Your shop <strong>${shopName}</strong> verification status was updated. Contact support for details.`}
            </p>
          </div>
          <div style="text-align: center;">
            <a href="${process.env.ADMIN_PANEL_URL || 'https://admin.premart.ae'}" style="display: inline-block; background: #6366F1; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600;">Go to Admin Panel</a>
          </div>
          <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 32px;">© ${new Date().getFullYear()} ${APP_NAME}</p>
        </div>
      `,
    });
    if (error) return false;
    console.log('✅ Shop verification email sent');
    return true;
  } catch (err) {
    console.error('❌ Shop verification email failed:', err.message);
    return false;
  }
};

const sendAgencyVerificationEmail = async (toEmail, agencyName, isVerified) => {
  if (!ensureResend()) return false;
  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: toEmail,
      subject: isVerified ? `✅ Agency Verified - ${APP_NAME}` : `⚠️ Verification Updated - ${APP_NAME}`,
      html: `
        <div style="max-width: 600px; margin: auto; padding: 24px; border: 1px solid #E5E7EB; border-radius: 12px; font-family: Arial, sans-serif;">
          <div style="background: ${isVerified ? 'linear-gradient(135deg, #3B82F6, #2563EB)' : 'linear-gradient(135deg, #F59E0B, #D97706)'}; border-radius: 8px; padding: 40px 20px; text-align: center;">
            <div style="font-size: 64px;">${isVerified ? '✅' : '⚠️'}</div>
            <h1 style="color: white; margin: 16px 0 0; font-size: 28px;">${isVerified ? 'Agency Verified!' : 'Status Updated'}</h1>
          </div>
          <div style="padding: 24px; background: #FAFAFA; border-radius: 8px; margin: 24px 0;">
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0;">
              ${isVerified ? `Congratulations! <strong>${agencyName}</strong> has been verified. Start managing deliveries now.` 
                         : `Your agency <strong>${agencyName}</strong> verification status was updated. Contact support for details.`}
            </p>
          </div>
          <div style="text-align: center;">
            <a href="${process.env.ADMIN_PANEL_URL || 'https://admin.premart.ae'}" style="display: inline-block; background: #3B82F6; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600;">Go to Agency Panel</a>
          </div>
          <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 32px;">© ${new Date().getFullYear()} ${APP_NAME}</p>
        </div>
      `,
    });
    if (error) return false;
    console.log('✅ Agency verification email sent');
    return true;
  } catch (err) {
    console.error('❌ Agency verification email failed:', err.message);
    return false;
  }
};

module.exports = {
  sendOTPEmail,
  sendOrderStatusEmail,
  sendShopVerificationEmail,
  sendAgencyVerificationEmail
};