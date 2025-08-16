// server/routes/recipeApiRoutes.js

const express = require('express');
const { ObjectId } = require('mongodb');
require('dotenv').config();

const router = express.Router();

module.exports = (recipesCollection) => {

  // Create a new recipe
  router.post('/', async (req, res) => {
    const { userId, title, description, imageUrl } = req.body;
    if (!userId || !title || !description) {
      return res.status(400).json({ message: 'Missing required recipe fields: userId, title, description.' });
    }

    try {
      const newRecipe = {
        userId,
        title,
        description,
        imageUrl: imageUrl || '',
        likes: [],
        comments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        type: 'created',
      };

      const result = await recipesCollection.insertOne(newRecipe);
      res.status(201).json({
        message: 'Recipe created successfully!',
        recipeId: result.insertedId,
        recipe: newRecipe
      });
    } catch (error) {
      console.error('Error creating recipe:', error);
      res.status(500).json({ message: 'Server error while creating recipe.' });
    }
  });


  // Get all recipes by a specific user
  router.get('/user/:userId', async (req, res) => {
    const { userId } = req.params;
    const { type } = req.query;

    const query = { userId };
    if (type) {
      query.type = type;
    }

    try {
      const userRecipes = await recipesCollection.find(query).toArray();
      res.status(200).json(userRecipes);
    } catch (error) {
      console.error('Error fetching user recipes:', error);
      res.status(500).json({ message: 'Server error while fetching recipes.' });
    }
  });


  // Get a single recipe by ID
  router.get('/:recipeId', async (req, res) => {
    const { recipeId } = req.params;
    try {
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


  // Update recipe
   
  router.put('/:recipeId', async (req, res) => {
    const { recipeId } = req.params;
    const { userId, title, description, imageUrl } = req.body;

    if (!userId || !title || !description) {
      return res.status(400).json({ error: 'Missing required fields for recipe update (title, description).' });
    }

    try {
      if (!ObjectId.isValid(recipeId)) {
        return res.status(400).json({ message: 'Invalid Recipe ID format.' });
      }
      const recipeObjectId = new ObjectId(recipeId);

      // Check if recipe exists and user is the owner
      const existingRecipe = await recipesCollection.findOne({ _id: recipeObjectId });
      if (!existingRecipe) {
        return res.status(404).json({ message: 'Recipe not found.' });
      }
      if (existingRecipe.userId.toString() !== userId.toString()) {
        return res.status(403).json({ message: 'You are not authorized to update this recipe.' });
      }

      // Update recipe
      const updateDoc = {
        $set: {
          title,
          description,
          imageUrl: imageUrl || existingRecipe.imageUrl,
          updatedAt: new Date(),
        }
      };

      await recipesCollection.updateOne({ _id: recipeObjectId }, updateDoc);

      const updatedRecipe = await recipesCollection.findOne({ _id: recipeObjectId });
      res.status(200).json({ message: 'Recipe updated successfully!', recipe: updatedRecipe });
    } catch (error) {
      console.error('Error updating recipe:', error);
      res.status(500).json({ message: 'Server error while updating recipe.' });
    }
  });


  // Delete  recipe
   
  router.delete('/:recipeId', async (req, res) => {
    const { recipeId } = req.params;

    try {
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


  // Toggle like
   
  router.post('/:recipeId/like', async (req, res) => {
    const { recipeId } = req.params;
    const { userId } = req.body; 

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required to like a recipe.' });
    }

    try {
      if (!ObjectId.isValid(recipeId)) {
        return res.status(400).json({ message: 'Invalid Recipe ID format.' });
      }
      const recipeObjectId = new ObjectId(recipeId);

      const recipe = await recipesCollection.findOne({ _id: recipeObjectId });
      if (!recipe) {
        return res.status(404).json({ message: 'Recipe not found.' });
      }

      // If already liked => remove like, else add like
      if (recipe.likes?.includes(userId)) {
        await recipesCollection.updateOne(
          { _id: recipeObjectId },
          { $pull: { likes: userId } }
        );
      } else {
        await recipesCollection.updateOne(
          { _id: recipeObjectId },
          { $addToSet: { likes: userId } }
        );
      }

      const updatedRecipe = await recipesCollection.findOne({ _id: recipeObjectId });
      res.status(200).json(updatedRecipe);
    } catch (error) {
      console.error('Error toggling like status:', error);
      res.status(500).json({ message: 'Server error while toggling like status.' });
    }
  });
  // Add  comment
  router.post('/:recipeId/comments', async (req, res) => {
    const { recipeId } = req.params;
    const { userId, commentText, username, userProfilePicture } = req.body;

    if (!userId || !commentText) {
      return res.status(400).json({ message: 'User ID and comment text are required.' });
    }

    try {
      if (!ObjectId.isValid(recipeId)) {
        return res.status(400).json({ message: 'Invalid Recipe ID format.' });
      }
      const recipeObjectId = new ObjectId(recipeId);

      const newComment = {
        _id: new ObjectId(),
        userId,
        username: username || 'Anonymous User',
        userProfilePicture: userProfilePicture || 'https://static.vecteezy.com/system/resources/thumbnails/009/292/244/small_2x/default-avatar-icon-of-social-media-user-vector.jpg',
        commentText,
        createdAt: new Date(),
      };

      await recipesCollection.updateOne(
        { _id: recipeObjectId },
        { $push: { comments: newComment } }
      );

      const updatedRecipe = await recipesCollection.findOne({ _id: recipeObjectId });
      res.status(201).json(updatedRecipe);
    } catch (error) {
      console.error('Error adding comment:', error);
      res.status(500).json({ message: 'Server error while adding comment.' });
    }
  });


  // Edit comment
   
  router.put('/:recipeId/comments/:commentId', async (req, res) => {
    const { recipeId, commentId } = req.params;
    const { userId, commentText } = req.body;

    if (!userId || !commentText) {
      return res.status(400).json({ message: 'User ID and new comment text are required.' });
    }

    try {
      if (!ObjectId.isValid(recipeId) || !ObjectId.isValid(commentId)) {
        return res.status(400).json({ message: 'Invalid ID format.' });
      }

      const recipeObjectId = new ObjectId(recipeId);
      const commentObjectId = new ObjectId(commentId);

      const recipe = await recipesCollection.findOne({
        _id: recipeObjectId,
        'comments._id': commentObjectId,
        'comments.userId': userId
      });

      if (!recipe) {
        return res.status(403).json({ message: 'Not authorized to edit this comment.' });
      }

      await recipesCollection.updateOne(
        { _id: recipeObjectId, 'comments._id': commentObjectId },
        { $set: { 'comments.$.commentText': commentText } }
      );

      const updatedRecipe = await recipesCollection.findOne({ _id: recipeObjectId });
      res.status(200).json(updatedRecipe);
    } catch (error) {
      console.error('Error editing comment:', error);
      res.status(500).json({ message: 'Server error while editing comment.' });
    }
  });


  // Delete comment
   
  router.delete('/:recipeId/comments/:commentId', async (req, res) => {
    const { recipeId, commentId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required.' });
    }

    try {
      if (!ObjectId.isValid(recipeId) || !ObjectId.isValid(commentId)) {
        return res.status(400).json({ message: 'Invalid ID format.' });
      }

      const recipeObjectId = new ObjectId(recipeId);
      const commentObjectId = new ObjectId(commentId);

      // delete own comment
      const recipe = await recipesCollection.findOne({
        _id: recipeObjectId,
        'comments._id': commentObjectId,
        'comments.userId': userId
      });

      if (!recipe) {
        return res.status(403).json({ message: 'Not authorized to delete this comment.' });
      }

      await recipesCollection.updateOne(
        { _id: recipeObjectId },
        { $pull: { comments: { _id: commentObjectId } } }
      );

      const updatedRecipe = await recipesCollection.findOne({ _id: recipeObjectId });
      res.status(200).json(updatedRecipe);
    } catch (error) {
      console.error('Error deleting comment:', error);
      res.status(500).json({ message: 'Server error while deleting comment.' });
    }
  });

  return router;
};
