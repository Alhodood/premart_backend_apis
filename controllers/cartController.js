const Cart = require("../models/Cart");

exports.addToCart = async (req, res) => {
  try {
    const userId = req.params.id;
    const { productID } = req.body;

    // Basic validation
    if (!userId || !productID) {
      return res.status(400).json({ 
        message: 'UserId and productID are required', 
        success: false, 
        data: [] 
      });
    }

    // Check if user already has a cart
    let cart = await Cart.findOne({ userId });

    if (cart) {
      const index = cart.cartProduct.indexOf(productID);

      if (index === -1) {
        // If product not in cart, add it
        cart.cartProduct.push(productID);
        await cart.save();
        return res.status(200).json({ 
          message: 'Product added to cart', 
          success: true, 
          data: cart 
        });
      } else {
        // If product already in cart, remove it
        cart.cartProduct.splice(index, 1);
        await cart.save();
        return res.status(200).json({ 
          message: 'Product removed from cart', 
          success: true, 
          data: cart 
        });
      }

    } else {
      // If no cart exists, create new
      const newCart = new Cart({
        userId,
        cartProduct: [productID]
      });

      await newCart.save();

      return res.status(201).json({ 
        message: 'New cart created and product added', 
        success: true, 
        data: newCart 
      });
    }

  } catch (error) {
    console.error('Cart Error:', error);
    res.status(500).json({ 
      message: 'Cart operation failed', 
      success: false, 
      data: error.message 
    });
  }
};
