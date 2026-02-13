// @deprecated — replaced by unified role-based auth in authController.js
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const twilio = require('twilio');
const { ROLES } = require('../../constants/roles');

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTHTOKEN);
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const JWT_EXPIRE = '7d';

const generateToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRE });
};



// ===========================
// REGISTER
// ===========================
exports.registerUser = async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const user = await User.create({
      name,
      email,
      phone,
      password,
       role: role || ROLES.CUSTOMER
    });

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        token
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// ===========================
// LOGIN
// ===========================
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const token = generateToken(user);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        token
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
// delete Account
exports.deletAddcount = async (req, res) => {
  const  _id= req.params.userId;
  try {
    const user = await User.findOne({_id});
    if (!user) {
      // Auto-register new user
      return res.status(200).json({ message: 'user not founded. please enter valid phone number', success:false, data:[] });
    }
user.accountVisibility=false;
await user.save();
    res.status(200).json({ message: "Your account is deleted ", success: true ,data:user});
  } catch (err) {
    res.status(500).json({ message: 'Somthing went wrong', success: false, error: err.message });
  }
};

//// OTP





exports.getProfile = async (req, res) => {
  try {
    const userId = req.params.userId;                // <-- correct param
    if (!userId) {
      return res.status(400).json({ message: 'userId param is required', success: false });
    }

    const user = await User.findById(userId).select('-password'); // <-- findById
    if (!user) {
      return res.status(404).json({ message: 'User not found', success: false });
    }

    res.status(200).json({
      message: 'Profile details successfully',
      success: true,
      data: user
    });
  } catch (err) {
    res.status(500).json({
      message: 'Failed to fetch profile',
      success: false,
      error: err.message
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.params.userId;                // <-- correct param
    if (!userId) {
      return res.status(400).json({ message: 'userId param is required', success: false });
    }

    const { name, email, phone, dob, profileImage } = req.body;

    const user = await User.findById(userId);        // <-- findById
    if (!user) {
      return res.status(404).json({ message: 'User not found', success: false });
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (dob) user.dob = dob;
    if (profileImage !== undefined) user.profileImage = profileImage;

    if (phone && phone !== user.phone) {
      user.accountVerify = false;
      user.phone = phone;
    }

    await user.save();

    res.status(200).json({
      message: 'Profile updated successfully',
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        accountStatus: user.accountVerify,
        dob: user.dob,
        profileImage: user.profileImage,
      }
    });
  } catch (err) {
    res.status(500).json({
      message: 'Failed to update profile',
      success: false,
      error: err.message
    });
  }
};

exports.updateUserAddress = async (req, res) => {
  try {
    const userId = req.params.id;
    const addressId = req.params.addressId;
    const updateData = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found', success: false });
    }

    let addressFound = false;

    for (let i = 0; i < user.address.length; i++) {
      if (user.address[i]._id.toString() === addressId) {
        // If this address is being set to default
        if (updateData.default === true) {
          // Set all other addresses' default to false
          user.address.forEach((addr, index) => {
            user.address[index].default = false;
          });
        }

        // Update the specific address
        user.address[i] = {
          ...user.address[i]._doc,
          ...updateData
        };
        addressFound = true;
        break;
      }
    }

    if (!addressFound) {
      return res.status(404).json({ message: 'Address not found', success: false });
    }

    const updatedUser = await user.save();

    res.status(200).json({
      message: 'Address updated successfully',
      success: true,
      data: updatedUser.address
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to update address',
      success: false,
      error: error.message
    });
  }
};


exports.addNewAddress = async (req, res) => {
  try {
    const userId = req.params.id;
    const newAddress = req.body; // should match address schema
console.log(newAddress);
    const user = await User.findById(userId);
    if (!user) {
      return res.status(200).json({ message: "User not found", success: false });
    }

    user.address.push(newAddress);
    await user.save();

    res.status(200).json({
      success: true,
      message: "Address added successfully",
      data: user.address
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to add address", success: false, error: error.message });
  }
};

exports.deleteAddressById = async (req, res) => {
  try {
    const userId = req.params.id;
    const addressId = req.params.addressId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(200).json({ message: "User not found", success: false });
    }

    const originalLength = user.address.length;
    console.log(addressId);

    user.address = user.address.filter(
      (addr) => addr._id.toString() !== addressId
    );
    console.log(user.address);

    if (user.address.length === originalLength) {
      return res.status(200).json({ message: "Address not found", success: false });
    }
    if (!user.address) {
      return res.status(200).json({ message: "Address not found", success: false });
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Address deleted successfully",
      data: user.address
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete address", success: false, error: error.message });
  }
};


exports.getAllAddresses = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId).select('address');

    if (!user) {
      return res.status(404).json({ message: "User not found", success: false });
    }

    res.status(200).json({
      success: true,
      message: "Addresses fetched successfully",
      data: user.address
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch addresses", success: false, error: error.message });
  }
};

exports.getDefultAddress = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found", success: false });
    }

    const defaultAddress = user.address.find(addr => addr.default === true);

    return res.status(200).json({
      success: true,
      message: "Default address fetched successfully",
      data: defaultAddress ? defaultAddress : [] 
       // return array or empty list
    });

  } catch (error) {
    res.status(500).json({ 
      message: "Failed to fetch address", 
      success: false, 
      data: error.message 
    });
  }
};


// exports.deleteAddress = async (req, res) => {
//   try {
//     const { id: userId, addressId } = req.params;

//     const user = await User.findById(userId);

//     if (!user) {
//       return res.status(404).json({ message: "User not found", success: false });
//     }

//     const originalLength = user.address.length;
//     user.address = user.address.filter(addr => addr._id.toString() !== addressId);

//     if (user.address.length === originalLength) {
//       return res.status(404).json({ message: "Address not found", success: false });
//     }

//     await user.save();

//     res.status(200).json({
//       success: true,
//       message: "Address deleted successfully",
//       data: user.address
//     });
//   } catch (error) {
//     res.status(500).json({ message: "Failed to delete address", success: false, error: error.message });
//   }
// };


// card crud



exports.updateUserCard = async (req, res) => {
  try {
    const userId = req.params.id;
    const cardId = req.params.cardId;
    const updateData = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found', success: false });
    }

    let addressFound = false;

    for (let i = 0; i < user.card.length; i++) {
      if (user.card[i]._id.toString() === cardId) {
        user.card[i] = {
          ...user.card[i]._doc,
          ...updateData
        };
        addressFound = true;
        break;
      }
    }

    if (!addressFound) {
      return res.status(404).json({ message: 'Card not found', success: false });
    }

    const updatedUser = await user.save();

    res.status(200).json({
      message: 'Address updated successfully',
      success: true,
      data: updatedUser.card
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to update address',
      success: false,
      error: error.message
    });
  }
};

exports.addNewCard = async (req, res) => {
  try {
    const userId = req.params.id;
    const newCard = req.body; // should match address schema
console.log(newCard);
    const user = await User.findById(userId);
    if (!user) {
      return res.status(200).json({ message: "User not found", success: false });
    }

    user.card.push(newCard);
    await user.save();

    res.status(200).json({
      success: true,
      message: "Card added successfully",
      data: user.card
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to add card", success: false, error: error.message });
  }
};

exports.deleteCardById = async (req, res) => {
  try {
    const userId = req.params.id;
    const cardId = req.params.cardId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(200).json({ message: "User not found", success: false });
    }

    const originalLength = user.card.length;
    

    user.card = user.card.filter(
      (addr) => addr._id.toString() !== cardId
    );
    // console.log(user.card);

    if (user.card.length === originalLength) {
      return res.status(200).json({ message: "Card not found", success: false });
    }
    if (!user.card) {
      return res.status(200).json({ message: "Card not found", success: false });
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Card deleted successfully",
      data: user.card
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete card", success: false, error: error.message });
  }
};


exports.getAllCard = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId).select('card');

    if (!user) {
      return res.status(404).json({ message: "User not found", success: false });
    }

    res.status(200).json({
      success: true,
      message: "Card fetched successfully",
      data: user.card
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch card", success: false, error: error.message });
  }
};


// Customer OTP flows
exports.sendOtpToCustomer = async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ message: 'Phone is required', success: false });
  }
  try {
    await client.verify.v2.services(process.env.TWILIO_SERVICE_SID)
      .verifications
      .create({ to: phone, channel: 'sms' });
    return res.status(200).json({ message: 'OTP sent successfully', success: true });
  } catch (err) {
    console.error('Send OTP Error:', err);
    res.status(500).json({ message: 'Failed to send OTP', success: false, error: err.message });
  }
};

exports.resendOtpToCustomer = async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ message: 'Phone is required', success: false });
  }
  try {
    await client.verify.v2.services(process.env.TWILIO_SERVICE_SID)
      .verifications
      .create({ to: phone, channel: 'sms' });
    return res.status(200).json({ message: 'OTP resent successfully', success: true });
  } catch (err) {
    console.error('Resend OTP Error:', err);
    res.status(500).json({ message: 'Failed to resend OTP', success: false, error: err.message });
  }
};

exports.verifyOtpForCustomer = async (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) {
    return res.status(400).json({ message: 'Phone and OTP code are required', success: false });
  }

  try {
    // ✅ 1. Bypass Twilio if fallback OTP is used
    if (code === '311299') {
      let user = await User.findOne({ phone });
      if (!user) {
        user = new User({
          phone,
          accountVerify: true,
          role: 'customer',
          password: phone
        });
        await user.save();
      } else {
        user.accountVerify = true;
        await user.save();
      }
      const token = generateToken(user);
      return res.status(200).json({
        message: 'OTP verified successfully (test override)',
        success: true,
        data: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          accountStatus: user.accountVerify,
          dob: user.dob,
          token
        }
      });
    }

    // ✅ 2. Normal Twilio verification
    const verification = await client.verify.v2
      .services(process.env.TWILIO_SERVICE_SID)
      .verificationChecks
      .create({ to: phone, code });

    if (verification.status === 'approved') {
      let user = await User.findOne({ phone });
      if (!user) {
        user = new User({
          phone,
          accountVerify: true,
          role: 'customer',
          password: phone
        });
        await user.save();
      } else {
        user.accountVerify = true;
        await user.save();
      }
      const token = generateToken(user);
      return res.status(200).json({
        message: 'OTP verified successfully',
        success: true,
        data: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          accountStatus: user.accountVerify,
          dob: user.dob,
          token
        }
      });
    } else {
      return res.status(401).json({ message: 'Invalid OTP', success: false });
    }
  } catch (err) {
    console.error('Verify OTP Error:', err);
    res.status(500).json({ message: 'OTP verification failed', success: false, error: err.message });
  }
};
// Get all users (without password)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');

    const simplifiedUsers = users.map(user => {
      const defaultAddress = user.address?.find(addr => addr.default === true);
      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        accountVisibility: user.accountVisibility,
        dob: user.dob,
        accountVerify: user.accountVerify,
        area: defaultAddress?.area || '',
        place: defaultAddress?.place || '',
        createdAt: user.createdAt
      };
    });

    res.status(200).json({
      success: true,
      message: 'Users fetched successfully',
      data: simplifiedUsers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
};