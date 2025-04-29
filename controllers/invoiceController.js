const PDFDocument = require('pdfkit');
const Payment = require('../models/Payment');
const Order = require('../models/Order');

exports.generateInvoice = async (req, res) => {
  try {
    const paymentId = req.params.paymentId;

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found', success: false });
    }

    const order = await Order.findById(payment.orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found', success: false });
    }

    const doc = new PDFDocument({ margin: 30 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${paymentId}.pdf`);

    doc.fontSize(20).text('PreMart Invoice', { align: 'center' });
    doc.moveDown();

    doc.fontSize(14).text(`Invoice ID: ${paymentId}`);
    doc.text(`Transaction ID: ${payment.transactionId || 'N/A'}`);
    doc.text(`Payment Method: ${payment.paymentMethod}`);
    doc.text(`Payment Status: ${payment.paymentStatus}`);
    doc.text(`Payment Date: ${new Date(payment.paymentDate).toLocaleDateString()}`);
    doc.moveDown();

    doc.text(`Order ID: ${order._id}`);
    doc.text(`Order Total Amount: ${payment.amount}`);
    doc.text(`Order Status: ${order.orderStatus}`);
    doc.moveDown();

    doc.text('Thank you for shopping with PreMart!', { align: 'center' });

    doc.end();
    doc.pipe(res);

  } catch (error) {
    console.error('Generate Invoice Error:', error);
    res.status(500).json({
      message: 'Failed to generate invoice',
      success: false,
      data: error.message
    });
  }
};