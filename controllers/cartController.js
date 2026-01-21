const Cart = require('../models/Cart');
const ShopProduct = require('../models/ShopProduct');

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
    console.error(err);
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
          populate: ['category', 'subCategory'] // PartsCatalog doesn't have brand/model directly
        },
        {
          path: 'shopId',
          select: 'shopeDetails' // Populate shop details
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

      // Format shop information
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
    console.error(err);
    res.status(500).json({ success: false, message: 'Fetch cart failed' });
  }
};

exports.clearCart = async (req, res) => {
  try {
    const { userId } = req.params;
    await Cart.findOneAndUpdate({ userId }, { items: [] });
    res.json({ success: true, message: 'Cart cleared' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Clear failed' });
  }
};