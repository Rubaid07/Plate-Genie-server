// server/utils/emailService.js
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
require('dotenv').config();

// OAuth2 client setup
const oAuth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  'https://developers.google.com/oauthplayground' // This is a placeholder, it doesn't need to be a real URL for Nodemailer
);

// Set credentials with refresh token
// Ensure REFRESH_TOKEN is available in environment variables
if (process.env.REFRESH_TOKEN) {
  oAuth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });
} else {
  console.warn("REFRESH_TOKEN is not set in environment variables. OTP emails might not work.");
}


// Function to send OTP email
const sendOtpEmail = async (email, otp) => {
  try {
    const accessTokenResponse = await oAuth2Client.getAccessToken();
    const accessToken = accessTokenResponse.token; // Correctly get the token from the response

    if (!accessToken) {
      throw new Error("Failed to obtain access token for Nodemailer.");
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.EMAIL_USER,
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        refreshToken: process.env.REFRESH_TOKEN,
        accessToken: accessToken,
      }
    });

    const mailOptions = {
      from: `PlateGenie <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'OTP Verification for PlateGenie',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center;">
            <h2 style="color: #333;">PlateGenie OTP Verification</h2>
          </div>
          <div style="padding: 20px; text-align: center;">
            <p style="font-size: 16px; color: #555;">Use the OTP below to verify your email:</p>
            <h1 style="font-size: 36px; font-weight: bold; color: #007bff; margin: 20px 0;">${otp}</h1>
            <p style="font-size: 14px; color: #888;">This code is valid for 5 minutes.</p>
          </div>
          <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 12px; color: #888;">
            <p>If you did not make this request, please ignore this email.</p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`OTP email sent to ${email}`);

  } catch (error) {
    console.error(`Failed to send OTP email to ${email}:`, error);
    // Rethrow the error so the calling function can handle it
    throw new Error('Failed to send verification email.');
  }
};

module.exports = { sendOtpEmail };
