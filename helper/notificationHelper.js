/**
 * Unified user notification: in-app (DB + socket) + push.
 * Use this for order events and any user-facing notification so they get both in-app and push.
 */

const UserNotification = require('../models/UserNotification');
const { sendPushToUser } = require('./fcmPushHelper');

/**
 * Notify a user: save in-app notification, emit socket for real-time, send FCM push.
 * @param {string} userId - User ObjectId string
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Record<string, string>} data - Payload for app (route, order_id, etc.). Values must be strings for FCM.
 * @param {string} type - 'order' | 'order_status' | 'promo' | 'info' | 'alert'
 * @returns {Promise<{ inApp: boolean, push: boolean }>}
 */
async function notifyUser(userId, title, body, data = {}, type = 'info') {
  if (!userId) return { inApp: false, push: false };

  const dataStr = typeof data === 'object' && data !== null ? data : {};
  const payload = {
    orderId: dataStr.order_id || dataStr.orderId || null,
    route: dataStr.route || null,
    shopId: dataStr.shopId || null,
    extra: dataStr
  };

  let inApp = false;
  let push = false;

  try {
    const doc = await UserNotification.create({
      userId,
      title: title || 'Notification',
      body: body || '',
      type,
      data: payload,
      read: false
    });
    inApp = true;

    try {
      const socketService = require('../sockets/socket');
      if (socketService.emitToUser) {
        socketService.emitToUser(userId, 'new_notification', {
          id: doc._id,
          title: doc.title,
          body: doc.body,
          type: doc.type,
          data: doc.data,
          createdAt: doc.createdAt
        });
      }
    } catch (e) {
      // Socket may not be initialized or user not connected
    }

    await sendPushToUser(userId, title || 'Notification', body || '', dataStr);
    push = true;
  } catch (err) {
    console.error('notifyUser error:', err.message);
  }

  return { inApp, push };
}

/**
 * Send only push (e.g. when no in-app record needed). Prefer notifyUser when you want in-app + push.
 */
async function sendPushOnly(userId, title, body, data) {
  return sendPushToUser(userId, title, body, data);
}

module.exports = {
  notifyUser,
  sendPushOnly
};
