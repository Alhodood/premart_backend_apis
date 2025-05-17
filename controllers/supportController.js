// const Page = require('../models/Page');

// // Create or update a page
// exports.upsertPage = async (req, res) => {
//   try {
//     const { title, content } = req.body;
//     if (!['privacy-policy', 'terms-and-conditions'].includes(title)) {
//       return res.status(400).json({ success: false, message: 'Invalid page title' });
//     }

//     const page = await Page.findOneAndUpdate(
//       { title },
//       { content },
//       { new: true, upsert: true, setDefaultsOnInsert: true }
//     );

//     res.status(200).json({ success: true, message: 'Page saved successfully', data: page });
//   } catch (error) {
//     res.status(500).json({ success: false, message: 'Error saving page', error: error.message });
//   }
// };

// // Get a page
// exports.getPage = async (req, res) => {
//   try {
//     const { title } = req.params;

//     const page = await Page.findOne({ title });
//     if (!page) {
//       return res.status(404).json({ success: false, message: 'Page not found' });
//     }

//     res.status(200).json({ success: true, data: page });
//   } catch (error) {
//     res.status(500).json({ success: false, message: 'Error fetching page', error: error.message });
//   }
// };
