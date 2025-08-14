// server/routes/recipeGenerationRoutes.js
const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

module.exports = (recipesCollection) => {
  router.post('/generate-plan', async (req, res) => {
    try {
      const { ingredients } = req.body;
      if (!ingredients || ingredients.length === 0) {
        return res.status(400).json({ error: "No ingredients provided" });
      }

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const ingredientsString = ingredients.join(', ');
      const isBangla = /[\u0980-\u09FF]/.test(ingredientsString);

      const prompt = `Generate as many creative and practical recipes as possible using ONLY these ingredients: ${ingredientsString}.

IMPORTANT INSTRUCTIONS:
1. Respond in ${isBangla ? 'Bangla (Bengali)' : 'English'} language only
2. For each recipe include:
   - A creative and descriptive name
   - All required ingredients (only from provided list)
   - Detailed step-by-step cooking instructions
   - Cooking time and difficulty level
   - Serving suggestions if applicable
   - A relevant image URL (placeholder if specific image not available)

STRICT RULES:
- Generate maximum possible distinct recipes
- Use only the provided ingredients
- Maintain consistent language throughout
- Make instructions practical and precise
- Include estimated cooking time
- Return perfect JSON format without any additional text

${isBangla ? `
বাংলা ফরম্যাট উদাহরণ:
[
  {
    "name": "রেসিপির নাম",
    "ingredients": ["উপাদান ১", "উপাদান ২"],
    "instructions": "১. প্রথম ধাপ...\n২. দ্বিতীয় ধাপ...",
    "cookingTime": "X মিনিট",
    "difficulty": "সহজ/মধ্যম/কঠিন"
  }
]` : `
English Format Example:
[
  {
    "name": "Recipe Name",
    "ingredients": ["ingredient1", "ingredient2"],
    "instructions": "1. First step...\n2. Second step...",
    "cookingTime": "X mins",
    "difficulty": "Easy/Medium/Hard"
  }
]`}
`;

      const result = await model.generateContent(prompt);
      let responseText = result.response.text();

      responseText = responseText.replace(/```json|```/g, '').trim();

      const jsonStart = Math.max(responseText.indexOf('['), 0);
      const jsonEnd = Math.min(responseText.lastIndexOf(']') + 1, responseText.length);
      const jsonString = responseText.slice(jsonStart, jsonEnd);

      const recipes = JSON.parse(jsonString);
      
      const validRecipes = recipes.filter(recipe =>
        recipe.name &&
        Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0 &&
        recipe.instructions &&
        typeof recipe.cookingTime === 'string' &&
        typeof recipe.difficulty === 'string' 
      );

      res.status(200).json(validRecipes);

    } catch (error) {
      console.error("API call failed:", error);
      res.status(500).json({
        error: "Failed to generate recipes. Please try again with different ingredients.",
        details: error.message
      });
    }
  });

  router.post('/save', async (req, res) => {
    const { userId, name, ingredients, instructions, cookingTime, difficulty } = req.body;

    if (!userId || !name || !ingredients || !instructions) {
      return res.status(400).json({ message: 'Missing required recipe fields for saving.' });
    }

    try {
      const newRecipe = {
        userId: userId,
        title: name, // Using 'name' from AI response as title
        description: instructions, // Using instructions as description for AI generated
        ingredients: ingredients, // Ingredients as array
        instructions: instructions, // Instructions as string or array based on AI output
        cookingTime: cookingTime || 'N/A',
        difficulty: difficulty || 'N/A',
        likes: [],
        comments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        type: 'saved', // Explicitly mark as 'saved' (from AI generation)
      };

      const result = await recipesCollection.insertOne(newRecipe);
      res.status(201).json({
        message: 'Recipe saved successfully!',
        recipeId: result.insertedId,
        savedRecipe: newRecipe // Return the saved recipe data
      });
    } catch (error) {
      console.error('Error saving generated recipe:', error);
      res.status(500).json({ message: 'Server error while saving recipe.' });
    }
  });

  return router;
};
