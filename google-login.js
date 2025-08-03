// server/google-login.js
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

      let user = await usersCollection.findOne({ googleId });

      if (!user) {
        user = {
          googleId,
          username: name,
          email,
          profilePicture,
          createdAt: new Date(),
        };
        await usersCollection.insertOne(user);
      }

      res.status(200).json({ message: 'Login successful', user });
    } catch (error) {
      console.error('Google login error:', error);
      res.status(401).json({ message: 'Authentication failed' });
    }
  });

  return router;
};
