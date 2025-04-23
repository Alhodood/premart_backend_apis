const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const twilio = require('twilio');
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret'; // Replace for production
const JWT_EXPIRE = process.env.JWT_EXPIRE || '1d';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTHTOKEN);





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
    const existingUser = await Admin.findOne({
      $or: [{ email }, { phone }]
    });
    if (existingUser) {
      return res.status(200).json({ message: 'User with provided email or phone already exists',success:false,data:[] });
    }
    
    // Create new user
    const user = new Admin(req.body);
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
    const user = await Admin.findOne({ email });
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

