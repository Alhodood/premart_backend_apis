const Order = require('../models/Order');



exports.superAdminSalesReport = async (req, res) => {
  try {
    let { from, to } = req.query;

    let filter = { orderStatus: 'Delivered' };

    if (from && to) {
      filter.createdAt = {
        $gte: new Date(from),
        $lte: new Date(to)
      };
    }

    const deliveredOrders = await Order.find(filter);

    const totalSales = deliveredOrders.reduce((sum, order) => sum + parseFloat(order.totalAmount), 0);

    return res.status(200).json({
      message: 'Super Admin Sales Report',
      success: true,
      dateRange: from && to ? `${from} to ${to}` : 'All Time',
      totalSales: totalSales.toFixed(2),
      totalOrders: deliveredOrders.length,
      data: deliveredOrders
    });

  } catch (error) {
    console.error('Super Admin Sales Report Error:', error);
    res.status(500).json({
      message: 'Failed to fetch sales report',
      success: false,
      data: error.message
    });
  }
};

///////Shop Admin Sales Report



  exports.shopAdminSalesReport = async (req, res) => {
    try {
      const shopId = req.params.shopId;
      let { from, to } = req.query;
  
      if (!shopId) {
        return res.status(400).json({
          message: 'Shop ID is required',
          success: false,
          data: []
        });
      }
  
      let filter = {
        shopId: shopId,
        orderStatus: 'Delivered'
      };
  
      if (from && to) {
        filter.createdAt = {
          $gte: new Date(from),
          $lte: new Date(to)
        };
      }
  
      const shopOrders = await Order.find(filter);
  
      const totalSales = shopOrders.reduce((sum, order) => sum + parseFloat(order.totalAmount), 0);
  
      return res.status(200).json({
        message: 'Shop Admin Sales Report',
        success: true,
        shopId: shopId,
        dateRange: from && to ? `${from} to ${to}` : 'All Time',
        totalSales: totalSales.toFixed(2),
        totalOrders: shopOrders.length,
        data: shopOrders
      });
  
    } catch (error) {
      console.error('Shop Admin Sales Report Error:', error);
      res.status(500).json({
        message: 'Failed to fetch shop sales report',
        success: false,
        data: error.message
      });
    }
  };


  //graphs api




exports.superAdminSalesGraph = async (req, res) => {
  try {
    let { from, to } = req.query;

    let filter = { orderStatus: 'Delivered' };

    if (from && to) {
      filter.createdAt = {
        $gte: new Date(from),
        $lte: new Date(to)
      };
    }

    const orders = await Order.find(filter);

    // Group by Date
    const salesByDate = {};

    orders.forEach(order => {
      const date = order.createdAt.toISOString().split('T')[0]; // format "YYYY-MM-DD"
      if (!salesByDate[date]) {
        salesByDate[date] = 0;
      }
      salesByDate[date] += parseFloat(order.totalAmount);
    });

    const graphData = Object.keys(salesByDate).map(date => ({
      date,
      totalSales: salesByDate[date].toFixed(2)
    })).sort((a, b) => new Date(a.date) - new Date(b.date));

    return res.status(200).json({
      message: 'Super Admin Sales Graph',
      success: true,
      data: graphData
    });

  } catch (error) {
    console.error('Super Admin Sales Graph Error:', error);
    res.status(500).json({
      message: 'Failed to fetch sales graph',
      success: false,
      data: error.message
    });
  }
};


exports.shopAdminSalesGraph = async (req, res) => {
  try {
    const shopId = req.params.shopId;
    let { from, to } = req.query;

    if (!shopId) {
      return res.status(400).json({
        message: 'Shop ID is required',
        success: false,
        data: []
      });
    }

    let filter = {
      shopId: shopId,
      orderStatus: 'Delivered'
    };

    if (from && to) {
      filter.createdAt = {
        $gte: new Date(from),
        $lte: new Date(to)
      };
    }

    const orders = await Order.find(filter);

    // Group by Date
    const salesByDate = {};

    orders.forEach(order => {
      const date = order.createdAt.toISOString().split('T')[0];
      if (!salesByDate[date]) {
        salesByDate[date] = 0;
      }
      salesByDate[date] += parseFloat(order.totalAmount);
    });

    const graphData = Object.keys(salesByDate).map(date => ({
      date,
      totalSales: salesByDate[date].toFixed(2)
    })).sort((a, b) => new Date(a.date) - new Date(b.date));

    return res.status(200).json({
      message: 'Shop Admin Sales Graph',
      success: true,
      shopId: shopId,
      data: graphData
    });

  } catch (error) {
    console.error('Shop Admin Sales Graph Error:', error);
    res.status(500).json({
      message: 'Failed to fetch shop sales graph',
      success: false,
      data: error.message
    });
  }
};