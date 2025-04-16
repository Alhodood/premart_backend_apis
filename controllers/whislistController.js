const WishList = require('../models/WishList');

exports.addToWishList = async (req, res) => {
  try {
    const userId = req.params.id;
    const { productID } = req.body;

    if (!userId || !productID) {
      return res.status(400).json({
        message: 'UserId and productID are required',
        success: false,
        data: []
      });
    }

    let wishlist = await WishList.findOne({ userId });

    if (wishlist) {
      const index = wishlist.wishListProduct.indexOf(productID);

      if (index === -1) {
        wishlist.wishListProduct.push(productID);
        await wishlist.save();
        return res.status(200).json({
          message: 'Product added to wishlist',
          success: true,
          data: wishlist
        });
      } else {
        wishlist.wishListProduct.splice(index, 1);
        await wishlist.save();
        return res.status(200).json({
          message: 'Product removed from wishlist',
          success: true,
          data: wishlist
        });
      }
    } else {
      const newWishList = new WishList({
        userId,
        wishListProduct: [productID]
      });
      await newWishList.save();

      return res.status(201).json({
        message: 'New wishlist created and product added',
        success: true,
        data: newWishList
      });
    }

  } catch (error) {
    console.error("Wishlist error:", error);
    return res.status(500).json({
      message: 'Wishlist operation failed',
      success: false,
      data: error.message
    });
  }
};
