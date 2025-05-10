const {CustomerAddress,CustomerAddressDetailed} = require('../models/CustomerAddress');
// Create a new Banner
exports.addCustomerAddress = async (req, res) => {
  try {
    console.log(req.body);
    const newAddress = CustomerAddressDetailed(req.body);

    const userId = req.params.id;
    // Try finding the existing user address doc
    

    let customer = await CustomerAddress.findOne({ userId });
    
    if (customer) {
      console.log(" user is here");

      // newAddress.customerAddress.push(newAddress.customerAddress[0]);
      // const addressToAdd = req.body;

      // ✔️ Push to existing array
      customer.customerAddress.push(newAddress);
      console.log(newAddress);

      await customer.save();
      return res.status(200).json({ message: 'Address added successfully', data: customer });
    } else {
console.log("no user here");
      // Create new user with first address
      const newEntry = CustomerAddress({
        userId:userId,
        customerAddress: [newAddress]
      });
console.log(newEntry);
      // customer.customerAddress.add(addressToAdd);
      await newEntry.save();
      return res.status(201).json({ message: 'New user address created', data: newAddress });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error adding address', error: error.message });
  }
};


// Retrieve a single person addres by ID
exports.getAllAddress = async (req, res) => {

  try {

    console.log(CustomerAddress);

    const uerId =
      await (req.params.id);
    console.log();


    const address = await CustomerAddress.findOne({uerId});
    console.log(address);
    console.log("sd");
    if (!address) {
      return res.status(404).json({ message: 'Address not found', data: [], success: false });
    }
    res.status(200).json({ data: address, message: "Address featched successfuly", status: true });
  } catch (error) {


    res.status(500).json({ message: 'Failed to fetch addres', error: error.message, success: false });
  }
};



// // // Retrieve all Banners with filtering and pagination
// exports.getAddress = async (req, res) => {
//   try {
//     // Optional filtering and pagination. By default, page 1 and limit 10.
//     // const { page = 1, limit = 10, category, brand } = req.query;


//     // Using lean() for improved read performance.
//     const address = await CustomerAddress.find()
//       .skip((page - 1) * limit)
//       .limit(Number(limit))
//       .lean();
//     res.status(200).json({ message: 'Address featched successfuly', data: address, success: true });
//   } catch (error) {
//     res.status(500).json({ message: 'Failed to fetch address', data: error.message, success: false });
//   }
// };


// Update by ID
exports.updateAddress = async (req, res) => {
  try {
    const userid = req.params.id;
    const addressId = req.params.addressId;
    const updateData = req.body;

    const address = await CustomerAddress.findOne({ userId: userid });

    if (!address) {
      return res.status(404).json({ message: "User not found", success: false });
    }

    let updated = false;
    for (let i = 0; i < address.customerAddress.length; i++) {
      if (address.customerAddress[i]._id.toString() === addressId) {
        console.log("Element found");
        address.customerAddress[i] = { ...address.customerAddress[i]._doc, ...updateData };
        updated = true;
        break;
      }
    }

    if (!updated) {
      return res.status(404).json({ message: "Address not found", success: false });
    }

    const updatedAddress = await address.save();

    return res.status(200).json({
      data: updatedAddress,
      success: true,
      message: "Address details are updated",
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update address",
      data: error.message,
      success: false,
    });
  }
};


// Delete a Banner by ID
exports.deleteAddress = async (req, res) => {
  try {
    const userId = req.params.id;
    const addressId = req.params.addressId;

    const address = await CustomerAddress.findOne({ userId });

    if (!address) {
      return res.status(404).json({ message: "User not found", success: false });
    }

    // Filter out the address with the matching addressId
    const originalLength = address.customerAddress.length;
    address.customerAddress = address.customerAddress.filter(
      (item) => item._id.toString() !== addressId
    );

    if (address.customerAddress.length === originalLength) {
      return res.status(404).json({ message: "Address not found", success: false });
    }

    const updatedDoc = await address.save();

    return res.status(200).json({
      message: "Address deleted successfully",
      data: updatedDoc,
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to delete address",
      data: error.message,
      success: false,
    });
  }
};



