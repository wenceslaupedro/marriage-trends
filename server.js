const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fetch = require('node-fetch');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Create email transporter with Gmail configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'marriagetrends1@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

// Verify SMTP connection
transporter.verify(function(error, success) {
  if (error) {
    console.error('SMTP Connection Error:', error);
  } else {
    console.log('SMTP Server is ready to send emails');
  }
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Schema
const subscriberSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String,
  isConfirmed: { type: Boolean, default: false },
  confirmationToken: String,
  createdAt: { type: Date, default: Date.now }
});

const Subscriber = mongoose.model('Subscriber', subscriberSchema);

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Generate a random token for email confirmation
function generateConfirmationToken() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Send confirmation email
async function sendConfirmationEmail(email, firstName, confirmationToken) {
  const confirmationLink = `${process.env.BASE_URL}/confirm?token=${confirmationToken}`;
  
  const mailOptions = {
    from: 'Marriage Trends <marriagetrends1@gmail.com>',
    to: email,
    subject: 'Confirm your subscription to Marriage Trends',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #2c3e50;">Welcome to Marriage Trends!</h1>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
          <p style="color: #2c3e50; font-size: 16px;">Dear ${firstName},</p>
          
          <p style="color: #2c3e50; font-size: 16px;">Thank you for subscribing to Marriage Trends! We're excited to have you join our community of individuals interested in marriage statistics and trends.</p>
          
          <p style="color: #2c3e50; font-size: 16px;">To complete your subscription and start receiving our updates, please confirm your email address by clicking the button below:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${confirmationLink}" 
               style="background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Confirm My Subscription
            </a>
          </div>
          
          <p style="color: #2c3e50; font-size: 16px;">If the button above doesn't work, you can also copy and paste this link into your browser:</p>
          <p style="color: #3498db; font-size: 14px; word-break: break-all;">${confirmationLink}</p>
          
          <p style="color: #2c3e50; font-size: 16px;">If you did not subscribe to our newsletter, please ignore this email.</p>
        </div>
        
        <div style="margin-top: 30px; text-align: center; color: #7f8c8d; font-size: 14px;">
          <p>Best regards,<br>The Marriage Trends Team</p>
          <p style="margin-top: 20px;">© ${new Date().getFullYear()} Marriage Trends. All rights reserved.</p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Confirmation email sent to:', email);
  } catch (error) {
    console.error('Error sending confirmation email:', error);
    throw error;
  }
}

// Routes
app.post('/api/subscribe', async (req, res) => {
  try {
    const { firstName, lastName, email } = req.body;
    const confirmationToken = generateConfirmationToken();

    // Save to MongoDB
    const subscriber = new Subscriber({ 
      firstName, 
      lastName, 
      email,
      confirmationToken
    });
    await subscriber.save();

    // Send confirmation email
    await sendConfirmationEmail(email, firstName, confirmationToken);

    res.json({ 
      success: true, 
      message: 'Please check your email to confirm your subscription!' 
    });
  } catch (error) {
    console.error('Subscription error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Confirm subscription endpoint
app.get('/api/confirm', async (req, res) => {
  try {
    const { token } = req.query;
    
    const subscriber = await Subscriber.findOne({ confirmationToken: token });
    
    if (!subscriber) {
      return res.status(400).json({ success: false, message: 'Invalid confirmation token' });
    }

    if (subscriber.isConfirmed) {
      return res.json({ success: true, message: 'Email already confirmed' });
    }

    subscriber.isConfirmed = true;
    await subscriber.save();

    // Add to MailerLite after confirmation
    const mlResponse = await fetch('https://api.mailerlite.com/api/v2/subscribers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MailerLite-ApiKey': process.env.MAILERLITE_API_KEY
      },
      body: JSON.stringify({
        email: subscriber.email,
        fields: {
          name: subscriber.firstName,
          last_name: subscriber.lastName
        }
      })
    });

    if (!mlResponse.ok) {
      const errorData = await mlResponse.json();
      console.error('MailerLite API Error:', errorData);
      throw new Error(`MailerLite API error: ${errorData.message || 'Unknown error'}`);
    }

    res.json({ success: true, message: 'Email confirmed successfully!' });
  } catch (error) {
    console.error('Confirmation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/subscribers', async (req, res) => {
  try {
    const subscribers = await Subscriber.find().sort({ createdAt: -1 });
    res.json(subscribers);
  } catch (error) {
    console.error('Error fetching subscribers:', error);
    res.status(500).json({ error: 'Failed to fetch subscribers' });
  }
});

// Test email endpoint
app.get('/api/test-email', async (req, res) => {
  try {
    // Replace this with your actual test email
    const testEmail = 'wenceslaupedro@gmail.com';
    const testToken = generateConfirmationToken();
    
    console.log('Attempting to send test email to:', testEmail);
    await sendConfirmationEmail(testEmail, 'Test User', testToken);
    
    console.log('Test email sent successfully');
    res.json({ 
      success: true, 
      message: 'Test email sent successfully! Please check your inbox.' 
    });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send test email',
      error: error.message 
    });
  }
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
