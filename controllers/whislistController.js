const WishList = require('../models/WishList');
const { Product, ProductDetails } = require('../models/Product');

exports.addToWishList = async (req, res) => {
  try {
    const userId = req.params.userId;
    let { productID, productIDs } = req.body;

    if (!userId || (!productID && !productIDs)) {
      return res.status(400).json({
        message: 'UserId and at least one productID or productIDs array is required',
        success: false,
        data: []
      });
    }

    // Normalize to array
    if (productID) productIDs = [productID];

    let wishList = await WishList.findOne({ userId });

    const productDocs = await Product.find().lean();
    const productDetails = productDocs.flatMap(doc =>
      (doc.products || []).map(product => ({ ...product }))
    );

    if (!wishList) {
      const newCart = new WishList({
        userId,
        wishListProduct: productIDs.map(id => id.toString())
      });
      await newCart.save();

      const filtered = productDetails.filter(product =>
        productIDs.includes(product._id.toString())
      );

      return res.status(201).json({
        message: 'New wishlist created with products',
        success: true,
        action: 'added',
        data: filtered
      });
    }

    // Toggle logic
    const added = [];
    const removed = [];

    for (let element of productIDs) {
      const strId = element.toString();
      const index = wishList.wishListProduct.indexOf(strId);

      if (index === -1) {
        wishList.wishListProduct.push(strId);
        added.push(strId);
      } else {
        wishList.wishListProduct.splice(index, 1);
        removed.push(strId);
      }
    }

    await wishList.save();

    const fullList = productDetails.filter(product =>
      wishList.wishListProduct.includes(product._id.toString())
    );

    const addedProducts = productDetails.filter(p => added.includes(p._id.toString()));
    const removedProducts = productDetails.filter(p => removed.includes(p._id.toString()));

    // Dynamic message
    let message = 'Wishlist updated successfully';
    if (added.length && !removed.length) {
      message = 'Products added to wishlist';
    } else if (!added.length && removed.length) {
      message = 'Products removed from wishlist';
    } else if (added.length && removed.length) {
      message = 'Products added and removed from wishlist';
    }

    return res.status(200).json({
      message,
      success: true,
      added: addedProducts,
      removed: removedProducts,
      data: fullList
    });

  } catch (error) {
    console.error('Wishlist Error:', error);
    res.status(500).json({
      message: 'Wishlist operation failed',
      success: false,
      data: error.message
    });
  }
};



exports.getWishList = async (req, res) => {
  try {
    const userId = req.params.userId;
    const cart = await WishList.findOne({ userId });

    if (!cart) {
      return res.status(200).json({
        message: 'User not found',
        success: true,
        data: []
      });
    }
let filterdCart=[];
    const productDocs = await Product.find().lean();
    const productDetails = productDocs.flatMap(doc =>
      (doc.products || []).map(product => ({
        ...product,
        // shopId: doc.shopId
      }))
    );


    const tempCartList = cart.wishListProduct.map(id => id.toString());
for(let i =0;i<tempCartList.length;i++){
console.log("element in car", tempCartList[i])
  for(let j =0;j<productDetails.length;j++){
    console.log("element in product", productDetails[j]._id.toString())

  if(tempCartList[i].toString()==productDetails[j]._id.toString()){
    console.log(i);
    filterdCart.push(productDetails[j]);
  }
  
  }
}


    return res.status(200).json({
      message: 'Wishlist founded with products',
      success: true,
      data: filterdCart
    });

  } catch (e) {
    console.error('Error fetching cart:', e);
    return res.status(500).json({
      message: 'Internal server error',
      success: false
    });
  }
};
