// index.js
const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');
const cors = require('cors');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;
const uri = process.env.MONGODB_URI;

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
    
    const { sendOtpEmail } = require('./utils/emailService');
    const authRoutes = require('./routes/authRoutes');
    const recipeApiRoutes = require('./routes/recipeApiRoutes');
    const recipeGenerationRoutes = require('./routes/recipeGenerationRoutes');
    const googleLoginRoutes = require('./routes/googleLogin');
    app.use('/api', authRoutes(usersCollection, unverifiedUsersCollection, sendOtpEmail));
    app.use('/api', recipeApiRoutes(recipesCollection));
    app.use('/api', recipeGenerationRoutes(recipesCollection));
    app.use('/api', googleLoginRoutes(usersCollection));

  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});

app.get('/', (req, res) => {
  res.send('Hello from PlateGenie Backend!');
});
