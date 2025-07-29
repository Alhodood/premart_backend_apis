const Cart = require('../models/Cart');
const Product = require('../models/Product');

/**
 * POST /api/cart/:userId/add
 * Increment the cart quantity for a single product (default +1).
 */
exports.addToCart = async (req, res) => {
  try {
    const userId = req.params.userId;
    const { productId } = req.body;
    if (!userId || !productId) {
      return res.status(400).json({ message: 'userId and productId required', success: false });
    }

    // Find or create cart
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, cartProduct: [] });
    }

    // Find existing item
    const idx = cart.cartProduct.findIndex(ci => ci.productId.toString() === productId);
    if (idx === -1) {
      // Add new with quantity 1
      cart.cartProduct.push({ productId, quantity: 1 });
    } else {
      // Increment existing quantity
      cart.cartProduct[idx].quantity += 1;
    }

    await cart.save();

    return res.status(200).json({
      message: 'Product added to cart',
      success: true,
      data: cart
    });
  } catch (err) {
    console.error('Add to cart error:', err);
    return res.status(500).json({ message: 'Failed to add to cart', success: false, error: err.message });
  }
};

/**
 * POST /api/cart/:userId/remove
 * Decrement the cart quantity for a single product (default -1), removing if quantity reaches 0.
 */
exports.removeFromCart = async (req, res) => {
  try {
    const userId = req.params.userId;
    const { productId } = req.body;
    if (!userId || !productId) {
      return res.status(400).json({ message: 'userId and productId required', success: false });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found', success: false });
    }

    const idx = cart.cartProduct.findIndex(ci => ci.productId.toString() === productId);
    if (idx === -1) {
      return res.status(404).json({ message: 'Product not in cart', success: false });
    }

    // Decrement or remove
    cart.cartProduct[idx].quantity -= 1;
    if (cart.cartProduct[idx].quantity <= 0) {
      cart.cartProduct.splice(idx, 1);
    }

    await cart.save();

    return res.status(200).json({
      message: 'Product removed from cart',
      success: true,
      data: cart
    });
  } catch (err) {
    console.error('Remove from cart error:', err);
    return res.status(500).json({ message: 'Failed to remove from cart', success: false, error: err.message });
  }
};


exports.getCart = async (req, res) => {
  try {
    const userId = req.params.userId;
    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.status(200).json({
        message: 'User not found',
        success: true,
        data: []
      });
    }

    const cartProductIds = cart.cartProduct.map(cp => cp.productId);
    const products = await Product.find({ _id: { $in: cartProductIds } }).lean();

    // Attach quantities to each product
    const data = products.map(prod => {
      const item = cart.cartProduct.find(cp =>
        cp.productId.toString() === prod._id.toString()
      );
      return {
        ...prod,
        quantity: item?.quantity || 0
      };
    });

    return res.status(200).json({
      message: 'Cart founded with products',
      success: true,
      data
    });

  } catch (e) {
    console.error('Error fetching cart:', e);
    return res.status(500).json({
      message: 'Internal server error',
      success: false
    });
  }
};

/**
 * DELETE /api/cart/:userId/product/:productId
 * Remove a product entirely from the user's cart regardless of its quantity.
 */
exports.deleteProductFromCart = async (req, res) => {
  try {
    const { userId, productId } = req.params;
    if (!userId || !productId) {
      return res.status(400).json({ message: 'userId and productId required', success: false });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found', success: false });
    }

    // Find the product index
    const idx = cart.cartProduct.findIndex(ci => ci.productId.toString() === productId);
    if (idx === -1) {
      return res.status(404).json({ message: 'Product not in cart', success: false });
    }

    // Remove the product entirely
    cart.cartProduct.splice(idx, 1);
    await cart.save();

    return res.status(200).json({
      message: 'Product removed from cart',
      success: true,
      data: cart
    });
  } catch (err) {
    console.error('Delete product from cart error:', err);
    return res.status(500).json({ message: 'Failed to delete product from cart', success: false, error: err.message });
  }
};
