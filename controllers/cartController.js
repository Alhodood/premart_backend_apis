const Cart = require('../models/Cart');
const Product = require('../models/Product');

exports.addToCart = async (req, res) => {
  try {
    console.log("Request body received:", req.body);
    const userId = req.params.userId;
    const { productItems } = req.body;

    if (!userId || !Array.isArray(productItems) || productItems.length === 0) {
      return res.status(400).json({
        message: 'UserId and productItems array are required',
        success: false,
        data: []
      });
    }

    const productIds = productItems.map(p => p.productId);
    const quantityMap = {};
    productItems.forEach(p => {
      quantityMap[p.productId] = p.quantity || 1;
    });

    let cart = await Cart.findOne({ userId });

    const productDocs = await Product.find({ _id: { $in: productIds } }).lean();

    if (!cart) {
      const newCart = new Cart({
        userId,
        cartProduct: productDocs.map(p => ({ productId: p._id.toString(), quantity: quantityMap[p._id.toString()] || 1 }))
      });
      await newCart.save();

      return res.status(201).json({
        message: 'Products added to new cart',
        success: true,
        added: productDocs,
        removed: [],
        cart: productDocs.map(p => ({ ...p, quantity: quantityMap[p._id.toString()] || 1 }))
      });
    }

    const addedProducts = [];
    const removedProducts = [];

    for (let product of productDocs) {
      const strId = product._id.toString();
      const existingIndex = cart.cartProduct.findIndex(p => p.productId === strId);
      if (existingIndex === -1) {
        cart.cartProduct.push({ productId: strId, quantity: quantityMap[strId] || 1 });
        addedProducts.push(product);
      } else {
        cart.cartProduct[existingIndex].quantity = quantityMap[strId] || 1;
        addedProducts.push(product);
      }
    }

    await cart.save();

    const updatedCart = await Product.find({ _id: { $in: cart.cartProduct.map(p => p.productId) } }).lean();

    const cartWithQuantities = updatedCart.map(product => {
      const cartItem = cart.cartProduct.find(p => p.productId === product._id.toString());
      return { ...product, quantity: cartItem?.quantity || 1 };
    });

    let message = 'Cart updated successfully';
    if (addedProducts.length && !removedProducts.length) {
      message = 'Products added to cart';
    } else if (!addedProducts.length && removedProducts.length) {
      message = 'Products removed from cart';
    } else if (addedProducts.length && removedProducts.length) {
      message = 'Products added and removed from cart';
    }

    return res.status(200).json({
      message,
      success: true,
      added: addedProducts,
      removed: removedProducts,
      cart: cartWithQuantities
    });

  } catch (error) {
    console.error('Cart Error:', error);
    res.status(500).json({
      message: 'Cart operation failed',
      success: false,
      data: error.message
    });
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

    const productDocs = await Product.find().lean();
    const allParts = productDocs.flatMap(doc =>
      (doc.subCategories || []).flatMap(sub =>
        (sub.parts || []).map(part => ({
          ...part,
          shopId: doc.shopId
        }))
      )
    );

    const filteredCart = allParts.filter(p => cart.cartProduct.some(cp => cp.productId === p._id.toString()));

    return res.status(200).json({
      message: 'Cart founded with products',
      success: true,
      data: filteredCart
    });

  } catch (e) {
    console.error('Error fetching cart:', e);
    return res.status(500).json({
      message: 'Internal server error',
      success: false
    });
  }
};
