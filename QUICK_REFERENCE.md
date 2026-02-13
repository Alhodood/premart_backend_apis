# Order Response Fields - Quick Reference Card

## 🎯 At a Glance

| Feature | Field | Type | Example |
|---------|-------|------|---------|
| 💵 Original subtotal | `totalAmount` | Number | 500.00 |
| 🎁 Product discount | `itemDiscount` | Number | 29.75 |
| 🎟️ Coupon discount | `couponDiscount` | Number | 10.00 |
| 🎁 Total discount | `totalDiscount` | Number | 39.75 |
| 🚚 Delivery charge | `deliveryChargeAmount` | Number | 15.50 |
| 💳 Final amount | `finalPayable` | Number | 475.75 |

## 📦 Per-Item Fields

```dart
// In each item object
item['price']                 // 99.99  (original unit price)
item['discountedPrice']       // 79.99  (after discount)
item['discount']              // 20.00  (unit discount)
item['totalPrice']            // 99.99  (99.99 × qty)
item['totalDiscountedPrice']  // 79.99  (79.99 × qty)
item['totalDiscount']         // 20.00  (discount × qty)
```

## 🚀 Quick Integration

```dart
// Parse order response
final order = response['data'];

// Display summary
print('Subtotal: \$${order['totalAmount']}');
print('Delivery: \$${order['deliveryChargeAmount']}');
print('Discount: -\$${order['totalDiscount']}');
print('Total: \$${order['finalPayable']}');

// Show per-item discounts
for (var item in order['items']) {
  if ((item['discount'] ?? 0) > 0) {
    print('${item['partName']}: Save \$${item['totalDiscount']}');
  }
}
```

## 📊 Calculation Formula

```
finalPayable = totalAmount
             - itemDiscount
             - couponDiscount
             + deliveryChargeAmount

// Or simply use finalPayable directly
```

## ✅ What Changed

**Before:**
```javascript
deliverycharge: true  // Boolean (not useful)
```

**After:**
```javascript
deliveryChargeAmount: 15.50  // Actual amount
deliverycharge: true         // Still present for compatibility
itemDiscount: 29.75
couponDiscount: 10.00
totalDiscount: 39.75
// Plus per-item pricing details
```

## 🔗 API Response Path

```
GET /api/order/{orderId}
└── response
    └── data
        ├── deliveryChargeAmount (🆕)
        ├── itemDiscount (🆕)
        ├── couponDiscount (🆕)
        ├── totalDiscount (🆕)
        └── items[]
            ├── price (🆕)
            ├── discountedPrice (🆕)
            ├── discount (🆕)
            ├── totalPrice (🆕)
            ├── totalDiscountedPrice (🆕)
            └── totalDiscount (🆕)
```

## 📋 Field Checklist

- [x] `deliveryChargeAmount` - Delivery cost (was boolean)
- [x] `itemDiscount` - Product discounts
- [x] `couponDiscount` - Coupon discounts
- [x] `totalDiscount` - All discounts combined
- [x] Item `price` - Original unit price
- [x] Item `discountedPrice` - Final unit price
- [x] Item `discount` - Per unit discount
- [x] Item `totalPrice` - Total for qty (original)
- [x] Item `totalDiscountedPrice` - Total for qty (final)
- [x] Item `totalDiscount` - Total qty discount

## 🎯 Use Cases

**Display Order Summary:**
```dart
buildOrderSummary(order) {
  return [
    'Subtotal: \$${order['totalAmount']}',
    'Savings: \$${order['totalDiscount']}',
    'Delivery: \$${order['deliveryChargeAmount']}',
    'Total: \$${order['finalPayable']}'
  ].join('\n');
}
```

**Display Item Discount:**
```dart
buildItemCard(item) {
  final saved = item['totalDiscount'] ?? 0;
  if (saved > 0) {
    return 'Save: \$${saved}';
  }
  return 'No discount';
}
```

**Calculate Savings:**
```dart
final savings = order['totalDiscount'] ?? 0;
final percent = (savings / order['totalAmount'] * 100).toStringAsFixed(1);
print('You saved: \$${savings} (${percent}%)');
```

## 🔄 Data Flow

```
Order in Database
    ↓
GET /api/order/{id}
    ↓
Backend calculates:
  - itemDiscount = (price - discountedPrice) × qty
  - totalDiscount = itemDiscount + couponDiscount
    ↓
Response includes all fields
    ↓
Flutter receives and displays
```

## 📱 Flutter Widget Example

```dart
class OrderSummary extends StatelessWidget {
  final Map<String, dynamic> order;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        SummaryRow('Subtotal', order['totalAmount']),
        SummaryRow('Discount', -order['totalDiscount']),
        SummaryRow('Delivery', order['deliveryChargeAmount']),
        Divider(),
        SummaryRow('Total', order['finalPayable'], isBold: true),
      ],
    );
  }
}

class SummaryRow extends StatelessWidget {
  final String label;
  final double amount;
  final bool isBold;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: isBold ? TextStyle(fontWeight: FontWeight.bold) : null),
        Text('\$${amount.toStringAsFixed(2)}'),
      ],
    );
  }
}
```

## ⚠️ Important Notes

1. **All amounts are positive Numbers** (no currency symbols)
2. **Discount amounts are subtracted** from total
3. **Delivery charge is added** to total
4. **Default values** are 0 if fields missing
5. **Backward compatible** - old fields still present
6. **No extra database queries** - calculated at response time

## 📞 Support

For questions about the new fields:
- See: `ORDER_RESPONSE_FORMAT.md`
- See: `FLUTTER_INTEGRATION_GUIDE.md`
- See: `ORDER_FIELDS_VISUAL_GUIDE.md`

---
**Last Updated:** 2024-02-13
**Status:** ✅ Complete & Ready
