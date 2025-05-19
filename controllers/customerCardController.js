// const {CustomerCard,CustomerCardDetails} = require('../models/CustomerCardDetails');
// // Create a new Banner

// exports.addCustomerCard = async (req, res) => {
//   try {
//     console.log(req.body);
//     const newCard = CustomerCardDetails(req.body);

//     const userId = req.params.id;
//     // Try finding the existing user address doc
    

//     let cards = await CustomerCard.findOne({ userId });
    
//     if (cards) {
//       console.log(" user is here");

//       // newAddress.customerAddress.push(newAddress.customerAddress[0]);
//       // const addressToAdd = req.body;

//       // ✔️ Push to existing array
//       cards.customerCards.push(newCard);
//       console.log(newCard);

//       await cards.save();
//       return res.status(200).json({ message: 'Address added successfully', data: cards });
//     } else {
// console.log("no user here");
//       // Create new user with first address
//       const newEntry = CustomerCard({
//         userId:userId,
//         customerCards: [newCard]
//       });
// console.log(newEntry);
//       // customer.customerAddress.add(addressToAdd);
//       await newEntry.save();
//       return res.status(201).json({ message: 'New user address created', data: newCard });
//     }
//   } catch (error) {
//     res.status(500).json({ message: 'Error adding address', error: error.message });
//   }
// };


// // Retrieve a single person addres by ID
// exports.getCardById = async (req, res) => {

//   try {

//     console.log(CustomerCard);

//     const uerId =
//       await (req.params.id);
//     console.log();


//     const address = await CustomerCard.findOne({ userId: uerId });

//     if (!address) {
//       return res.status(404).json({ message: 'Address not found', data: [], success: false });
//     }
//     res.status(200).json({ data: address, message: "Address featched successfuly", status: true });
//   } catch (error) {


//     res.status(500).json({ message: 'Failed to fetch addres', error: error.message, success: false });
//   }
// };



// // // // Retrieve all Banners with filtering and pagination
// // exports.getAddress = async (req, res) => {
// //   try {
// //     // Optional filtering and pagination. By default, page 1 and limit 10.
// //     // const { page = 1, limit = 10, category, brand } = req.query;


// //     // Using lean() for improved read performance.
// //     const address = await CustomerAddress.find()
// //       .skip((page - 1) * limit)
// //       .limit(Number(limit))
// //       .lean();
// //     res.status(200).json({ message: 'Address featched successfuly', data: address, success: true });
// //   } catch (error) {
// //     res.status(500).json({ message: 'Failed to fetch address', data: error.message, success: false });
// //   }
// // };


// // Update by ID
// exports.updateCard = async (req, res) => {
//   try {
//     const userid = req.params.id;
//     const cardId = req.params.cardId;
//     const updateData = req.body;

//     const address = await CustomerCard.findOne({ userId: userid });

//     if (!address) {
//       return res.status(404).json({ message: "User not found", success: false });
//     }

//     let updated = false;
//     for (let i = 0; i < address.customerCards.length; i++) {
//       if (address.customerCards[i]._id.toString() === cardId) {
//         console.log("Element found");
//         address.customerCards[i] = { ...address.customerCards[i]._doc, ...updateData };
//         updated = true;
//         break;
//       }
//     }

//     if (!updated) {
//       return res.status(404).json({ message: "Address not found", success: false });
//     }

//     const updatedAddress = await address.save();

//     return res.status(200).json({
//       data: updatedAddress,
//       success: true,
//       message: "Address details are updated",
//     });
//   } catch (error) {
//     res.status(500).json({
//       message: "Failed to update address",
//       data: error.message,
//       success: false,
//     });
//   }
// };


// // Delete a Banner by ID
// exports.deleteCard = async (req, res) => {
//   try {
//     const userId = req.params.id;
//     const cardId = req.params.cardId;

//     const address = await CustomerCard.findOne({ userId });

//     if (!address) {
//       return res.status(404).json({ message: "User not found", success: false });
//     }

//     // Filter out the address with the matching addressId
//     const originalLength = address.customerCards.length;
//     address.customerCards = address.customerCards.filter(
//       (item) => item._id.toString() !== cardId
//     );

//     if (address.customerCards.length === originalLength) {
//       return res.status(404).json({ message: "Address not found", success: false });
//     }

//     const updatedDoc = await address.save();

//     return res.status(200).json({
//       message: "Address deleted successfully",
//       data: updatedDoc,
//       success: true,
//     });
//   } catch (error) {
//     return res.status(500).json({
//       message: "Failed to delete address",
//       data: error.message,
//       success: false,
//     });
//   }
// };



