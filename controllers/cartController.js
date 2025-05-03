const Cart = require('../models/Cart');
exports.addToCart = async (req, res) => {
  try {
    const userId = req.params.userId;
    let { productID, productIDs } = req.body; 

    console.log("DEBUG LOG:", { userId, productID, productIDs }); 

    if (!userId || (!productID && !productIDs)) {
      return res.status(400).json({
        message: 'UserId and at least one productID or productIDs array is required',
        success: false,
        data: []
      });
    }

    if (productID) productIDs = [productID]; // Convert to array if single product

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      const newCart = new Cart({
        userId,
        cartProduct: productIDs
      });

      await newCart.save();

      return res.status(201).json({
        message: 'New cart created with products',
        success: true,
        data: newCart
      });
    }

    for (let id of productIDs) {
      const index = cart.cartProduct.indexOf(id);

      if (index === -1) {
        cart.cartProduct.push(id);
      } else {
        cart.cartProduct.splice(index, 1);
      }
    }

    await cart.save();

    return res.status(200).json({
      message: 'Cart updated successfully',
      success: true,
      data: cart
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


