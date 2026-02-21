const Cart = require('../models/Cart');
const ShopProduct = require('../models/ShopProduct');
const logger = require('../config/logger'); // ← only addition at top

exports.addToCart = async (req, res) => {
  try {
    const { userId } = req.params;
    const { shopProductId, quantity = 1 } = req.body;

    if (!userId || !shopProductId) {
      return res.status(400).json({ success: false, message: 'userId and shopProductId required' });
    }

    const product = await ShopProduct.findById(shopProductId);
    if (!product || !product.isAvailable) {
      return res.status(404).json({ success: false, message: 'Product not available' });
    }

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    const index = cart.items.findIndex(i => i.shopProductId.toString() === shopProductId);

    if (index === -1) {
      cart.items.push({ shopProductId, quantity });
    } else {
      cart.items[index].quantity += quantity;
    }

    await cart.save();

    return res.json({ success: true, message: 'Added to cart', data: cart });
  } catch (err) {
    logger.error('addToCart failed', { userId: req.params.userId, error: err.message, stack: err.stack }); // ← replaced console.error
    res.status(500).json({ success: false, message: 'Add to cart failed' });
  }
};

exports.removeFromCart = async (req, res) => {
  try {
    const { userId } = req.params;
    const { shopProductId } = req.body;

    const cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

    cart.items = cart.items.filter(i => i.shopProductId.toString() !== shopProductId);

    await cart.save();

    res.json({ success: true, message: 'Removed from cart', data: cart });
  } catch (err) {
    logger.error('removeFromCart failed', { userId: req.params.userId, error: err.message, stack: err.stack }); // ← was missing before
    res.status(500).json({ success: false, message: 'Remove failed' });
  }
};

exports.updateQuantity = async (req, res) => {
  try {
    const { userId } = req.params;
    const { shopProductId, quantity } = req.body;

    if (quantity < 1) {
      return res.status(400).json({ success: false, message: 'Quantity must be >= 1' });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

    const item = cart.items.find(i => i.shopProductId.toString() === shopProductId);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

    item.quantity = quantity;
    await cart.save();

    res.json({ success: true, message: 'Quantity updated', data: cart });
  } catch (err) {
    logger.error('updateQuantity failed', { userId: req.params.userId, error: err.message, stack: err.stack }); // ← was missing before
    res.status(500).json({ success: false, message: 'Update failed' });
  }
};

exports.getCart = async (req, res) => {
  try {
    const { userId } = req.params;

    const cart = await Cart.findOne({ userId }).populate({
      path: 'items.shopProductId',
      populate: [
        {
          path: 'part',
          populate: ['category', 'subCategory']
        },
        {
          path: 'shopId',
          select: 'shopeDetails'
        }
      ]
    });

    if (!cart) {
      return res.json({ success: true, data: [] });
    }

    const formatted = cart.items.map(item => {
      const shopProduct = item.shopProductId;
      const shop = shopProduct?.shopId;
      const shopDetails = shop?.shopeDetails;

      const shopInfo = shop && shopDetails ? {
        _id: shop._id,
        shopName: shopDetails.shopName || null,
        shopAddress: shopDetails.shopAddress || null,
        shopContact: shopDetails.shopContact || null,
        shopMail: shopDetails.shopMail || null,
        shopLocation: shopDetails.shopLocation || null
      } : null;

      return {
        shopProductId: shopProduct._id,
        quantity: item.quantity,
        price: shopProduct.price,
        discountedPrice: shopProduct.discountedPrice,
        stock: shopProduct.stock,
        part: shopProduct.part,
        shop: shopInfo
      };
    });

    res.json({ success: true, data: formatted });
  } catch (err) {
    logger.error('getCart failed', { userId: req.params.userId, error: err.message, stack: err.stack }); // ← replaced console.error
    res.status(500).json({ success: false, message: 'Fetch cart failed' });
  }
};

exports.clearCart = async (req, res) => {
  try {
    const { userId } = req.params;
    await Cart.findOneAndUpdate({ userId }, { items: [] });
    res.json({ success: true, message: 'Cart cleared' });
  } catch (err) {
    logger.error('clearCart failed', { userId: req.params.userId, error: err.message, stack: err.stack }); // ← was missing before
    res.status(500).json({ success: false, message: 'Clear failed' });
  }
};