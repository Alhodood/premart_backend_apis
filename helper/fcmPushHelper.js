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
    console.log('🔥 FCM init - PATH from env:', path);      // ← ADD THIS
    console.log('🔥 FCM init - CWD:', process.cwd());       // ← ADD THIS
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
 * Deduplicated so the same token is never returned twice (avoids duplicate notifications on iOS).
 * @param {string} userId - User ObjectId string
 * @returns {Promise<string[]>}
 */
async function getFcmTokensForUser(userId) {
  const DeviceToken = require('../models/DeviceToken');
  const docs = await DeviceToken.find({ user_id: userId }).lean();
  const tokens = docs.map((d) => d.device_token).filter(Boolean);
  return [...new Set(tokens)];
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
 * Send push to a single FCM token (e.g. DeliveryBoy.activeDeviceToken).
 * @param {string} token - FCM device token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Record<string, string>} data - Data payload (values stringified)
 */
async function sendPushToToken(token, title, body, data) {
  if (!token || typeof token !== 'string') return;
  initFirebase();
  if (!messaging) return;
  const dataStr = stringifyData(data || {});

  try {
    await messaging.send({
      token,

      // ✅ TOP-LEVEL notification — required for iOS sound to fire
      notification: {
        title: title || '🛵 New Order Available!',
        body: body || `📍 Pickup: ${dataStr.pickup_distance}km away`,
      },

      data: dataStr,

      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'high_importance_channel',
        },
      },

      apns: {
        headers: {
          'apns-priority': '10',           // ✅ 10 = alert push (sound), 5 = silent
          'apns-push-type': 'alert',       // ✅ must be 'alert' for sound
        },
        payload: {
          aps: {
            alert: {
              title: title || '🛵 New Order Available!',
              subtitle: `Earn AED ${dataStr.earning}`,
              body: body || `📍 Pickup: ${dataStr.pickup_distance}km away`,
            },
            sound: 'default',              // ✅ THIS is what triggers the sound
            badge: 1,
            'mutable-content': 1,
            // ❌ REMOVED 'content-available': 1 — this turns it into a
            //    background/silent push which SUPPRESSES sound on iOS
          },
        },
        fcmOptions: {
          imageUrl: 'https://premart2026.s3.us-east-1.amazonaws.com/db.png',
        },
      },
    });
    console.log('✅ FCM push sent to token');
  } catch (err) {
    console.error('FCM send error (token):', err.message);
    if (
      err.code === 'messaging/registration-token-not-registered' ||
      err.code === 'messaging/invalid-registration-token'
    ) {
      await removeToken(token);
      console.warn('FCM: removed invalid token');
    }
  }
}

/**
 * Send push to one user (all their devices). Handles missing/invalid tokens.
 * @param {string} userId - User ObjectId string (customer)
 * @param {string} title - Notification title (tray)
 * @param {string} body - Notification body (tray)
 * @param {Record<string, string>} data - Data payload; app uses route/screen and order_id/id. All values must be strings.
 */
async function sendPushToUser(userId, title, body, data) {
  initFirebase();
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
  const notifTitle = title || 'Notification';
  const notifBody = body || '';
  for (const token of tokens) {
    try {
      await messaging.send({
        token,
        notification: { title: notifTitle, body: notifBody },
        data: dataStr,
        android: { priority: 'high' },
        apns: {
          payload: {
            aps: {
              alert: { title: notifTitle, body: notifBody },
              sound: 'default',
              badge: 1,
            },
          },
        },
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
  sendPushToToken,
  stringifyData,
};
