// const mongoose = require('mongoose');



// const cardDetailsSchema = new mongoose.Schema({
//     cardHolderName: { type: String, required: true },
//     email: { type: String, required: true },
//     cardNumber: { type: String, required: true },
//     expiry: { type: Date, required: true },
//     cvv: { type: String, required: true },
// }, { timestamps: true });


// const customerCardSchema = new mongoose.Schema({
//     userId: { type: String, required: true },
//     customerCards: [cardDetailsSchema]
// });


// const CustomerCard= mongoose.model('CustomerCard', customerCardSchema);
// const CustomerCardDetails= mongoose.model('CustomerCardDetails', cardDetailsSchema);
// module.exports={CustomerCard,CustomerCardDetails};