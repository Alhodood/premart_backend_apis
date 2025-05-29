const Cart = require('../models/Cart');
const Product = require('../models/Product');

exports.addToCart = async (req, res) => {
  try {
    console.log("Request body received:", req.body);
    const userId = req.params.userId;
    const { productIDs } = req.body;

    if (!userId || !Array.isArray(productIDs) || productIDs.length === 0) {
      return res.status(400).json({
        message: 'UserId and productIDs array are required',
        success: false,
        data: []
      });
    }

    let cart = await Cart.findOne({ userId });

    const productDocs = await Product.find({ _id: { $in: productIDs } }).lean();

    if (!cart) {
      const newCart = new Cart({
        userId,
        cartProduct: productDocs.map(p => p._id.toString())
      });
      await newCart.save();

      return res.status(201).json({
        message: 'Products added to new cart',
        success: true,
        added: productDocs,
        removed: [],
        cart: productDocs
      });
    }

    const addedProducts = [];
    const removedProducts = [];

    for (let product of productDocs) {
      const strId = product._id.toString();
      const index = cart.cartProduct.indexOf(strId);

      if (index === -1) {
        cart.cartProduct.push(strId);
        addedProducts.push(product);
      } else {
        cart.cartProduct.splice(index, 1);
        removedProducts.push(product);
      }
    }

    await cart.save();

    const updatedCart = await Product.find({ _id: { $in: cart.cartProduct } }).lean();

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
      cart: updatedCart
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

    const filteredCart = allParts.filter(p => cart.cartProduct.includes(p._id.toString()));

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
