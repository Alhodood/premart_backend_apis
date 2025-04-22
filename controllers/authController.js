const jwt = require('jsonwebtoken');
const User = require('../models/User');
const twilio = require('twilio');
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret'; // Replace for production
const JWT_EXPIRE = process.env.JWT_EXPIRE || '1d';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTHTOKEN);


// Helper to generate a random 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};
// Helper to generate a random string for temporary passwords
const generateRandomPassword = () => {
  return Math.random().toString(36).slice(-8);
};



// Register a new user
exports.register = async (req, res) => {

  try {
    // console.log(req.body);

    const { name, email, password, phone, role,dob,accountVerify,countryCode } = req.body;
    // Ensure that at least one identifier (email or phone) is provided
    if (!email && !phone) {
      return res.status(200).json({ message: 'Email or phone number is required',success:false,data:[] });
    }

    // Check if the user already exists based on email or phone
    const existingUser = await User.findOne({
      $or: [{ email }, { phone }]
    });
    if (existingUser) {
      return res.status(200).json({ message: 'User with provided email or phone already exists',success:false,data:[] });
    }
    
    // Create new user
    const user = new User(req.body);
    console.log(user);
    console.log("----------");

    await user.save();
    
    // Generate token upon successful registration
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRE });
    res.status(201).json({ message:"New user has created", data: { id: user._id, name, email, phone, role ,dob,token,accountVerify,countryCode} ,success:true,});
  } catch (error) {
    res.status(500).json({ message: 'Registration failed', data: error.message,success:false });
  }
};









// Login a user via email and password
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    // console.log(email);
    // Find user by email
    const user = await User.findOne({ email });
    console.log(user);

    if (!user) {
      return res.status(200).json({ message: 'Invalid credentials',success:false,data:[] });
    }
    
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(200).json({ message: 'Invalid password',success:false,data:[]  });
    }
    
    // Generate JWT token
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRE });
    res.status(200).json({ success:true, message:"logined successfuly",data: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role,accountVerify:user.accountVerify,countryCode:user.countryCode, tokenId:token } });
  
  } catch (error) {
    res.status(500).json({ message: 'Login failed', error: error.message });
  
  }
};

// Send OTP for login using phone number
// Send OTP for login using phone number.
// If the user does not exist, create a new user first.
// exports.sendOtp = async (req, res) => {
//   try {
//     const { phone } = req.body;
//     if (!phone) {
//       return res.status(400).json({ message: 'Phone number is required' });
//     }

//     // Look for the user by phone; if not found, create a new user with default values.
//     let user = await User.findOne({ phone });
//     if (!user) {
//       // Create a new user with a default name and role, plus a random password
//       const defaultData = {
//         name: 'New User',
//         phone,
//         password: generateRandomPassword(),
//         role: 'customer' // Default role can be adjusted
//       };
//       user = new User(defaultData);
//       await user.save();
//     }
    
//     // Generate OTP and set its expiration (e.g., 5 minutes)
//     const otp = generateOTP();
//     user.otp = otp;
//     user.otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
//     await user.save();

//     // In production, send this OTP via SMS. Here we return the OTP for testing.
//     res.status(200).json({ message: 'OTP sent successfully', otp });
//   } catch (error) {
//     res.status(500).json({ message: 'Failed to send OTP', error: error.message });
//   }
// };



exports.sendOtP = async () =>{
  try {
    const message = await client.messages.create(
      {
      body: `Your OTP code is: `,messagingServiceSid:"MGd6cd459ae374b36305530576a6fdf5f2",
    to: "+971567760353", 
    // from:"+12517660398"
    });

    // const verification = await client.verify.v2
    //   .services("MGd6cd459ae374b36305530576a6fdf5f2")
    //   .verifications
    //   .create({ to: phone, channel: 'sms' });
    // console.log('OTP sent, status:', verification.status);
    // console.log("OTP sent:", message.sendOtP);
    // console.log("OTP sent:", message.from);

      // return res.status(200).json({ message: ' OTP send' });

  } catch (error) {
  // return  res.status(500).json({ message: 'OTP verification failed', });

  }
}

// Verify OTP for phone login and generate a JWT token if the OTP is valid.
// exports.sendOtp = async (req, res) => {
//   try {
//     const { phone, otp } = req.body;
//     if (!phone || !otp) {
//       return res.status(400).json({ message: 'Phone number and OTP are required' });
//     }

//     // Find user by phone
//     const user = await User.findOne({ phone });
//     if (!user) {
//       return res.status(404).json({ message: 'User not found' });
//     }

//     // Validate the OTP and check if it's expired
//     if (user.otp !== otp || new Date() > user.otpExpires) {
//       return res.status(401).json({ message: 'Invalid or expired OTP' });
//     }
    
//     // Clear OTP fields after successful verification
//     user.otp = null;
//     user.otpExpires = null;
//     await user.save();

//     // Generate JWT token for the user
//     const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRE });
//     res.status(200).json({ token, user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role } });
//   } catch (error) {
//     res.status(500).json({ message: 'OTP verification failed', error: error.message });
//   }
// };
