const { ROLES } = require('./roles');
const User = require('../models/User');
const DeliveryBoy = require('../models/DeliveryBoy');
const { ShopAdmin, SuperAdmin } = require('../models/AdminAuth');
const { DeliveryAgency } = require('../models/DeliveryAgency');

module.exports = {
  [ROLES.CUSTOMER]: User,
  [ROLES.DELIVERY_BOY]: DeliveryBoy,
  [ROLES.SHOP_ADMIN]: ShopAdmin,
  [ROLES.SUPER_ADMIN]: SuperAdmin,
  [ROLES.AGENCY]: DeliveryAgency,
};