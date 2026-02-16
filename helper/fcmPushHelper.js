/**
 * FCM push notifications via Firebase Admin SDK.
 * All data payload keys/values must be strings (FCM requirement).
 * App navigates from data (route/screen, order_id/id).
 */

let admin = null;
let messaging = null;

/**
 * Initialize Firebase Admin once at app startup.
 * Uses FIREBASE_SERVICE_ACCOUNT_PATH (path to JSON key file) or
 * FIREBASE_SERVICE_ACCOUNT_JSON (stringified JSON or base64).
 */
function initFirebase() {
  if (messaging) return;
  try {
    admin = require('firebase-admin');
    const pathModule = require('path');
    const fs = require('fs');
    const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    let credential;
    if (path) {
      const absPath = pathModule.isAbsolute(path) ? path : pathModule.join(process.cwd(), path);
      const raw = fs.readFileSync(absPath, 'utf8');
      const serviceAccount = JSON.parse(raw);
      credential = admin.credential.cert(serviceAccount);
    } else if (jsonEnv) {
      let obj;
      if (/^[A-Za-z0-9+/=]+$/.test(jsonEnv.trim())) {
        try {
          obj = JSON.parse(Buffer.from(jsonEnv, 'base64').toString('utf8'));
        } catch (_) {
          obj = JSON.parse(jsonEnv);
        }
      } else {
        obj = typeof jsonEnv === 'string' ? JSON.parse(jsonEnv) : jsonEnv;
      }
      credential = admin.credential.cert(obj);
    } else {
      console.warn('FCM: FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON not set; push disabled.');
      return;
    }
    if (!admin.apps.length) {
      admin.initializeApp({ credential });
    }
    messaging = admin.messaging();
    console.log('FCM: Firebase Admin initialized');
  } catch (err) {
    console.error('FCM init error:', err.message);
  }
}

/**
 * Get all FCM tokens for a user (multiple devices).
 * @param {string} userId - User ObjectId string
 * @returns {Promise<string[]>}
 */
async function getFcmTokensForUser(userId) {
  const DeviceToken = require('../models/DeviceToken');
  const docs = await DeviceToken.find({ user_id: userId }).lean();
  return docs.map((d) => d.device_token).filter(Boolean);
}

/**
 * Ensure all values in data are strings (FCM requirement).
 * @param {Record<string, any>} data
 * @returns {Record<string, string>}
 */
function stringifyData(data) {
  if (!data || typeof data !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = v == null ? '' : String(v);
  }
  return out;
}

/**
 * Remove invalid token from DB (e.g. unregistered or invalid).
 * @param {string} device_token
 */
async function removeToken(device_token) {
  const DeviceToken = require('../models/DeviceToken');
  await DeviceToken.deleteOne({ device_token });
}

/**
 * Send push to one user (all their devices). Handles missing/invalid tokens.
 * @param {string} userId - User ObjectId string (customer)
 * @param {string} title - Notification title (tray)
 * @param {string} body - Notification body (tray)
 * @param {Record<string, string>} data - Data payload; app uses route/screen and order_id/id. All values must be strings.
 */
async function sendPushToUser(userId, title, body, data) {
  if (!messaging) {
    console.warn('FCM push skipped (Firebase not initialized). Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON.');
    return;
  }
  const tokens = await getFcmTokensForUser(userId);
  if (!tokens.length) {
    console.warn(`FCM push skipped for user ${userId}: no device token registered. User must call POST /api/device/register and link via login.`);
    return;
  }
  const dataStr = stringifyData(data || {});
  for (const token of tokens) {
    try {
      await messaging.send({
        token,
        notification: { title: title || 'Notification', body: body || '' },
        data: dataStr,
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      });
      console.log(`FCM push sent to user ${userId} (${tokens.length} device(s))`);
    } catch (err) {
      const code = err.code || err.message || '';
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token' ||
        (typeof code === 'string' && code.includes('unregistered'))
      ) {
        await removeToken(token);
        console.warn('FCM: removed invalid token for user', userId);
      }
      console.error('FCM send error:', err.message);
    }
  }
}

module.exports = {
  initFirebase,
  getFcmTokensForUser,
  sendPushToUser,
  stringifyData,
};
