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
let db, usersCollection, recipesCollection;
async function run() {
  try {
    await client.connect();
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
    db = client.db("plateGenieDB");
    usersCollection = db.collection("users");
    recipesCollection = db.collection("recipes");

    // ---------------USER MANAGEMENT ROUTE---------------
    app.post('/api/register', async (req, res) => {
      const { username, email, password } = req.body;
      if (!username || !email || !password) {
        return res.status(400).json({ message: 'All fields are required.' });
      }
      try {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const user = { username, email, password: hashedPassword };
        const result = await usersCollection.insertOne(user);
        res.status(201).json({ message: 'User registered successfully!' });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error.' });
      }
    });
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
