// index.js
const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const cors = require('cors');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

const uri = process.env.MONGODB_URI;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Middleware
app.use(cors());
app.use(express.json());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let db, usersCollection, recipesCollection, unverifiedUsersCollection;

async function run() {
  try {
    await client.connect();
    console.log("MongoDB connected successfully!");

    db = client.db("plateGenieDB");
    usersCollection = db.collection("users");
    unverifiedUsersCollection = db.collection("unverified_users");
    recipesCollection = db.collection("recipes");

    // Nodemailer OAuth2 setup
    const oAuth2Client = new google.auth.OAuth2(
      process.env.CLIENT_ID,
      process.env.CLIENT_SECRET,
      'https://developers.google.com/oauthplayground'
    );

    oAuth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });

    // OTP email sending function with Nodemailer using OAuth2
    const sendOtpEmail = async (email, otp) => {
      try {
        const accessToken = await oAuth2Client.getAccessToken();

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
        throw new Error('Failed to send verification email.');
      }
    };


    // Google Login API route 
    const googleLoginRouter = require('./google-login')(usersCollection);
    app.use('/api', googleLoginRouter);

    // user register API
    app.post('/api/register', async (req, res) => {
      const { username, email, password } = req.body;

      if (!username || !email || !password) {
        return res.status(400).json({ message: 'All fields are required.' });
      }

      try {
        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) {
          return res.status(409).json({ message: 'User with this email already exists.' });
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
        const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // OTP expires in 5 minutes

        // Saving data to unverified_users collection instead of users directly.
        const newUnverifiedUser = {
          username,
          email,
          password: hashedPassword,
          otp,
          otpExpires
        };
        await unverifiedUsersCollection.insertOne(newUnverifiedUser);

        await sendOtpEmail(email, otp);

        res.status(201).json({ message: 'Registration successful! Please check your email for the OTP.' });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error.' });
      }
    });

    // OTP verification API
    app.post('/api/verify-otp', async (req, res) => {
      const { email, otp } = req.body;

      if (!email || !otp) {
        return res.status(400).json({ message: 'Email and OTP are required.' });
      }

      try {
        const user = await unverifiedUsersCollection.findOne({ email });

        if (!user) {
          return res.status(404).json({ message: 'User not found or already verified.' });
        }

        if (user.otp !== otp || user.otpExpires < new Date()) {
          return res.status(400).json({ message: 'Invalid or expired OTP.' });
        }

        // If OTP is correct, saving data to users collection.
        const verifiedUser = {
          username: user.username,
          email: user.email,
          password: user.password,
          isVerified: true
        };
        await usersCollection.insertOne(verifiedUser);

        // Deleting temporary data from unverified_users.
        await unverifiedUsersCollection.deleteOne({ email });

        res.status(200).json({
          message: 'OTP verified successfully. You are now logged in.',
          user: {
            id: verifiedUser._id,
            username: verifiedUser.username,
            email: verifiedUser.email
          }
        });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error.' });
      }
    });

    // user login API
    app.post('/api/login', async (req, res) => {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
      }

      try {
        const user = await usersCollection.findOne({ email });
        if (!user) {
          return res.status(401).json({ message: 'Invalid email or password.' });
        }

        if (!user.isVerified) {
          return res.status(403).json({ message: 'Please verify your email before logging in.' });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
          return res.status(401).json({ message: 'Invalid email or password.' });
        }

        res.status(200).json({ message: 'Login successful!', user: { id: user._id, username: user.username, email: user.email } });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error.' });
      }
    });


    // recipe generate API route
    app.post('/api/generate-plan', async (req, res) => {
      try {
        const { ingredients } = req.body;
        if (!ingredients || ingredients.length === 0) {
          return res.status(400).json({ error: "No ingredients provided" });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const ingredientsString = ingredients.join(', ');

        const prompt = `Based on these ingredients: [${ingredientsString}], suggest a few creative and easy-to-make recipes. The recipes must be strictly in the following JSON format. Do not include any other text, explanation, or notes outside of the JSON. If you cannot generate any recipe, return an empty JSON array.

[
  {
    "name": "...",
    "ingredients": ["...", "..."],
    "instructions": "..."
  },
  {
    "name": "...",
    "ingredients": ["...", "..."],
    "instructions": "..."
  }
]`;

        const result = await model.generateContent(prompt);
        let responseText = result.response.text();

        responseText = responseText.replace(/```json|```/g, '').trim();

        if (!responseText.startsWith('[') || !responseText.endsWith(']')) {
          throw new Error('API returned an invalid JSON format.');
        }

        const recipes = JSON.parse(responseText);

        res.status(200).json(recipes);

      } catch (error) {
        console.error("API call failed:", error);
        res.status(500).json({ error: "Failed to generate meal plan. Please check your API key or try again." });
      }
    });

  } finally {
    // await client.close(); 
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});

app.get('/', (req, res) => {
  res.send('Hello from PlateGenie Backend!');
});
