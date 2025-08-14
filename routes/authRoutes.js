// server/routes/authRoutes.js
const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { ObjectId } = require('mongodb');

const router = express.Router();

module.exports = (usersCollection, unverifiedUsersCollection, sendOtpEmail) => {
  router.post('/register', async (req, res) => {
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
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpires = new Date(Date.now() + 5 * 60 * 1000); 
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
  router.post('/verify-otp', async (req, res) => {
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
      const verifiedUser = {
        username: user.username,
        email: user.email,
        password: user.password,
        isVerified: true,
        createdAt: new Date() 
      };
      const result = await usersCollection.insertOne(verifiedUser); 
      await unverifiedUsersCollection.deleteOne({ email });
      const createdUser = await usersCollection.findOne({ _id: result.insertedId });

      res.status(200).json({
        message: 'OTP verified successfully. You are now logged in.',
        user: {
          id: createdUser._id,
          username: createdUser.username,
          email: createdUser.email,
          profilePicture: createdUser.profilePicture || null 
        }
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error.' });
    }
  });
  router.post('/login', async (req, res) => {
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

      res.status(200).json({
        message: 'Login successful!',
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          profilePicture: user.profilePicture || null 
        }
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error.' });
    }
  });
  router.put('/users/profile', async (req, res) => {
    const { userId, username, profilePicture, bio } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required.' });
    }
    if (!username && !profilePicture && !bio) {
      return res.status(400).json({ message: 'No update data provided.' });
    }

    try {
      const updateDoc = {};
      if (username !== undefined) updateDoc.username = username; 
      if (profilePicture !== undefined) updateDoc.profilePicture = profilePicture;
      if (bio !== undefined) updateDoc.bio = bio; 
      updateDoc.updatedAt = new Date();

      const result = await usersCollection.updateOne(
        { _id: new ObjectId(userId) },
        { $set: updateDoc }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ message: 'User not found.' });
      }

      const updatedUser = await usersCollection.findOne({ _id: new ObjectId(userId) });

      res.status(200).json({
        message: 'Profile updated successfully!',
        user: {
          id: updatedUser._id,
          username: updatedUser.username,
          email: updatedUser.email,
          profilePicture: updatedUser.profilePicture || null,
          bio: updatedUser.bio || null 
        }
      });
    } catch (error) {
      console.error('Error updating user profile:', error);
      res.status(500).json({ message: 'Server error.' });
    }
  });

  return router;
};
