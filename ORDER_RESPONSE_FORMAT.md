# Order Response Format - Updated Fields

## Summary of Changes
Updated `getOrderById` endpoint to include comprehensive discount and delivery charge information.

## New Fields Added

### Order-Level Fields (in `formattedOrder`)

1. **deliveryChargeAmount** (Number)
   - The actual delivery charge amount
   - Replaces the boolean `deliverycharge` with actual value
   - Example: `15.50`

2. **itemDiscount** (Number)
   - Total discount from product-level discounts
   - Calculated as: `(originalPrice - discountedPrice) × quantity` for each item, summed up
   - Example: `45.75`

3. **couponDiscount** (Number)
   - Discount amount from applied coupon code
   - Extracted from: `order.coupon.discountAmount`
   - Example: `10.00`

4. **totalDiscount** (Number)
   - Sum of all discounts (item discounts + coupon discounts)
   - Calculation: `itemDiscount + couponDiscount`
   - Example: `55.75`

### Item-Level Fields (in each item object)

For each product in the order, the following fields now include discount details:

1. **price** (Number)
   - Original unit price before any discount
   - Example: `99.99`

2. **discountedPrice** (Number)
   - Final unit price after discount (if applicable)
   - Example: `79.99`

3. **discount** (Number)
   - Unit discount per item
   - Calculation: `price - discountedPrice`
   - Example: `20.00`

4. **totalPrice** (Number)
   - Total original price for quantity
   - Calculation: `price × quantity`
   - Example: `199.98` (if quantity is 2)

5. **totalDiscountedPrice** (Number)
   - Total final price for quantity after discount
   - Calculation: `discountedPrice × quantity`
   - Example: `159.98` (if quantity is 2)

6. **totalDiscount** (Number)
   - Total discount amount for quantity
   - Calculation: `discount × quantity`
   - Example: `40.00` (if quantity is 2)

## Complete Response Structure

```json
{
  "success": true,
  "data": {
    "_id": "order_id",
    "createdAt": "2024-02-13T10:30:00Z",

    "orderStatus": "Pending",
    "statusHistory": [],

    "totalAmount": 500.00,
    "finalPayable": 444.25,
    "discount": 0,
    "deliveryChargeAmount": 15.50,
    "deliverycharge": true,
    "deliveryEarning": 0,
    "additionalcharges": 0,

    "itemDiscount": 29.75,
    "couponDiscount": 10.00,
    "totalDiscount": 39.75,

    "quantity": 3,

    "deliveryAddress": {
      "name": "John Doe",
      "contact": "9876543210",
      "address": "123 Main St",
      "area": "Downtown",
      "place": "City",
      "latitude": 40.7128,
      "longitude": -74.0060
    },
    "customerName": "John Doe",
    "customerPhone": "9876543210",

    "paymentMethod": "Card",
    "paymentStatus": "Pending",
    "transactionId": "TXN123456",

    "shopId": "shop_id",

    "items": [
      {
        "shopProductId": "product_id",
        "quantity": 1,
        "partName": "Engine Oil",
        "partNumber": "OIL-001",
        "price": 99.99,
        "discountedPrice": 79.99,
        "discount": 20.00,
        "totalPrice": 99.99,
        "totalDiscountedPrice": 79.99,
        "totalDiscount": 20.00,
        "images": ["url/to/image.jpg"],
        "brand": "brand_id",
        "model": "model_id",
        "category": "category_id"
      },
      {
        "shopProductId": "product_id_2",
        "quantity": 2,
        "partName": "Air Filter",
        "partNumber": "FILTER-002",
        "price": 49.99,
        "discountedPrice": 44.99,
        "discount": 5.00,
        "totalPrice": 99.98,
        "totalDiscountedPrice": 89.98,
        "totalDiscount": 10.00,
        "images": ["url/to/image2.jpg"],
        "brand": "brand_id_2",
        "model": "model_id_2",
        "category": "category_id_2"
      }
    ],

    "assignedDeliveryBoy": {
      "_id": "delivery_boy_id",
      "name": "Ahmed Ali"
    },

    "coupon": {
      "code": "SAVE10",
      "discountType": "FIXED",
      "discountValue": 10,
      "discountAmount": 10.00
    }
  }
}
```

## Discount Calculation Examples

### Example 1: Single Item with Product Discount
```
Item Price: 100
Discounted Price: 80
Quantity: 1

Item-level:
  price: 100
  discountedPrice: 80
  discount: 20
  totalPrice: 100
  totalDiscountedPrice: 80
  totalDiscount: 20

Order-level:
  itemDiscount: 20
```

### Example 2: Multiple Items with Different Discounts
```
Item 1: Price 100, Discounted 80, Qty 2 → Discount = 40
Item 2: Price 50, Discounted 50, Qty 1 → Discount = 0
Item 3: Price 200, Discounted 150, Qty 1 → Discount = 50

Order-level:
  itemDiscount: 40 + 0 + 50 = 90
  couponDiscount: 10 (from coupon code)
  totalDiscount: 90 + 10 = 100
```

### Example 3: With Delivery Charge
```
Subtotal: 500
Item Discount: 50
Coupon Discount: 10
Delivery Charge: 15

totalAmount: 500
itemDiscount: 50
couponDiscount: 10
totalDiscount: 60
deliveryChargeAmount: 15
finalPayable: 500 - 60 + 15 = 455
```

## API Endpoint

**GET** `/api/order/{orderId}`

### Response
Returns the complete order with all the new discount and delivery charge fields as shown above.

## Field Mapping Reference

| Field | Location | Type | Description |
|-------|----------|------|-------------|
| deliveryChargeAmount | Order | Number | Actual delivery charge amount |
| itemDiscount | Order | Number | Total discount from products |
| couponDiscount | Order | Number | Discount from coupon code |
| totalDiscount | Order | Number | Sum of all discounts |
| price | Item | Number | Unit price (original) |
| discountedPrice | Item | Number | Unit price (after discount) |
| discount | Item | Number | Unit discount |
| totalPrice | Item | Number | Total price for quantity (original) |
| totalDiscountedPrice | Item | Number | Total price for quantity (after discount) |
| totalDiscount | Item | Number | Total discount for quantity |

## Database Schema Source

Order Model (`models/Order.js`):
- `subtotal`: Original order total before discounts
- `discount`: Additional discounts applied
- `deliveryCharge`: Delivery charge amount
- `totalPayable`: Final amount to be paid
- `items[].snapshot.price`: Original product price
- `items[].snapshot.discountedPrice`: Discounted product price
- `coupon.discountAmount`: Coupon discount amount

## Notes

1. All prices are stored as **Numbers** in the database (no currency symbols)
2. Discount calculations are done **at the time of response**, derived from snapshot data
3. The `snapshot` object preserves original product details and prices at the time of order
4. Coupon information is optional (only present if a coupon was applied)
5. If `discountedPrice` is not present in snapshot, it defaults to `price` (no discount)
