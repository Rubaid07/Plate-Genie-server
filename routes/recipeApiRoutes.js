// server/routes/recipeApiRoutes.js
const express = require('express');
const { ObjectId } = require('mongodb');
require('dotenv').config(); // Ensure dotenv is loaded if needed for database connection string here, though typically done in index.js

const router = express.Router();

module.exports = (recipesCollection) => {
  // API to create a new recipe (Manual creation by user - simplified form)
  router.post('/', async (req, res) => {
    const { userId, title, description, imageUrl } = req.body;

    // Basic validation for simplified recipe creation
    if (!userId || !title || !description) {
      return res.status(400).json({ message: 'Missing required recipe fields: userId, title, description.' });
    }

    try {
      const newRecipe = {
        userId: userId,
        title,
        description,
        imageUrl: imageUrl || '', // Allow imageUrl to be empty if not provided
        likes: [], // Initialize with empty likes array
        comments: [], // Initialize with empty comments array
        createdAt: new Date(),
        updatedAt: new Date(),
        type: 'created', // Mark this recipe as manually created
      };

      const result = await recipesCollection.insertOne(newRecipe);
      res.status(201).json({ message: 'Recipe created successfully!', recipeId: result.insertedId, recipe: newRecipe });
    } catch (error) {
      console.error('Error creating recipe:', error);
      res.status(500).json({ message: 'Server error while creating recipe.' });
    }
  });

  // API to fetch recipes by user ID with optional type filter
  router.get('/user/:userId', async (req, res) => {
    const { userId } = req.params;
    const { type } = req.query; // Query parameter to filter by type (e.g., 'created', 'saved')

    const query = { userId: userId };
    if (type) {
      query.type = type; // Apply type filter if provided
    }

    try {
      const userRecipes = await recipesCollection.find(query).toArray();
      res.status(200).json(userRecipes);
    } catch (error) {
      console.error('Error fetching user recipes:', error);
      res.status(500).json({ message: 'Server error while fetching recipes.' });
    }
  });

  // API to fetch a single recipe by its ID
  router.get('/:recipeId', async (req, res) => {
    const { recipeId } = req.params;
    try {
      // Ensure recipeId is a valid ObjectId
      if (!ObjectId.isValid(recipeId)) {
        return res.status(400).json({ message: 'Invalid Recipe ID format.' });
      }
      const recipe = await recipesCollection.findOne({ _id: new ObjectId(recipeId) });
      if (!recipe) {
        return res.status(404).json({ message: 'Recipe not found.' });
      }
      res.status(200).json(recipe);
    } catch (error) {
      console.error('Error fetching single recipe:', error);
      res.status(500).json({ message: 'Server error while fetching recipe.' });
    }
  });

  // API to update a recipe by its ID
  router.put('/:recipeId', async (req, res) => {
    const { recipeId } = req.params;
    // For simplicity, assuming userId is sent in body for authorization check
    // In a real app, userId should come from an authenticated session/token
    const { userId, title, description, imageUrl } = req.body;

    if (!userId || !title || !description) { // imageUrl is optional now
      return res.status(400).json({ error: 'Missing required fields for recipe update (title, description).' });
    }
    
    try {
      // Ensure recipeId is a valid ObjectId
      if (!ObjectId.isValid(recipeId)) {
        return res.status(400).json({ message: 'Invalid Recipe ID format.' });
      }
      const recipeObjectId = new ObjectId(recipeId);

      const existingRecipe = await recipesCollection.findOne({ _id: recipeObjectId });
      if (!existingRecipe) {
        return res.status(404).json({ message: 'Recipe not found.' });
      }
      // Basic authorization check: ensure the user updating is the owner
      if (existingRecipe.userId.toString() !== userId.toString()) {
        return res.status(403).json({ message: 'You are not authorized to update this recipe.' });
      }

      const updateDoc = {
        $set: {
          title,
          description,
          imageUrl: imageUrl || existingRecipe.imageUrl, // Update imageUrl, keep existing if new one is empty
          updatedAt: new Date(),
        }
      };

      const result = await recipesCollection.updateOne(
        { _id: recipeObjectId },
        updateDoc
      );

      if (result.matchedCount === 0) {
        // This case should ideally not be hit if existingRecipe was found,
        // unless there are no changes or another issue.
        return res.status(404).json({ message: 'Recipe not found or no changes made.' });
      }

      // Fetch the updated recipe to return in the response
      const updatedRecipe = await recipesCollection.findOne({ _id: recipeObjectId });
      res.status(200).json({ message: 'Recipe updated successfully!', recipe: updatedRecipe });
    } catch (error) {
      console.error('Error updating recipe:', error);
      res.status(500).json({ message: 'Server error while updating recipe.' });
    }
  });

  // API to delete a recipe by its ID
  router.delete('/:recipeId', async (req, res) => {
    const { recipeId } = req.params;

    try {
      // Ensure recipeId is a valid ObjectId
      if (!ObjectId.isValid(recipeId)) {
        return res.status(400).json({ message: 'Invalid Recipe ID format.' });
      }
      const result = await recipesCollection.deleteOne({ _id: new ObjectId(recipeId) });

      if (result.deletedCount === 0) {
        return res.status(404).json({ message: 'Recipe not found.' });
      }

      res.status(200).json({ message: 'Recipe deleted successfully.' });
    } catch (error) {
      console.error('Error deleting recipe:', error);
      res.status(500).json({ message: 'Server error while deleting recipe.' });
    }
  });

  return router;
};
