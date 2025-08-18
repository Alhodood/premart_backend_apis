/**
 * Delivery Agency Auth Controller
 * Endpoints:
 *  - POST /api/agency/auth/register
 *  - POST /api/agency/auth/login
 *  - GET  /api/agency/me or /api/agency/profile/:agencyId
 *  - PATCH /api/agency/me or /api/agency/profile/:agencyId
 *  - PATCH /api/agency/auth/password or /api/agency/change-password/:agencyId
 *  - GET  /api/agency/:agencyId/payments
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { DeliveryAgency } = require('../models/DeliveryAgency');
const DeliveryBoy = require('../models/DeliveryBoy');

/* ----------------------------- helpers ----------------------------- */

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';

// redact password fields and return a plain object
const safeAgency = (doc) => {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  delete obj.password;
  if (obj.agencyDetails) delete obj.agencyDetails.password;
  return obj;
};

// sign JWT using either top-level or nested email
const signToken = (agency) =>
  jwt.sign(
    {
      id: agency._id.toString(),
      email:
        agency.email ||
        agency.agencyDetails?.agencyMail ||
        agency.agencyDetails?.email ||
        '',
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

// Resolve requester id. Prefer `req.params.agencyId` (no-token mode), then `req.user.id` (middleware), then JWT Bearer header.
const getRequesterId = (req) => {
  // 1) Prefer explicit route param if present (no-token mode)
  const paramId = req?.params?.agencyId;
  if (paramId && mongoose.Types.ObjectId.isValid(paramId)) return paramId;

  // 2) Fallback to auth middleware-injected user id
  if (req.user?.id && mongoose.Types.ObjectId.isValid(req.user.id)) return req.user.id;

  // 3) Last resort: parse Bearer token from Authorization header
  const auth = req.headers?.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return payload.id;
  } catch {
    return null;
  }
};

// Whitelist updatable fields for agencyDetails
const pickAgencyDetails = (src = {}) => {
  const dst = {};
  const allowed = [
    'agencyName',
    'agencyAddress',
    'agencyMail',
    'agencyContact',
    'agencyLicenseNumber',
    'agencyLicenseExpiry',
    'emiratesId',
    'emiratesIdImage',
    'agencyLocation',
    'agencyLicenseImage',
    'termsAndCondition',
    'supportMail',
    'supportNumber',
    'payoutType',
    'agencyBankDetails',
  ];
  for (const k of allowed) {
    if (typeof src[k] !== 'undefined') dst[k] = src[k];
  }
  return dst;
};

/* ----------------------------- controllers ----------------------------- */

/**
 * POST /api/agency/auth/register
 * Body: { email, password, profileImage?, agencyDetails?{ ... } }
 */
exports.registerAgency = async (req, res) => {
  try {
    const { email, password, profileImage, agencyDetails = {} } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'email and password are required' });
    }

    const existing = await DeliveryAgency.findOne({
      $or: [
        { email },
        { 'agencyDetails.agencyMail': email },
        { 'agencyDetails.email': email }
      ],
    }).lean();

    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already in use' });
    }

    const hash = await bcrypt.hash(password, 10);

    // Build nested details and keep both top-level and nested creds for schema compatibility
    const details = {
      ...pickAgencyDetails(agencyDetails),
      agencyMail: agencyDetails.agencyMail || email,
      email: agencyDetails.email || email,
      password: agencyDetails.password || hash, // some schemas require nested password
    };

    const doc = await DeliveryAgency.create({
      email,
      password: hash,
      profileImage: profileImage || null,
      agencyDetails: details,
    });

    const token = signToken(doc);
    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      data: safeAgency(doc),
    });
  } catch (err) {
    console.error('registerAgency error:', err);
    return res.status(500).json({ success: false, message: 'Registration failed', error: err.message });
  }
};

/**
 * POST /api/agency/auth/login
 * Body: { email, password }
 */
exports.loginAgency = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'email and password are required' });
    }

    const agency = await DeliveryAgency.findOne({
      $or: [
        { email },
        { 'agencyDetails.agencyMail': email },
        { 'agencyDetails.email': email }
      ],
    });

    if (!agency) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const storedHash = agency.password || agency.agencyDetails?.password;
    if (!storedHash) {
      return res.status(400).json({ success: false, message: 'Password not set for this account' });
    }

    const ok = await bcrypt.compare(password, storedHash);
    if (!ok) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = signToken(agency);
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      data: safeAgency(agency),
    });
  } catch (err) {
    console.error('loginAgency error:', err);
    return res.status(500).json({ success: false, message: 'Login failed', error: err.message });
  }
};

/**
 * GET /api/agency/me or /api/agency/profile/:agencyId
 * Header: Authorization: Bearer &lt;jwt&gt;
 */
exports.getMyProfile = async (req, res) => {
  try {
    const id = getRequesterId(req);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(401).json({ success: false, message: 'Unauthorized or invalid agency id' });
    }
    const agency = await DeliveryAgency.findById(id);
    if (!agency) {
      return res.status(404).json({ success: false, message: 'Agency not found' });
    }
    return res.status(200).json({ success: true, data: safeAgency(agency) });
  } catch (err) {
    console.error('getMyProfile error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch profile', error: err.message });
  }
};

/**
 * PATCH /api/agency/me or /api/agency/profile/:agencyId
 * Body: { profileImage?, email?, agencyDetails?{...}, payoutType? }
 */
exports.updateMyProfile = async (req, res) => {
  try {
    const id = getRequesterId(req);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(401).json({ success: false, message: 'Unauthorized or invalid agency id' });
    }

    const update = {};
    const { profileImage, email, agencyDetails = {} } = req.body || {};

    if (typeof profileImage !== 'undefined') update.profileImage = profileImage;

    if (typeof email !== 'undefined') {
      // Ensure email is not taken by someone else
      const exists = await DeliveryAgency.findOne({
        _id: { $ne: id },
        $or: [{ email }, { 'agencyDetails.agencyMail': email }],
      }).lean();
      if (exists) {
        return res.status(409).json({ success: false, message: 'Email already in use by another account' });
      }
      update.email = email;
      update['agencyDetails.email'] = email;
      update['agencyDetails.agencyMail'] = email;
    }

    if (agencyDetails && Object.keys(agencyDetails).length) {
      // set individual fields within nested object
      const picked = pickAgencyDetails(agencyDetails);
      for (const [k, v] of Object.entries(picked)) {
        update[`agencyDetails.${k}`] = v;
      }
      if (agencyDetails.agencyMail) {
        update['agencyDetails.agencyMail'] = agencyDetails.agencyMail;
      } else if (email) {
        // keep agencyMail aligned with email if user changed email
        update['agencyDetails.agencyMail'] = email;
      }
    }

    const updated = await DeliveryAgency.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Agency not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: safeAgency(updated),
    });
  } catch (err) {
    console.error('updateMyProfile error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update profile', error: err.message });
  }
};

/**
 * PATCH /api/agency/auth/password or /api/agency/change-password/:agencyId
 * Body: { currentPassword, newPassword }
 */
exports.changePassword = async (req, res) => {
  try {
    const id = getRequesterId(req);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(401).json({ success: false, message: 'Unauthorized or invalid agency id' });
    }

    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'currentPassword and newPassword are required' });
    }

    const agency = await DeliveryAgency.findById(id);
    if (!agency) {
      return res.status(404).json({ success: false, message: 'Agency not found' });
    }

    const storedHash = agency.password || agency.agencyDetails?.password;
    if (!storedHash) {
      return res.status(400).json({ success: false, message: 'Password not set for this account' });
    }

    const ok = await bcrypt.compare(currentPassword, storedHash);
    if (!ok) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    agency.password = newHash;
    if (agency.agencyDetails) {
      agency.agencyDetails.password = newHash;
    }
    await agency.save();

    return res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    console.error('changePassword error:', err);
    return res.status(500).json({ success: false, message: 'Failed to change password', error: err.message });
  }
};

/**
 * GET /api/agency/:agencyId/payments
 * Query (optional): month=August 2025&amp;page=1&amp;limit=50
 * Returns only the paymentRecords for an agency, optionally filtered by month, with basic pagination and totals.
 */
exports.getAgencyPaymentRecords = async (req, res) => {
  try {
    // Prefer explicit route param, then fallback to token/param resolver
    const id = req.params.agencyId || getRequesterId(req);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Valid agencyId is required' });
    }

    const { month, page = 1, limit = 50 } = req.query;
    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.max(Math.min(parseInt(limit, 10) || 50, 200), 1);

    // Fetch only the fields we need
    const agency = await DeliveryAgency.findById(id, {
      'agencyDetails.agencyName': 1,
      'agencyDetails.agencyAddress': 1,
      paymentRecords: 1,
      createdAt: 1,
      updatedAt: 1
    }).lean();

    if (!agency) {
      return res.status(404).json({ success: false, message: 'Agency not found' });
    }

    let records = Array.isArray(agency.paymentRecords) ? agency.paymentRecords.slice() : [];

    // Optional month filter (exact match, e.g., "August 2025")
    if (month) {
      records = records.filter(r => String(r.month) === String(month));
    }

    // Sort by paymentDate desc (fallback to createdAt)
    records.sort((a, b) => {
      const ad = new Date(a.paymentDate || a.createdAt || 0).getTime();
      const bd = new Date(b.paymentDate || b.createdAt || 0).getTime();
      return bd - ad;
    });

    const total = records.length;

    // Pagination
    const start = (p - 1) * l;
    const end = start + l;
    const pageItems = records.slice(start, end);

    // Totals (sum of amounts on filtered set)
    const totalAmount = pageItems.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const grandTotalAmount = records.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    return res.status(200).json({
      success: true,
      message: 'Payment records fetched successfully',
      agency: {
        _id: agency._id,
        agencyName: agency.agencyDetails?.agencyName || null,
        agencyAddress: agency.agencyDetails?.agencyAddress || null,
      },
      meta: {
        month: month || null,
        totalRecords: total,
        page: p,
        limit: l,
        pageCount: Math.ceil(total / l),
        pageAmountTotal: totalAmount,
        grandAmountTotal: grandTotalAmount
      },
      data: pageItems
    });
  } catch (err) {
    console.error('getAgencyPaymentRecords error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch payment records',
      error: err.message
    });
  }
};

/**
 * GET /api/agency/:agencyId/delivery-boys
 * Query:
 *  - search: string (matches name or phone, case-insensitive)
 *  - online: true|false
 *  - available: true|false
 *  - page: number (default 20)
 *  - limit: number (default 20, max 100)
 *  - sort: string (e.g. "-updatedAt" or "name")
 */
exports.getAgencyDeliveryBoys = async (req, res) => {
  try {
    const { agencyId } = req.params;
    if (!agencyId || !mongoose.Types.ObjectId.isValid(agencyId)) {
      return res.status(400).json({ success: false, message: 'Valid agencyId is required' });
    }

    const {
      search,
      online,
      available,
      page = 1,
      limit = 20,
      sort = '-updatedAt'
    } = req.query;

    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const filter = { agencyId };

    if (typeof online !== 'undefined') {
      filter.isOnline = String(online).toLowerCase() === 'true';
    }
    if (typeof available !== 'undefined') {
      filter.availability = String(available).toLowerCase() === 'true';
    }
    if (search && String(search).trim().length) {
      const rx = new RegExp(String(search).trim(), 'i');
      filter.$or = [{ name: rx }, { phone: rx }];
    }

    const projection = 'name phone countryCode isOnline availability latitude longitude assignedOrders profileImage createdAt updatedAt agencyId email emiratesId areaAssigned city dob licenseNo accountVerify';

    const [deliveryBoys, total] = await Promise.all([
      DeliveryBoy.find(filter)
        .select(projection)
        .sort(sort)
        .skip((p - 1) * l)
        .limit(l)
        .lean(),
      DeliveryBoy.countDocuments(filter),
    ]);

    const formattedData = deliveryBoys.map(boy => ({
      _id: boy._id,
      name: boy.name || 'NA',
      phone: boy.phone || 'NA',
      agencyId: boy.agencyId || 'NA',
      emiratesId: boy.emiratesId || 'NA',
      areaAssigned: boy.areaAssigned || 'NA',
      city: boy.city || 'NA',
      dob: boy.dob || 'NA',
      licenseNo: boy.licenseNo || 'NA',
      email: boy.email || 'NA',
      accountVerify: boy.accountVerify || false,
      isOnline: boy.isOnline || false,
      latitude: boy.latitude || 'NA',
      longitude: boy.longitude || 'NA',
      availability: boy.availability || false,
      createdAt: boy.createdAt,
      assignedOrder: Array.isArray(boy.assignedOrders) ? boy.assignedOrders.length : 0,
    }));

    return res.status(200).json({
      success: true,
      message: 'Delivery boys fetched successfully',
      agencyId,
      meta: {
        page: p,
        limit: l,
        total,
        pageCount: Math.ceil(total / l),
        sort,
        filtersApplied: { search: search || null, online: typeof online !== 'undefined' ? String(online) : null, available: typeof available !== 'undefined' ? String(available) : null }
      },
      data: formattedData,
    });
  } catch (err) {
    console.error('getAgencyDeliveryBoys error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch delivery boys',
      error: err.message,
    });
  }
};
