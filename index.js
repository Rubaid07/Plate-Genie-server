const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const cors = require('cors');
const bcrypt = require('bcrypt');
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

let db, usersCollection, recipesCollection;

async function run() {
  try {
    await client.connect();
    console.log("MongoDB connected successfully!");

    db = client.db("plateGenieDB");
    usersCollection = db.collection("users");
    recipesCollection = db.collection("recipes");

    // user register API
    app.post('/api/register', async (req, res) => {
      const { username, email, password } = req.body;

      if (!username || !email || !password) {
        return res.status(400).json({ message: 'All fields are required.' });
      }

      try {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const user = { username, email, password: hashedPassword };
        await usersCollection.insertOne(user);

        res.status(201).json({ message: 'User registered successfully!' });
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

  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});

app.get('/', (req, res) => {
  res.send('Hello from PlateGenie Backend!');
});