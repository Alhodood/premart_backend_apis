# Flutter Wishlist API Guide

This guide documents the Premart wishlist API and how to use it from your Flutter app. The wishlist uses **ShopProduct** IDs (same as the cart).

## Base path

All wishlist routes are under:

```
/api/wishlist
```

So with `baseUrl = https://your-api.com` you call `$baseUrl/api/wishlist/...`.

---

## Endpoints

### 1. Get full wishlist (with product details)

**GET** `/api/wishlist/:userId`

Returns cart-like items: `shopProductId`, `part`, `shop`, `price`, etc.

**Example:** `GET /api/wishlist/697373ecb9e8e670dae27cb2`

**Response (success):**
```json
{
  "success": true,
  "message": "Wishlist found with products",
  "data": [
    {
      "shopProductId": "...",
      "price": 1200,
      "discountedPrice": null,
      "stock": 5,
      "part": { "_id": "...", "partNumber": "...", "partName": "...", "category": {...}, "subCategory": {...}, "images": [...] },
      "shop": { "_id": "...", "shopName": "...", "shopAddress": "...", "shopContact": "...", "shopMail": "...", "shopLocation": "..." }
    }
  ],
  "productIds": ["shopProductId1", "shopProductId2"]
}
```

**Response (empty wishlist):**
```json
{
  "success": true,
  "message": "Wishlist not found or empty",
  "data": [],
  "productIds": []
}
```

---

### 2. Add / remove from wishlist (toggle)

**POST** `/api/wishlist/:userId`

**Body (JSON):** one of:

- `shopProductId` — single ID  
- `shopProductIds` — array of IDs  
- `productID` — single ID (alias)  
- `productIDs` — array of IDs (alias)

**Example:** `POST /api/wishlist/697373ecb9e8e670dae27cb2`

```json
{
  "shopProductId": "64a1b2c3d4e5f6789012345"
}
```

or

```json
{
  "shopProductIds": ["64a1b2c3d4e5f6789012345", "64a1b2c3d4e5f6789012346"]
}
```

**Response (success):**
```json
{
  "message": "Products added to wishlist",
  "success": true,
  "added": [ { "shopProductId": "...", "price": 1200, "part": {...}, "shop": {...} } ],
  "removed": [],
  "data": [ ... ],
  "productIds": ["...", "..."]
}
```

**Error (product not found or unavailable):**
```json
{
  "message": "Product(s) not found or not available: 64a1b2c3d4e5f6789012345",
  "success": false,
  "data": []
}
```

**Error (missing body):**
```json
{
  "message": "userId and at least one of shopProductId, shopProductIds, productID, or productIDs is required",
  "success": false,
  "data": []
}
```

---

### 3. Check if product is in wishlist

**GET** `/api/wishlist/check/:userId?productID=:shopProductId`  
or  
**GET** `/api/wishlist/check/:userId?shopProductID=:shopProductId`

**Example:** `GET /api/wishlist/check/697373ecb9e8e670dae27cb2?shopProductID=64a1b2c3d4e5f6789012345`

**Response:**
```json
{
  "success": true,
  "isInWishlist": true,
  "productID": "64a1b2c3d4e5f6789012345",
  "shopProductId": "64a1b2c3d4e5f6789012345",
  "message": "Product is in wishlist"
}
```

---

### 4. Get wishlist product IDs only (lightweight)

**GET** `/api/wishlist/ids/:userId`

**Example:** `GET /api/wishlist/ids/697373ecb9e8e670dae27cb2`

**Response:**
```json
{
  "success": true,
  "productIds": ["id1", "id2"],
  "count": 2,
  "message": "Wishlist product IDs retrieved"
}
```

---

## Flutter usage summary

| Action              | Method | URL                                              | Body / query                               |
|---------------------|--------|--------------------------------------------------|--------------------------------------------|
| Get wishlist        | GET    | `$baseUrl/api/wishlist/$userId`                  | —                                          |
| Add/remove (toggle) | POST   | `$baseUrl/api/wishlist/$userId`                  | `shopProductId` or `shopProductIds`        |
| Check in wishlist   | GET    | `$baseUrl/api/wishlist/check/$userId?shopProductID=$id` | —                                  |
| Get IDs only        | GET    | `$baseUrl/api/wishlist/ids/$userId`              | —                                          |

Use **ShopProduct** IDs (same as cart). Send `Authorization: Bearer <token>` if your API requires it.

---

## Example: Dio

```dart
// Get wishlist
final res = await dio.get('$baseUrl/api/wishlist/$userId');
// res.data['data'] = list of items, res.data['productIds'] = list of IDs

// Toggle wishlist
await dio.post(
  '$baseUrl/api/wishlist/$userId',
  data: { 'shopProductId': shopProductId },
);

// Check status
final r = await dio.get(
  '$baseUrl/api/wishlist/check/$userId',
  queryParameters: { 'shopProductID': shopProductId },
);
final isInWishlist = r.data['isInWishlist'] == true;

// Get IDs only
final r2 = await dio.get('$baseUrl/api/wishlist/ids/$userId');
final ids = List<String>.from(r2.data['productIds'] ?? []);
```

---

## Troubleshooting

- **404:** Use full path `/api/wishlist/...`, not `/wishlist/...`.
- **“Product(s) not found or not available”:** Use **ShopProduct** IDs (same as add-to-cart), not part IDs or other IDs.
- **Empty `data`:** Backend now uses ShopProduct; ensure you’re sending and storing `shopProductId` everywhere.
