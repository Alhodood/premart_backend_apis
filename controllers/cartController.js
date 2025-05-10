const Cart = require('../models/Cart');
const { Product, ProductDetails } = require('../models/Product');

exports.addToCart = async (req, res) => {
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

    let cart = await Cart.findOne({ userId });

    const productDocs = await Product.find().lean();
    const productDetails = productDocs.flatMap(doc =>
      (doc.products || []).map(product => ({ ...product }))
    );

    // If no cart exists, create new and return "added" message
    if (!cart) {
      const newCart = new Cart({
        userId,
        cartProduct: productIDs.map(id => id.toString())
      });
      await newCart.save();

      const filteredCart = productDetails.filter(product =>
        productIDs.includes(product._id.toString())
      );

      return res.status(201).json({
        message: 'Products added to new cart',
        success: true,
        action: 'added',
        data: filteredCart
      });
    }

    // Track added & removed
    const added = [];
    const removed = [];

    for (let element of productIDs) {
      const strId = element.toString();
      const index = cart.cartProduct.indexOf(strId);

      if (index === -1) {
        cart.cartProduct.push(strId);
        added.push(strId);
      } else {
        cart.cartProduct.splice(index, 1);
        removed.push(strId);
      }
    }

    await cart.save();

    const filteredCart = productDetails.filter(product =>
      cart.cartProduct.includes(product._id.toString())
    );
    const addedProducts = productDetails.filter(p => added.includes(p._id.toString()));
    const removedProducts = productDetails.filter(p => removed.includes(p._id.toString()));

    // Custom message logic
    let message = 'Cart updated successfully';
    if (added.length && !removed.length) {
      message = 'Products added to cart';
    } else if (!added.length && removed.length) {
      message = 'Products removed from cart';
    } else if (added.length && removed.length) {
      message = 'Products added and removed from cart';
    }

    return res.status(200).json({
      message,
      success: true,
      added: addedProducts,
      removed: removedProducts,
      cart: filteredCart
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
let filterdCart=[];
    const productDocs = await Product.find().lean();
    const productDetails = productDocs.flatMap(doc =>
      (doc.products || []).map(product => ({
        ...product,
        // shopId: doc.shopId
      }))
    );


    const tempCartList = cart.cartProduct.map(id => id.toString());
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
      message: 'Cart founded with products',
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
