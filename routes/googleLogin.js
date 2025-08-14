// server/routes/googleLogin.js
const express = require('express');
const { OAuth2Client } = require('google-auth-library');

const router = express.Router();
const client = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: 'postmessage'
});

module.exports = (usersCollection) => {
  router.post('/google-login', async (req, res) => {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ message: 'Authorization code is missing.' });
    }

    try {
      const { tokens } = await client.getToken({
        code,
        redirectUri: 'postmessage'
      });
      const idToken = tokens.id_token;
      const ticket = await client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      const { sub: googleId, email, name, picture: profilePicture } = payload;
      let user = await usersCollection.findOne({ email });

      if (!user) {
        user = {
          googleId,
          username: name,
          email,
          profilePicture,
          isVerified: true,
          createdAt: new Date(),
        };
        await usersCollection.insertOne(user);
      } else {
        if (!user.googleId) {
            await usersCollection.updateOne(
                { _id: user._id },
                { $set: { googleId: googleId, profilePicture: profilePicture } }
            );
            user.googleId = googleId;
            user.profilePicture = profilePicture;
        }
      }

      res.status(200).json({ 
        message: 'Login successful!', 
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          profilePicture: user.profilePicture || null // Ensure profilePicture is returned
        }
      });
    } catch (error) {
      console.error('Google login error:', error.message);
      res.status(401).json({ message: 'Authentication failed: ' + error.message });
    }
  });

  return router;
};
