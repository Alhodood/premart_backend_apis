const Notification = require('../models/superNotification');
const twilio = require('twilio');

// Replace with your actual Twilio credentials
const accountSid = process.env.TWILIO_ACCOUNT_SID; 
const authToken = process.env.TWILIO_AUTHTOKEN; 
const twilioPhone = process.env.TWILIO_PHONE_NUMBER; 

const client = twilio(accountSid, authToken);

// 1. Create & (Optionally) Send Notification
exports.createNotification = async (req, res) => {
  try {
    const { title, message, recipients, sendNow, scheduledAt } = req.body;

    if (!title || !message || !recipients || recipients.length === 0) {
      return res.status(400).json({
        message: 'Title, message, and recipients are required',
        success: false
      });
    }

    // Create initial notification record
    const notification = new Notification({
      title,
      message,
      recipients,
      sendNow,
      scheduledAt: sendNow ? null : scheduledAt,
      status: sendNow ? 'Sent' : 'Pending',
      sentAt: sendNow ? new Date() : null
    });

    await notification.save();

    if (sendNow) {
      // Try sending SMS now via Twilio
      try {
        for (const phone of recipients) {
          await client.messages.create({
            body: message,
            from: twilioPhone,
            to: phone
          });
        }

        // Update as Sent if success
        notification.status = 'Sent';
        notification.sentAt = new Date();
        await notification.save();

      } catch (twilioError) {
        console.error('Twilio Send Error:', twilioError.message);
        notification.status = 'Failed';
        notification.failureReason = twilioError.message;
        await notification.save();

        return res.status(500).json({
          message: 'Failed to send SMS via Twilio',
          success: false,
          data: twilioError.message
        });
      }
    }

    return res.status(201).json({
      message: sendNow ? 'Notification sent successfully' : 'Notification scheduled successfully',
      success: true,
      data: notification
    });

  } catch (error) {
    console.error('Create Notification Error:', error.message);
    res.status(500).json({
      message: 'Failed to create notification',
      success: false,
      data: error.message
    });
  }
};


exports.getAllNotifications = async (req, res) => {
    try {
      const {
        search,
        status,
        from,
        to,
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sort = 'desc'
      } = req.query;
  
      let filter = {};
  
      // Search by Title or Message
      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: 'i' } },
          { message: { $regex: search, $options: 'i' } }
        ];
      }
  
      // Filter by status
      if (status) {
        filter.status = status; // Pending / Sent / Failed
      }
  
      // Filter by date range
      if (from && to) {
        filter.createdAt = {
          $gte: new Date(from),
          $lte: new Date(to)
        };
      }
  
      const notifications = await Notification.find(filter)
        .sort({ [sortBy]: sort === 'asc' ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));
  
      const total = await Notification.countDocuments(filter);
  
      return res.status(200).json({
        message: 'Notifications fetched successfully',
        success: true,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        data: notifications
      });
  
    } catch (error) {
      console.error('Get Notifications Error:', error.message);
      res.status(500).json({
        message: 'Failed to fetch notifications',
        success: false,
        data: error.message
      });
    }
  };