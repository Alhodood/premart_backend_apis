// routes/productUpload.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Product = require('../product_full_featured_model'); // adjust path

// Body validation helper (simple) - replace with Joi/Zod for production
function validateProductPayload(body) {
  if (!body.name || !body.sku || !body.price || typeof body.price.listPrice !== 'number') {
    return 'Missing required fields: name, sku, price.listPrice';
  }
  return null;
}

router.post('/product', async (req, res) => {
  try {
    const errMsg = validateProductPayload(req.body);
    if (errMsg) return res.status(400).json({ success: false, error: errMsg });

    // Create using model - any extra schema validation runs here
    const product = new Product(req.body);
    await product.validate(); // explicit validation to return friendly errors
    const saved = await product.save();

    return res.status(201).json({ success: true, product: saved });
  } catch (err) {
    // Mongoose validation error handling
    if (err.name === 'ValidationError') {
      const details = Object.keys(err.errors).reduce((acc, key) => {
        acc[key] = err.errors[key].message;
        return acc;
      }, {});
      return res.status(422).json({ success: false, validation: details });
    }

    console.error('Create product error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;