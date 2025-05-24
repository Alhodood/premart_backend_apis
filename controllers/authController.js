const jwt = require('jsonwebtoken');
const User = require('../models/User');
const twilio = require('twilio');

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTHTOKEN);
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const JWT_EXPIRE = '7d';

const generateToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRE });
};


// controllers/userController.js
exports.registerUser1 = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      dob,
      address,
      card
    } = req.body;

    if (!name || !email || !phone || !password || !address || !card) {
      return res.status(400).json({ message: 'All fields are required', success: false });
    }

    const user = new User({
      name,
      email,
      phone,
      password,
      dob,
      address,
      card
    });

    await user.save();

    return res.status(201).json({
      message: 'User registered successfully',
      success: true,
      data: {
        userId: user._id,
        email: user.email,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('Register Error:', error);
    return res.status(500).json({
      message: 'User registration failed',
      success: false,
      error: error.message
    });
  }
};

exports.registerUser = async (req, res) => {
  try {
    const { name, email, phone, password, countryCode, dob, role } = req.body;

    // Basic validation
    if (!name || !email || !phone || !password || !countryCode) {
      return res.status(200).json({
        message: 'All required fields must be provided',
        success: false
      });
    }

    // Check if user exists
    const existing = await User.findOne({ $or: [{ email }, { phone }] });
    if (existing) {
      return res.status(200).json({
        message: 'Email or phone already registered',
        success: false
      });
    }

    const newUser = new User({
      name,
      email,
      phone,
      password,
      countryCode,
      dob,
      role // defaults to customer if not passed
    });

    await newUser.save();

    return res.status(201).json({
      message: 'User registered successfully',
      success: true,
      data: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role
      }
    });

  } catch (error) {
    console.error('Registration Error:', error);
    return res.status(500).json({
      message: 'Registration failed',
      success: false,
      data: error.message
    });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(200).json({
        message: 'Email and password are required',
        success: false
      });
    }
    console.log(email);

    // 🔍 Find user by email
    const user = await User.findOne({ email });
console.log(user);
    if (!user) {
      return res.status(200).json({
        message: 'User not found',
        success: false
      });
    }

    // 🔐 Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(200).json({
        message: 'Invalid password',
        success: false
      });
    }

    return res.status(200).json({
      message: 'Login successful',
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        accountStatus: user.accountVerify,dob:user.dob ,
      
      }
    });

  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({
      message: 'Login failed',
      success: false,
      data: error.message
    });
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



//OTP LOGIN AND REGISTER through twilio
exports.sendOtp = async (req, res) => {
  const { phone, role } = req.body;

  try {
    if (!phone) return res.status(200).json({ message: 'Phone and role are required', success:false, data:[] });

    let user = await User.findOne({ phone });
    if (!user) {
      // Auto-register new user
      return res.status(200).json({ message: 'user not founded. please enter valid phone number', success:false, data:[] });

    }

   const otpResponse= await client.verify.v2.services(process.env.TWILIO_SERVICE_SID)
      .verifications
      .create({ to:phone, channel: 'sms' });

    res.status(200).json({ message: 'OTP sent to '+phone, success: true ,data:otpResponse});
  } catch (err) {
    res.status(500).json({ message: 'OTP send failed', success: false, error: err.message });
  }
};


// ✅ Verify OTP
exports.verifyOtp = async (req, res) => {
  const { phone, code } = req.body;

  if (!phone || !code) return res.status(400).json({ message: 'Phone and OTP are required' });

  try {
    const verification = await client.verify.v2.services(process.env.TWILIO_SERVICE_SID)
      .verificationChecks
      .create({ to: phone, code });
console.log(verification.status);
    if (verification.status === 'approved') {
      const user = await User.findOne({ phone });
      if (!user) return res.status(404).json({ message: 'User not found' });
user.accountVerify=true;
await user.save();
      res.status(200).json({
        message: 'OTP verified. Login successful',
        success: true,
        data: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          accountStatus: user.accountVerify,dob:user.dob ,
        
        }
      });
    } else {
      res.status(401).json({ message: 'Invalid OTP', success: false });
    }
  } catch (err) {
    res.status(500).json({ message: 'OTP verification failed', success: false, error: err.message });
  }
};


exports.resendOtp = async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ message: 'Phone number is required' });
  }

  try {
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(200).json({ message: 'User not found. Please register.' , });
    }

    await client.verify.v2.services(process.env.TWILIO_SERVICE_SID)
      .verifications
      .create({ to: phone, channel: 'sms' });

    res.status(200).json({ message: 'OTP resent successfully', success: true });
  } catch (err) {
    res.status(500).json({ message: 'Failed to resend OTP', success: false, error: err.message });
  }
};


exports.getProfile = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findOne(userId).select('-password');

    if (!user) {
      return res.status(200).json({ message: 'User not found', success: false });
    }

    

    res.status(200).json({
      message: 'Profile details successfully',
      success: true,
      data: user
    });
  } catch (err) {
    res.status(500).json({
      message: 'Failed to update profile',
      success: false,
      error: err.message
    });
  }
};


exports.updateProfile = async (req, res) => {
  try {
    const userId = req.params.id;
    const {  name, email, phone, dob } = req.body;

    const user = await User.findOne(userId);

    if (!user) {
      return res.status(200).json({ message: 'User not found', success: false });
    }

    // Optional: Only update if value is provided
    if (name) user.name = name;
    if (email) user.email = email;
    if (dob) user.dob = dob;
    if (phone !== user.phone) {
      console.log("number is changed");
      user.accountVerify = false;
    // await user.save();
    }
    if (phone) user.phone = phone;

    // console.log(user.address);
    // if (address) user.address = address;

    await user.save();

    res.status(200).json({
      message: 'Profile updated successfully',
      success: true,
      data: {      id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        accountStatus: user.accountVerify,dob:user.dob ,
      
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
