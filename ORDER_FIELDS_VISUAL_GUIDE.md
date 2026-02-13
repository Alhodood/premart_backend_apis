# Order Response Fields - Visual Guide

## Order Structure Overview

```
Order
├── Basic Info
│   ├── _id (Order ID)
│   ├── createdAt (Timestamp)
│   └── orderStatus (Status)
│
├── 💰 PRICING & FINANCIAL FIELDS
│   ├── totalAmount (Subtotal) ........................... 500.00
│   ├── deliveryChargeAmount (🚚 NEW) ..................... 15.50
│   ├── itemDiscount (🎁 NEW) ............................. 29.75
│   ├── couponDiscount (🎁 NEW) ........................... 10.00
│   ├── totalDiscount (🎁 NEW) ............................ 39.75
│   └── finalPayable (Total to pay) ....................... 444.25
│
├── 📦 ITEMS (Per Product)
│   └── items[]
│       ├── shopProductId (Product ID)
│       ├── quantity (Qty) ............................... 1
│       ├── partName (Product name) ..................... Engine Oil
│       ├── partNumber (SKU) ............................ OIL-001
│       │
│       ├── 💵 Unit Pricing
│       │   ├── price (Original) ....................... 99.99
│       │   ├── discountedPrice (After discount) ..... 79.99
│       │   └── discount (Unit discount) ............... 20.00
│       │
│       ├── 💵 Total Pricing (for Qty)
│       │   ├── totalPrice (Original total) .......... 99.99
│       │   ├── totalDiscountedPrice (After disc) ... 79.99
│       │   └── totalDiscount (Qty × discount) ....... 20.00
│       │
│       ├── images (Product images)
│       ├── brand (Brand ID)
│       ├── model (Model ID)
│       └── category (Category ID)
│
├── 👤 CUSTOMER INFO
│   ├── customerName (Customer name)
│   ├── customerPhone (Phone number)
│   └── deliveryAddress (Full address)
│
├── 💳 PAYMENT INFO
│   ├── paymentMethod (COD/CARD/WALLET)
│   ├── paymentStatus (Pending/Completed)
│   └── transactionId (Transaction ID)
│
├── 🚚 DELIVERY INFO
│   └── assignedDeliveryBoy (Delivery person)
│
└── 🎟️ COUPON INFO
    └── coupon (Coupon details if applied)
```

## Pricing Calculation Flow

```
Order Pricing Calculation:

                      SUBTOTAL (totalAmount)
                            │
                            ├── 500.00
                            ↓
                   ┌──────────────────┐
                   │ ITEM DISCOUNTS   │
                   │ (itemDiscount)   │
                   │  - 29.75         │
                   └──────────────────┘
                            │
                            ↓
                   ┌──────────────────┐
                   │ COUPON DISCOUNT  │
                   │(couponDiscount)  │
                   │  - 10.00         │
                   └──────────────────┘
                            │
                            ↓
            [Total Discounts: 39.75] ← (itemDiscount + couponDiscount)
                            │
                            ↓
            Subtotal - Total Discount = 460.25
                            │
                            ↓
                   ┌──────────────────┐
                   │ DELIVERY CHARGE  │
                   │ (deliveryCharge) │
                   │  + 15.50         │
                   └──────────────────┘
                            │
                            ↓
                    FINAL PAYABLE (finalPayable)
                         444.25
```

## Per-Item Pricing Example

### Item 1: Engine Oil (Qty: 2)
```
Original Price:          99.99
├─ Discount:           -20.00
└─ Discounted Price:    79.99

For Quantity 2:
├─ Total Original:     199.98 (99.99 × 2)
├─ Total Discount:     -40.00 (20.00 × 2)
└─ Total After Disc:   159.98 (79.99 × 2)
```

### Item 2: Air Filter (Qty: 1)
```
Original Price:          49.99
├─ Discount:            -5.00
└─ Discounted Price:    44.99

For Quantity 1:
├─ Total Original:      49.99 (49.99 × 1)
├─ Total Discount:      -5.00 (5.00 × 1)
└─ Total After Disc:    44.99 (44.99 × 1)
```

## Order Summary Display

```
┌─────────────────────────────────────────┐
│          ORDER SUMMARY                  │
├─────────────────────────────────────────┤
│                                         │
│  Subtotal                   $500.00     │
│  - Product Discount         -$29.75     │
│  - Coupon Discount          -$10.00     │
│  + Delivery Charge          +$15.50     │
│                                         │
│  ─────────────────────────────────────  │
│  TOTAL                      $475.75     │
│                                         │
│  You saved: $39.75                      │
│                                         │
└─────────────────────────────────────────┘
```

## Discount Breakdown Types

```
┌─────────────────────────────────────┐
│ ITEM DISCOUNT (itemDiscount)        │
├─────────────────────────────────────┤
│ When: Product has promotional price │
│ How: Calculated from snapshot       │
│ Amount: (price - discountedPrice)   │
│ Example: $29.75                     │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ COUPON DISCOUNT (couponDiscount)    │
├─────────────────────────────────────┤
│ When: Coupon code applied at order  │
│ How: From coupon.discountAmount     │
│ Amount: Fixed or percentage         │
│ Example: $10.00                     │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ TOTAL DISCOUNT (totalDiscount)      │
├─────────────────────────────────────┤
│ When: Sum of all discounts          │
│ How: itemDiscount + couponDiscount  │
│ Amount: Total savings               │
│ Example: $39.75                     │
└─────────────────────────────────────┘
```

## Response JSON Tree

```json
{
  "success": true,
  "data": {
    "_id": "ORDER_ID",
    "createdAt": "2024-02-13T10:30:00Z",

    "orderStatus": "Pending",
    "statusHistory": [],

    "totalAmount": 500.00,
    "finalPayable": 444.25,
    "discount": 0,
    "deliveryChargeAmount": 15.50,           ← NEW
    "deliverycharge": true,
    "deliveryEarning": 0,
    "additionalcharges": 0,

    "itemDiscount": 29.75,                   ← NEW
    "couponDiscount": 10.00,                 ← NEW
    "totalDiscount": 39.75,                  ← NEW

    "quantity": 3,

    "deliveryAddress": { ... },
    "customerName": "John Doe",
    "customerPhone": "9876543210",

    "paymentMethod": "Card",
    "paymentStatus": "Pending",
    "transactionId": "TXN123456",

    "shopId": "SHOP_ID",

    "items": [
      {
        "shopProductId": "PROD_ID_1",
        "quantity": 1,
        "partName": "Engine Oil",
        "partNumber": "OIL-001",

        "price": 99.99,                      ← NEW
        "discountedPrice": 79.99,            ← NEW
        "discount": 20.00,                   ← NEW

        "totalPrice": 99.99,                 ← NEW
        "totalDiscountedPrice": 79.99,       ← NEW
        "totalDiscount": 20.00,              ← NEW

        "images": ["url"],
        "brand": "BRAND_ID",
        "model": "MODEL_ID",
        "category": "CAT_ID"
      }
    ],

    "assignedDeliveryBoy": { ... },
    "coupon": { ... }
  }
}
```

## Field Reference Table

### Quick Lookup

```
┌──────────────────────────────────────────────────────────────────┐
│ FIELD                      │ LEVEL │ TYPE   │ EXAMPLE           │
├──────────────────────────────────────────────────────────────────┤
│ totalAmount                │ Order │ Number │ 500.00            │
│ deliveryChargeAmount (NEW) │ Order │ Number │ 15.50             │
│ itemDiscount (NEW)         │ Order │ Number │ 29.75             │
│ couponDiscount (NEW)       │ Order │ Number │ 10.00             │
│ totalDiscount (NEW)        │ Order │ Number │ 39.75             │
│ finalPayable               │ Order │ Number │ 444.25            │
├──────────────────────────────────────────────────────────────────┤
│ price (NEW)                │ Item  │ Number │ 99.99             │
│ discountedPrice (NEW)      │ Item  │ Number │ 79.99             │
│ discount (NEW)             │ Item  │ Number │ 20.00             │
│ totalPrice (NEW)           │ Item  │ Number │ 99.99             │
│ totalDiscountedPrice (NEW) │ Item  │ Number │ 79.99             │
│ totalDiscount (NEW)        │ Item  │ Number │ 20.00             │
└──────────────────────────────────────────────────────────────────┘
```

## Calculation Examples

### Scenario 1: No Discount
```
Item: Price 100, No Discount
  price: 100
  discountedPrice: 100
  discount: 0

Order:
  itemDiscount: 0
  couponDiscount: 0
  totalDiscount: 0
```

### Scenario 2: Product Discount Only
```
Item: Price 100, Discounted to 80, Qty 2
  price: 100
  discountedPrice: 80
  discount: 20
  totalPrice: 200
  totalDiscountedPrice: 160
  totalDiscount: 40

Order:
  itemDiscount: 40
  couponDiscount: 0
  totalDiscount: 40
```

### Scenario 3: All Discounts
```
Item 1: 100 → 80, Qty 1 = Discount 20
Item 2: 50 → 50, Qty 1 = Discount 0
Subtotal: 150
Coupon: -10

Order:
  itemDiscount: 20
  couponDiscount: 10
  totalDiscount: 30
  finalPayable: 150 - 30 + delivery = 120 + delivery
```

## Common Queries

**Q: How to get total savings?**
```
A: totalDiscount = itemDiscount + couponDiscount
```

**Q: How much customer pays?**
```
A: finalPayable (includes all adjustments)
```

**Q: Original order value?**
```
A: totalAmount (subtotal before discounts)
```

**Q: Per-item discount?**
```
A: item.discount (unit discount)
```

**Q: Total saved on specific item?**
```
A: item.totalDiscount (discount × quantity)
```

**Q: Delivery cost?**
```
A: deliveryChargeAmount
```
