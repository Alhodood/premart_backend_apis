const DeviceToken = require('../models/DeviceToken');

/**
 * Link device_id / device_token to a user (e.g. after login).
 * Call from auth when login body includes device_id and device_token.
 * @param {string} userId - Mongo ObjectId string or ObjectId
 * @param {string} [device_id]
 * @param {string} [device_token]
 */
async function linkDeviceToUser(userId, device_id, device_token) {
  if (!userId) return;
  const byId = device_id ? { device_id } : null;
  const byToken = device_token ? { device_token } : null;
  if (!byId && !byToken) return;
  const query = byId && byToken ? { $or: [byId, byToken] } : byId || byToken;
  await DeviceToken.updateMany(query, {
    user_id: userId,
    updated_at: new Date(),
  });
}

exports.linkDeviceToUser = linkDeviceToUser;

/**
 * POST /device/register
 * Body: { device_id, device_token }
 * Optional: If Authorization header present, link token to logged-in user.
 * Upserts by device_id so the same device can re-register (e.g. token refresh).
 */
exports.register = async (req, res) => {
  try {
    const { device_id, device_token } = req.body;

    if (!device_id || !device_token) {
      return res.status(400).json({
        success: false,
        message: 'device_id and device_token are required',
      });
    }

    const userId = req.user?.id || req.user?._id || null;

    const updated = await DeviceToken.findOneAndUpdate(
      { device_id },
      {
        device_token,
        user_id: userId,
        updated_at: new Date(),
      },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Device registered successfully',
      data: { device_id: updated.device_id, linked: !!updated.user_id },
    });
  } catch (err) {
    console.error('Device register error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to register device',
      error: err.message,
    });
  }
};
