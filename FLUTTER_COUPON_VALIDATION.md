# Flutter Coupon Validation Implementation Guide

This guide explains how to implement coupon checking/validation in your Flutter app using the Premart backend API.

## API Endpoint

**POST** `/api/offer-Coupon/coupon/check`

> **Important:** The coupon routes are mounted under `/api/offer-Coupon` (note the hyphen and capital C).  
> Using `/coupon/check` alone returns **404**. Your `baseUrl` must not already end with `coupon/check` (this can cause `coupon/checkcheck` and 404).

### Request Body
```json
{
  "userId": "user_id_string",
  "code": "COUPON_CODE",
  "orderAmount": 1000.00
}
```

### Response (Success)
```json
{
  "success": true,
  "message": "Coupon applied successfully",
  "data": {
    "discount": 100.00,
    "finalAmount": 900.00,
    "couponId": "coupon_id_string"
  }
}
```

### Response (Error)
```json
{
  "success": false,
  "message": "Invalid or inactive coupon code",
  "data": []
}
```

## Step 1: Create Coupon Service

Create `lib/services/coupon_service.dart`:

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class CouponService {
  final String baseUrl;
  
  CouponService({required this.baseUrl});

  /// Check/Validate a coupon code
  /// 
  /// Returns a CouponResult with discount details if valid,
  /// or error message if invalid
  Future<CouponResult> checkCoupon({
    required String userId,
    required String code,
    required double orderAmount,
  }) async {
    try {
      // Full path: /api/offer-Coupon/coupon/check (see server.js mount)
      final url = Uri.parse('$baseUrl/api/offer-Coupon/coupon/check');
      
      final response = await http.post(
        url,
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'userId': userId,
          'code': code.toUpperCase(), // Backend converts to uppercase
          'orderAmount': orderAmount,
        }),
      );

      final responseData = jsonDecode(response.body);

      if (response.statusCode == 200 && responseData['success'] == true) {
        final data = responseData['data'];
        return CouponResult(
          isValid: true,
          discount: data['discount']?.toDouble() ?? 0.0,
          finalAmount: data['finalAmount']?.toDouble() ?? orderAmount,
          couponId: data['couponId'] ?? '',
          message: responseData['message'] ?? 'Coupon applied successfully',
        );
      } else {
        return CouponResult(
          isValid: false,
          discount: 0.0,
          finalAmount: orderAmount,
          couponId: '',
          message: responseData['message'] ?? 'Invalid coupon code',
        );
      }
    } catch (e) {
      return CouponResult(
        isValid: false,
        discount: 0.0,
        finalAmount: orderAmount,
        couponId: '',
        message: 'Error checking coupon: ${e.toString()}',
      );
    }
  }

  /// Get all available coupons
  Future<List<Coupon>> getAllCoupons() async {
    try {
      final url = Uri.parse('$baseUrl/api/offer-Coupon/coupon');
      
      final response = await http.get(url);

      if (response.statusCode == 200) {
        final responseData = jsonDecode(response.body);
        if (responseData['success'] == true) {
          final List<dynamic> coupons = responseData['data'] ?? [];
          return coupons.map((c) => Coupon.fromJson(c)).toList();
        }
      }
      return [];
    } catch (e) {
      print('Error fetching coupons: $e');
      return [];
    }
  }
}

/// Result model for coupon validation
class CouponResult {
  final bool isValid;
  final double discount;
  final double finalAmount;
  final String couponId;
  final String message;

  CouponResult({
    required this.isValid,
    required this.discount,
    required this.finalAmount,
    required this.couponId,
    required this.message,
  });
}

/// Coupon model
class Coupon {
  final String id;
  final String code;
  final String discountType; // 'flat', 'percent', 'amount'
  final double discountValue;
  final double? minOrderAmount;
  final int? usageLimit;
  final int usedCount;
  final DateTime? startDate;
  final DateTime? expiryDate;
  final bool isActive;

  Coupon({
    required this.id,
    required this.code,
    required this.discountType,
    required this.discountValue,
    this.minOrderAmount,
    this.usageLimit,
    required this.usedCount,
    this.startDate,
    this.expiryDate,
    required this.isActive,
  });

  factory Coupon.fromJson(Map<String, dynamic> json) {
    return Coupon(
      id: json['_id'] ?? '',
      code: json['code'] ?? '',
      discountType: json['discountType'] ?? 'flat',
      discountValue: (json['discountValue'] ?? 0).toDouble(),
      minOrderAmount: json['minOrderAmount']?.toDouble(),
      usageLimit: json['usageLimit'],
      usedCount: json['usedCount'] ?? 0,
      startDate: json['startDate'] != null 
          ? DateTime.parse(json['startDate']) 
          : null,
      expiryDate: json['expiryDate'] != null 
          ? DateTime.parse(json['expiryDate']) 
          : null,
      isActive: json['isActive'] ?? true,
    );
  }

  /// Get formatted discount text
  String getDiscountText() {
    if (discountType == 'percent') {
      return '$discountValue% OFF';
    } else if (discountType == 'flat' || discountType == 'amount') {
      return '₹$discountValue OFF';
    }
    return 'Discount';
  }
}
```

## Step 2: Create Coupon Input Widget

Create `lib/widgets/coupon_input_widget.dart`:

```dart
import 'package:flutter/material.dart';

class CouponInputWidget extends StatefulWidget {
  final Function(String) onApplyCoupon;
  final String? appliedCouponCode;
  final double discount;
  final bool isLoading;

  const CouponInputWidget({
    Key? key,
    required this.onApplyCoupon,
    this.appliedCouponCode,
    this.discount = 0.0,
    this.isLoading = false,
  }) : super(key: key);

  @override
  _CouponInputWidgetState createState() => _CouponInputWidgetState();
}

class _CouponInputWidgetState extends State<CouponInputWidget> {
  final TextEditingController _couponController = TextEditingController();
  final FocusNode _focusNode = FocusNode();

  @override
  void dispose() {
    _couponController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withOpacity(0.1),
            spreadRadius: 1,
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Apply Coupon',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 12),
          if (widget.appliedCouponCode != null)
            Container(
              padding: const EdgeInsets.all(12),
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: Colors.green.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.green.shade200),
              ),
              child: Row(
                children: [
                  Icon(Icons.check_circle, color: Colors.green.shade700),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Coupon Applied: ${widget.appliedCouponCode}',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Colors.green.shade700,
                          ),
                        ),
                        if (widget.discount > 0)
                          Text(
                            'Discount: ₹${widget.discount.toStringAsFixed(2)}',
                            style: TextStyle(
                              color: Colors.green.shade600,
                              fontSize: 12,
                            ),
                          ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () {
                      _couponController.clear();
                      widget.onApplyCoupon('');
                    },
                    color: Colors.grey,
                  ),
                ],
              ),
            ),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _couponController,
                  focusNode: _focusNode,
                  enabled: widget.appliedCouponCode == null && !widget.isLoading,
                  decoration: InputDecoration(
                    hintText: 'Enter coupon code',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                  ),
                  textCapitalization: TextCapitalization.characters,
                ),
              ),
              const SizedBox(width: 8),
              ElevatedButton(
                onPressed: widget.isLoading || widget.appliedCouponCode != null
                    ? null
                    : () {
                        if (_couponController.text.trim().isNotEmpty) {
                          widget.onApplyCoupon(_couponController.text.trim());
                        }
                      },
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 24,
                    vertical: 12,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                child: widget.isLoading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                        ),
                      )
                    : const Text('Apply'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
```

## Step 3: Usage in Cart/Checkout Screen

Example usage in your cart or checkout screen:

```dart
import 'package:flutter/material.dart';
import 'services/coupon_service.dart';
import 'widgets/coupon_input_widget.dart';

class CheckoutScreen extends StatefulWidget {
  final String userId;
  final double cartTotal;

  const CheckoutScreen({
    Key? key,
    required this.userId,
    required this.cartTotal,
  }) : super(key: key);

  @override
  _CheckoutScreenState createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  final CouponService _couponService = CouponService(
    baseUrl: 'http://your-backend-url:PORT', // Replace with your backend URL
  );

  String? _appliedCouponCode;
  double _discount = 0.0;
  double _finalAmount = 0.0;
  String? _couponId;
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _finalAmount = widget.cartTotal;
  }

  Future<void> _applyCoupon(String code) async {
    if (code.isEmpty) {
      // Remove coupon
      setState(() {
        _appliedCouponCode = null;
        _discount = 0.0;
        _finalAmount = widget.cartTotal;
        _couponId = null;
        _errorMessage = null;
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final result = await _couponService.checkCoupon(
        userId: widget.userId,
        code: code,
        orderAmount: widget.cartTotal,
      );

      if (result.isValid) {
        setState(() {
          _appliedCouponCode = code;
          _discount = result.discount;
          _finalAmount = result.finalAmount;
          _couponId = result.couponId;
          _errorMessage = null;
        });

        // Show success message
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result.message),
            backgroundColor: Colors.green,
            duration: const Duration(seconds: 2),
          ),
        );
      } else {
        setState(() {
          _appliedCouponCode = null;
          _discount = 0.0;
          _finalAmount = widget.cartTotal;
          _couponId = null;
          _errorMessage = result.message;
        });

        // Show error message
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result.message),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 3),
          ),
        );
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
        _errorMessage = 'Error: ${e.toString()}';
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error applying coupon: ${e.toString()}'),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Checkout'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Cart Items List (your existing cart items widget)
            
            const SizedBox(height: 16),
            
            // Coupon Input Widget
            CouponInputWidget(
              onApplyCoupon: _applyCoupon,
              appliedCouponCode: _appliedCouponCode,
              discount: _discount,
              isLoading: _isLoading,
            ),

            if (_errorMessage != null && _appliedCouponCode == null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  _errorMessage!,
                  style: const TextStyle(
                    color: Colors.red,
                    fontSize: 12,
                  ),
                ),
              ),

            const SizedBox(height: 24),

            // Price Summary
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.grey.shade100,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                children: [
                  _buildPriceRow('Subtotal', widget.cartTotal),
                  if (_discount > 0)
                    _buildPriceRow(
                      'Discount (${_appliedCouponCode})',
                      -_discount,
                      isDiscount: true,
                    ),
                  const Divider(),
                  _buildPriceRow(
                    'Total',
                    _finalAmount,
                    isTotal: true,
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Place Order Button
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  // Pass _couponId to your order creation API
                  _placeOrder();
                },
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                child: const Text(
                  'Place Order',
                  style: TextStyle(fontSize: 16),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPriceRow(String label, double amount, {bool isDiscount = false, bool isTotal = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: isTotal ? 18 : 16,
              fontWeight: isTotal ? FontWeight.bold : FontWeight.normal,
            ),
          ),
          Text(
            '${isDiscount ? '-' : ''}₹${amount.toStringAsFixed(2)}',
            style: TextStyle(
              fontSize: isTotal ? 18 : 16,
              fontWeight: isTotal ? FontWeight.bold : FontWeight.normal,
              color: isDiscount ? Colors.green : Colors.black,
            ),
          ),
        ],
      ),
    );
  }

  void _placeOrder() {
    // Your order placement logic
    // Make sure to include _couponId in the order payload if coupon is applied
    print('Placing order with coupon: $_couponId');
  }
}
```

## Step 4: Add HTTP Package

Add to your `pubspec.yaml`:

```yaml
dependencies:
  http: ^1.1.0
```

Then run:
```bash
flutter pub get
```

## Step 5: Error Handling

The backend returns different error messages for different scenarios:

1. **Invalid/Inactive Coupon**: `"Invalid or inactive coupon code"`
2. **Expired Coupon**: `"Coupon has expired"`
3. **Already Used**: `"Coupon already used by this user"`
4. **Minimum Order Amount**: `"Minimum order amount is {amount}"`
5. **Usage Limit Reached**: `"Coupon usage limit reached"`

Handle these in your UI appropriately:

```dart
String _getErrorMessage(String message) {
  if (message.contains('expired')) {
    return 'This coupon has expired';
  } else if (message.contains('already used')) {
    return 'You have already used this coupon';
  } else if (message.contains('Minimum order amount')) {
    return message; // Already formatted
  } else if (message.contains('usage limit')) {
    return 'This coupon is no longer available';
  } else {
    return 'Invalid coupon code';
  }
}
```

## Troubleshooting: 404 and `coupon/checkcheck`

**Symptom:** `DioException [bad response]: status code 404` and logs show `coupon/checkcheck`.

**Cause:** The coupon check endpoint is **not** at `coupon/check`. It is mounted at:

```text
POST /api/offer-Coupon/coupon/check
```

**Fix in your Flutter app:**

1. **baseUrl = `http://host:port`** (no `/api`):
   - Use: `$baseUrl/api/offer-Coupon/coupon/check`
   - Example: `https://n8fd2gwd-3005.inc1.devtunnels.ms/api/offer-Coupon/coupon/check`

2. **baseUrl = `http://host:port/api`** (already includes `/api`):
   - Use: `$baseUrl/offer-Coupon/coupon/check`
   - Do **not** add `coupon/check` again or you get `coupon/checkcheck`.

3. **If using Dio:** Set the path exactly as above. For example:

```dart
// Correct
final response = await dio.post(
  '$baseUrl/api/offer-Coupon/coupon/check',  // or $baseUrl/offer-Coupon/coupon/check
  data: {
    'userId': userId,
    'code': code,
    'orderAmount': orderAmount,
  },
);
```

4. **Auth:** Add `Authorization: Bearer <token>` if your API requires it (you already have a JWT in logs).

## Step 6: Integration with Order Creation

When placing an order, include the coupon code in your order payload:

```dart
final orderPayload = {
  'userId': userId,
  'items': cartItems,
  'deliveryAddress': address,
  'paymentType': paymentType,
  'couponCode': _appliedCouponCode, // Include coupon code
  // ... other order fields
};
```

The backend will validate the coupon again during order creation and apply the discount.

## Testing

1. **Test Valid Coupon:**
   - Enter a valid, active coupon code
   - Verify discount is calculated correctly
   - Check final amount is updated

2. **Test Invalid Coupon:**
   - Enter an invalid code
   - Verify error message is shown
   - Check discount is not applied

3. **Test Expired Coupon:**
   - Enter an expired coupon
   - Verify "expired" error message

4. **Test Minimum Order Amount:**
   - Enter a coupon with minOrderAmount
   - Test with amount below minimum
   - Verify error message shows minimum amount

5. **Test Remove Coupon:**
   - Apply a coupon
   - Click remove/clear
   - Verify discount is removed and total is restored

## Additional Features

### Show Available Coupons

You can also fetch and display available coupons:

```dart
Future<void> _loadAvailableCoupons() async {
  final coupons = await _couponService.getAllCoupons();
  // Display coupons in a list or bottom sheet
}
```

### Coupon List Widget

```dart
void _showAvailableCoupons() {
  showModalBottomSheet(
    context: context,
    builder: (context) {
      return FutureBuilder<List<Coupon>>(
        future: _couponService.getAllCoupons(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          
          if (!snapshot.hasData || snapshot.data!.isEmpty) {
            return const Center(child: Text('No coupons available'));
          }

          return ListView.builder(
            itemCount: snapshot.data!.length,
            itemBuilder: (context, index) {
              final coupon = snapshot.data![index];
              return ListTile(
                title: Text(coupon.code),
                subtitle: Text(coupon.getDiscountText()),
                trailing: ElevatedButton(
                  onPressed: () {
                    _applyCoupon(coupon.code);
                    Navigator.pop(context);
                  },
                  child: const Text('Apply'),
                ),
              );
            },
          );
        },
      );
    },
  );
}
```

This implementation provides a complete solution for coupon validation in your Flutter app!
