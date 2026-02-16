const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const { optionalProtect } = require('../middleware/authMiddleware');

// App calls POST {baseUrl}/device/register with device_id + device_token (before or after login).
// optionalProtect: if Authorization present, link token to user_id; otherwise store with user_id null.
// Login handler also links device_id/device_token to user when sent in login body.
router.post('/register', optionalProtect, deviceController.register);

module.exports = router;
