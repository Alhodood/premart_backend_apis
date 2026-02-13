# Order Response - Flutter Integration Guide

## New Fields Available in Order Response

When you call `GET /api/order/{orderId}`, the response now includes comprehensive discount and pricing information for better order summary displays.

## Order-Level Fields

Use these at the order summary level:

```dart
// Delivery charge
double deliveryCharge = order['deliveryChargeAmount'] ?? 0.0;

// Discount breakdown
double itemDiscount = order['itemDiscount'] ?? 0.0;      // From products
double couponDiscount = order['couponDiscount'] ?? 0.0;  // From coupon code
double totalDiscount = order['totalDiscount'] ?? 0.0;    // Item + Coupon

// Pricing
double subtotal = order['totalAmount'] ?? 0.0;           // Before discounts
double finalAmount = order['finalPayable'] ?? 0.0;       // After discounts + delivery
```

### Order Summary Calculation Example

```dart
// Display order summary
final orderData = response['data'];

final subtotal = orderData['totalAmount'] ?? 0.0;
final itemDiscount = orderData['itemDiscount'] ?? 0.0;
final couponDiscount = orderData['couponDiscount'] ?? 0.0;
final deliveryCharge = orderData['deliveryChargeAmount'] ?? 0.0;
final total = orderData['finalPayable'] ?? 0.0;

print('Subtotal: \$${subtotal.toStringAsFixed(2)}');
print('- Item Discount: -\$${itemDiscount.toStringAsFixed(2)}');
print('- Coupon Discount: -\$${couponDiscount.toStringAsFixed(2)}');
print('+ Delivery Charge: +\$${deliveryCharge.toStringAsFixed(2)}');
print('─────────────────────');
print('Total: \$${total.toStringAsFixed(2)}');
```

## Item-Level Fields

Use these for each product in the items list:

```dart
for (var item in order['items']) {
  // Pricing per unit
  double unitPrice = item['price'] ?? 0.0;
  double unitDiscountedPrice = item['discountedPrice'] ?? unitPrice;
  double unitDiscount = item['discount'] ?? 0.0;

  // Total for quantity
  int quantity = item['quantity'] ?? 1;
  double totalPrice = item['totalPrice'] ?? 0.0;
  double totalDiscountedPrice = item['totalDiscountedPrice'] ?? 0.0;
  double totalItemDiscount = item['totalDiscount'] ?? 0.0;

  // Product info
  String partName = item['partName'] ?? 'Product';
  String partNumber = item['partNumber'] ?? '';
  List<String> images = List<String>.from(item['images'] ?? []);
}
```

### Item Card Display Example

```dart
ListView.builder(
  itemCount: order['items'].length,
  itemBuilder: (context, index) {
    final item = order['items'][index];

    return Card(
      child: Column(
        children: [
          // Image
          Image.network(
            item['images']?.first ?? 'placeholder_url',
            height: 150,
            fit: BoxFit.cover,
          ),

          // Product info
          ListTile(
            title: Text(item['partName'] ?? 'Product'),
            subtitle: Text('${item['partNumber']}'),
            trailing: Text('Qty: ${item['quantity']}'),
          ),

          // Pricing breakdown
          Padding(
            padding: EdgeInsets.all(8.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Original price
                if ((item['discount'] ?? 0) > 0)
                  Text(
                    '\$${(item['price'] ?? 0).toStringAsFixed(2)}',
                    style: TextStyle(
                      decoration: TextDecoration.lineThrough,
                      color: Colors.grey,
                    ),
                  ),

                // Discounted price
                Text(
                  '\$${(item['discountedPrice'] ?? 0).toStringAsFixed(2)}',
                  style: Theme.of(context).textTheme.headline6,
                ),

                // Show discount if any
                if ((item['discount'] ?? 0) > 0)
                  Text(
                    'Save: \$${(item['totalDiscount'] ?? 0).toStringAsFixed(2)}',
                    style: TextStyle(color: Colors.green),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  },
)
```

### Order Summary Widget Example

```dart
Widget buildOrderSummary(Map<String, dynamic> order) {
  return Column(
    children: [
      // Subtotal
      Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text('Subtotal'),
          Text('\$${(order['totalAmount'] ?? 0).toStringAsFixed(2)}'),
        ],
      ),

      // Item discount
      if ((order['itemDiscount'] ?? 0) > 0)
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('Product Discount'),
            Text(
              '-\$${(order['itemDiscount'] ?? 0).toStringAsFixed(2)}',
              style: TextStyle(color: Colors.green),
            ),
          ],
        ),

      // Coupon discount
      if ((order['couponDiscount'] ?? 0) > 0)
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('Coupon (${order['coupon']?['code'] ?? 'N/A'})'),
            Text(
              '-\$${(order['couponDiscount'] ?? 0).toStringAsFixed(2)}',
              style: TextStyle(color: Colors.green),
            ),
          ],
        ),

      // Delivery charge
      if ((order['deliveryChargeAmount'] ?? 0) > 0)
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('Delivery Charge'),
            Text(
              '+\$${(order['deliveryChargeAmount'] ?? 0).toStringAsFixed(2)}',
              style: TextStyle(color: Colors.orange),
            ),
          ],
        ),

      Divider(),

      // Total
      Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            'Total',
            style: Theme.of(context).textTheme.headline6,
          ),
          Text(
            '\$${(order['finalPayable'] ?? 0).toStringAsFixed(2)}',
            style: Theme.of(context).textTheme.headline6,
          ),
        ],
      ),
    ],
  );
}
```

## Complete Order Details Model

```dart
class OrderDetails {
  final String orderId;
  final String orderStatus;
  final DateTime createdAt;

  // Pricing
  final double subtotal;
  final double itemDiscount;
  final double couponDiscount;
  final double totalDiscount;
  final double deliveryCharge;
  final double finalPayable;

  // Customer
  final String customerName;
  final String customerPhone;
  final Map<String, dynamic> deliveryAddress;

  // Items
  final List<OrderItem> items;

  // Payment
  final String paymentMethod;
  final String paymentStatus;
  final String? transactionId;

  // Coupon
  final Map<String, dynamic>? coupon;

  OrderDetails.fromJson(Map<String, dynamic> json)
      : orderId = json['_id'] ?? '',
        orderStatus = json['orderStatus'] ?? 'Unknown',
        createdAt = DateTime.parse(json['createdAt'] ?? DateTime.now().toString()),
        subtotal = (json['totalAmount'] ?? 0.0).toDouble(),
        itemDiscount = (json['itemDiscount'] ?? 0.0).toDouble(),
        couponDiscount = (json['couponDiscount'] ?? 0.0).toDouble(),
        totalDiscount = (json['totalDiscount'] ?? 0.0).toDouble(),
        deliveryCharge = (json['deliveryChargeAmount'] ?? 0.0).toDouble(),
        finalPayable = (json['finalPayable'] ?? 0.0).toDouble(),
        customerName = json['customerName'] ?? 'N/A',
        customerPhone = json['customerPhone'] ?? 'N/A',
        deliveryAddress = json['deliveryAddress'] ?? {},
        items = (json['items'] as List?)
                ?.map((item) => OrderItem.fromJson(item))
                .toList() ??
            [],
        paymentMethod = json['paymentMethod'] ?? 'Unknown',
        paymentStatus = json['paymentStatus'] ?? 'Unknown',
        transactionId = json['transactionId'],
        coupon = json['coupon'];
}

class OrderItem {
  final String productId;
  final String partName;
  final String partNumber;
  final int quantity;
  final double unitPrice;
  final double unitDiscountedPrice;
  final double unitDiscount;
  final double totalPrice;
  final double totalDiscountedPrice;
  final double totalDiscount;
  final List<String> images;
  final String? brand;
  final String? model;
  final String? category;

  OrderItem.fromJson(Map<String, dynamic> json)
      : productId = json['shopProductId'] ?? '',
        partName = json['partName'] ?? 'Product',
        partNumber = json['partNumber'] ?? '',
        quantity = json['quantity'] ?? 1,
        unitPrice = (json['price'] ?? 0.0).toDouble(),
        unitDiscountedPrice = (json['discountedPrice'] ?? 0.0).toDouble(),
        unitDiscount = (json['discount'] ?? 0.0).toDouble(),
        totalPrice = (json['totalPrice'] ?? 0.0).toDouble(),
        totalDiscountedPrice = (json['totalDiscountedPrice'] ?? 0.0).toDouble(),
        totalDiscount = (json['totalDiscount'] ?? 0.0).toDouble(),
        images = List<String>.from(json['images'] ?? []),
        brand = json['brand'],
        model = json['model'],
        category = json['category'];
}
```

## Usage Example

```dart
// In your order details page/controller
Future<void> fetchOrderDetails(String orderId) async {
  try {
    final response = await http.get(
      Uri.parse('$baseUrl/api/order/$orderId'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final order = OrderDetails.fromJson(data['data']);

      // Update UI
      setState(() {
        this.order = order;
      });

      // Display summary
      print('Total: \$${order.finalPayable}');
      print('Saved: \$${order.totalDiscount}');
    }
  } catch (e) {
    print('Error: $e');
  }
}
```

## Field Mapping

| Backend Field | Flutter Field | Type | Example |
|---|---|---|---|
| `totalAmount` | `subtotal` | double | 500.00 |
| `itemDiscount` | `itemDiscount` | double | 29.75 |
| `couponDiscount` | `couponDiscount` | double | 10.00 |
| `totalDiscount` | `totalDiscount` | double | 39.75 |
| `deliveryChargeAmount` | `deliveryCharge` | double | 15.50 |
| `finalPayable` | `finalPayable` | double | 475.75 |

## Notes

- All prices are **double** values (no string parsing needed)
- `discountedPrice` defaults to `price` if no discount applied
- `images` is a list; use first element for main image
- `coupon` is optional (null if no coupon applied)
- Use `totalDiscount` for displaying total savings to user
