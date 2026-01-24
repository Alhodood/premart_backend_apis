# Flutter WebSocket Local Notifications Implementation Guide

This guide explains how to connect your Flutter app to the backend WebSocket server and display local notifications when messages are received.

## Prerequisites

Add these dependencies to your `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  socket_io_client: ^2.0.3+1  # For WebSocket connection
  flutter_local_notifications: ^17.0.0  # For local notifications
  permission_handler: ^11.0.0  # For notification permissions
  shared_preferences: ^2.2.0  # For storing user data
```

## Step 1: Setup Local Notifications Service

Create `lib/services/notification_service.dart`:

```dart
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:permission_handler/permission_handler.dart';

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FlutterLocalNotificationsPlugin _notifications = 
      FlutterLocalNotificationsPlugin();
  
  bool _initialized = false;

  /// Initialize notification service
  Future<void> initialize() async {
    if (_initialized) return;

    // Request permissions (Android 13+)
    await _requestPermissions();

    // Android initialization settings
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    
    // iOS initialization settings
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _notifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: _onNotificationTapped,
    );

    _initialized = true;
  }

  /// Request notification permissions
  Future<void> _requestPermissions() async {
    if (await Permission.notification.isDenied) {
      await Permission.notification.request();
    }
  }

  /// Show a local notification
  Future<void> showNotification({
    required int id,
    required String title,
    required String body,
    String? payload,
  }) async {
    if (!_initialized) await initialize();

    const androidDetails = AndroidNotificationDetails(
      'premart_channel',
      'Premart Notifications',
      channelDescription: 'Notifications for orders, updates, and promotions',
      importance: Importance.high,
      priority: Priority.high,
      showWhen: true,
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    const notificationDetails = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    await _notifications.show(
      id,
      title,
      body,
      notificationDetails,
      payload: payload,
    );
  }

  /// Handle notification tap
  void _onNotificationTapped(NotificationResponse response) {
    // Handle navigation based on payload
    if (response.payload != null) {
      // Navigate to specific screen based on payload
      // Example: Navigator.pushNamed(context, '/order/${response.payload}');
    }
  }

  /// Cancel a notification
  Future<void> cancelNotification(int id) async {
    await _notifications.cancel(id);
  }

  /// Cancel all notifications
  Future<void> cancelAllNotifications() async {
    await _notifications.cancelAll();
  }
}
```

## Step 2: Setup WebSocket Service

Create `lib/services/websocket_service.dart`:

```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:shared_preferences/shared_preferences.dart';
import 'notification_service.dart';
import 'dart:convert';

class WebSocketService {
  static final WebSocketService _instance = WebSocketService._internal();
  factory WebSocketService() => _instance;
  WebSocketService._internal();

  IO.Socket? _socket;
  bool _isConnected = false;
  String? _userId;
  final NotificationService _notificationService = NotificationService();

  /// Connect to WebSocket server
  Future<void> connect({required String baseUrl, required String userId}) async {
    if (_isConnected && _userId == userId) {
      print('Already connected with userId: $userId');
      return;
    }

    // Disconnect existing connection if userId changed
    if (_socket != null && _userId != userId) {
      disconnect();
    }

    _userId = userId;

    try {
      // Initialize notification service
      await _notificationService.initialize();

      // Create socket connection with userId in query
      _socket = IO.io(
        baseUrl,
        IO.OptionBuilder()
            .setTransports(['websocket'])
            .setQuery({'userId': userId})
            .enableAutoConnect()
            .build(),
      );

      _setupEventListeners();
      
      _socket!.connect();
      _isConnected = true;
      
      print('✅ WebSocket connected for user: $userId');
    } catch (e) {
      print('❌ WebSocket connection error: $e');
      _isConnected = false;
    }
  }

  /// Setup event listeners
  void _setupEventListeners() {
    if (_socket == null) return;

    // Connection events
    _socket!.onConnect((_) {
      print('✅ Socket connected');
      _isConnected = true;
    });

    _socket!.onDisconnect((_) {
      print('❌ Socket disconnected');
      _isConnected = false;
    });

    _socket!.onConnectError((error) {
      print('❌ Connection error: $error');
      _isConnected = false;
    });

    // Order status updates
    _socket!.on('orderStatusUpdated', (data) {
      print('📦 Order status updated: $data');
      _handleOrderStatusUpdate(data);
    });

    // New notifications
    _socket!.on('new_notification', (data) {
      print('🔔 New notification: $data');
      _handleNewNotification(data);
    });

    // Order assigned (for delivery boys, but can be used for customers too)
    _socket!.on('new_order_assigned', (data) {
      print('📋 New order assigned: $data');
      _handleNewOrderAssigned(data);
    });

    // Custom event for customer-specific notifications
    _socket!.on('customer_notification', (data) {
      print('👤 Customer notification: $data');
      _handleCustomerNotification(data);
    });
  }

  /// Handle order status update
  void _handleOrderStatusUpdate(dynamic data) {
    try {
      final Map<String, dynamic> orderData = data is String 
          ? jsonDecode(data) 
          : data as Map<String, dynamic>;

      final orderId = orderData['orderId'] ?? 'Unknown';
      final status = orderData['newStatus'] ?? 'Updated';
      final shopId = orderData['shopId'] ?? '';

      _notificationService.showNotification(
        id: DateTime.now().millisecondsSinceEpoch % 100000,
        title: 'Order Status Updated',
        body: 'Your order #$orderId status changed to $status',
        payload: jsonEncode({'type': 'order', 'orderId': orderId, 'shopId': shopId}),
      );
    } catch (e) {
      print('Error handling order status update: $e');
    }
  }

  /// Handle new notification
  void _handleNewNotification(dynamic data) {
    try {
      final Map<String, dynamic> notificationData = data is String 
          ? jsonDecode(data) 
          : data as Map<String, dynamic>;

      final title = notificationData['title'] ?? 'New Notification';
      final message = notificationData['message'] ?? notificationData['content'] ?? '';
      final notificationId = notificationData['_id'] ?? notificationData['id'] ?? '';

      _notificationService.showNotification(
        id: DateTime.now().millisecondsSinceEpoch % 100000,
        title: title,
        body: message,
        payload: jsonEncode({
          'type': 'notification',
          'notificationId': notificationId,
        }),
      );
    } catch (e) {
      print('Error handling new notification: $e');
    }
  }

  /// Handle new order assigned
  void _handleNewOrderAssigned(dynamic data) {
    try {
      final Map<String, dynamic> orderData = data is String 
          ? jsonDecode(data) 
          : data as Map<String, dynamic>;

      final message = orderData['message'] ?? 'You have a new order';
      final orderId = orderData['orderId'] ?? '';

      _notificationService.showNotification(
        id: DateTime.now().millisecondsSinceEpoch % 100000,
        title: 'New Order',
        body: message,
        payload: jsonEncode({'type': 'order', 'orderId': orderId}),
      );
    } catch (e) {
      print('Error handling new order assigned: $e');
    }
  }

  /// Handle customer-specific notification
  void _handleCustomerNotification(dynamic data) {
    try {
      final Map<String, dynamic> notificationData = data is String 
          ? jsonDecode(data) 
          : data as Map<String, dynamic>;

      final title = notificationData['title'] ?? 'Notification';
      final message = notificationData['message'] ?? notificationData['content'] ?? '';
      final type = notificationData['type'] ?? 'info';
      final notificationId = notificationData['_id'] ?? '';

      _notificationService.showNotification(
        id: DateTime.now().millisecondsSinceEpoch % 100000,
        title: title,
        body: message,
        payload: jsonEncode({
          'type': type,
          'notificationId': notificationId,
        }),
      );
    } catch (e) {
      print('Error handling customer notification: $e');
    }
  }

  /// Disconnect from WebSocket
  void disconnect() {
    if (_socket != null) {
      _socket!.disconnect();
      _socket!.dispose();
      _socket = null;
      _isConnected = false;
      print('🔌 WebSocket disconnected');
    }
  }

  /// Check if connected
  bool get isConnected => _isConnected;

  /// Get current socket instance
  IO.Socket? get socket => _socket;
}
```

## Step 3: Initialize in Your App

In your `main.dart` or app initialization:

```dart
import 'package:flutter/material.dart';
import 'services/websocket_service.dart';
import 'services/notification_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize notification service
  await NotificationService().initialize();
  
  runApp(MyApp());
}

class MyApp extends StatefulWidget {
  @override
  _MyAppState createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  final WebSocketService _wsService = WebSocketService();

  @override
  void initState() {
    super.initState();
    _initializeWebSocket();
  }

  Future<void> _initializeWebSocket() async {
    // Get userId from SharedPreferences or your auth service
    final prefs = await SharedPreferences.getInstance();
    final userId = prefs.getString('userId');
    
    if (userId != null) {
      // Replace with your backend URL
      const baseUrl = 'http://your-backend-url:PORT'; // e.g., 'http://localhost:3000'
      
      await _wsService.connect(
        baseUrl: baseUrl,
        userId: userId,
      );
    }
  }

  @override
  void dispose() {
    _wsService.disconnect();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Premart',
      home: HomeScreen(),
    );
  }
}
```

## Step 4: Android Configuration

Add to `android/app/src/main/AndroidManifest.xml`:

```xml
<manifest>
  <uses-permission android:name="android.permission.INTERNET"/>
  <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
  
  <application>
    <!-- Your existing application config -->
  </application>
</manifest>
```

Create notification channel in `android/app/src/main/kotlin/.../MainActivity.kt`:

```kotlin
import android.os.Build
import androidx.annotation.RequiresApi
import io.flutter.embedding.android.FlutterActivity

class MainActivity: FlutterActivity() {
    @RequiresApi(Build.VERSION_CODES.O)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Create notification channel
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "premart_channel",
                "Premart Notifications",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for orders, updates, and promotions"
            }
            
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }
}
```

## Step 5: iOS Configuration

Add to `ios/Runner/Info.plist`:

```xml
<key>UIBackgroundModes</key>
<array>
    <string>remote-notification</string>
</array>
```

## Step 6: Usage in Your App

### Connect when user logs in:

```dart
// After successful login
final userId = user.id; // Get from your auth response
await WebSocketService().connect(
  baseUrl: 'http://your-backend-url:PORT',
  userId: userId,
);
```

### Disconnect when user logs out:

```dart
WebSocketService().disconnect();
```

### Check connection status:

```dart
if (WebSocketService().isConnected) {
  print('Connected to WebSocket');
}
```

## Step 7: Handle Notification Taps

Update your navigation to handle notification payloads:

```dart
class NotificationHandler {
  static void handleNotificationTap(String? payload, BuildContext context) {
    if (payload == null) return;
    
    try {
      final data = jsonDecode(payload);
      final type = data['type'];
      
      switch (type) {
        case 'order':
          Navigator.pushNamed(
            context,
            '/order-details',
            arguments: data['orderId'],
          );
          break;
        case 'notification':
          Navigator.pushNamed(
            context,
            '/notifications',
          );
          break;
        default:
          break;
      }
    } catch (e) {
      print('Error handling notification tap: $e');
    }
  }
}
```

## Backend Integration

The backend should emit notifications to customers like this:

```javascript
// In your notification controller or order controller
const io = require('../sockets/socket').getIO();

// Emit to specific customer
io.to(customerId.toString()).emit('customer_notification', {
  title: 'Order Confirmed',
  message: 'Your order has been confirmed',
  type: 'order',
  _id: notificationId
});

// Or emit order status updates
io.to(customerId.toString()).emit('orderStatusUpdated', {
  orderId: order._id.toString(),
  newStatus: order.status,
  shopId: order.shopId.toString()
});
```

## Testing

1. **Test WebSocket Connection:**
   - Check console logs for connection status
   - Verify userId is sent in query parameters

2. **Test Notifications:**
   - Send a test notification from backend
   - Verify notification appears on device
   - Test notification tap navigation

3. **Test Permissions:**
   - Request notification permissions on first launch
   - Handle permission denial gracefully

## Troubleshooting

1. **Notifications not showing:**
   - Check notification permissions
   - Verify notification channel is created (Android)
   - Check console for errors

2. **WebSocket not connecting:**
   - Verify backend URL is correct
   - Check CORS settings on backend
   - Ensure userId is being sent in query

3. **Notifications not received:**
   - Verify user is in correct room on backend
   - Check event names match between backend and Flutter
   - Ensure socket is connected before emitting

## Additional Features

### Background Notifications

For notifications when app is in background, you may need to use Firebase Cloud Messaging (FCM) in addition to WebSocket.

### Notification Badge Count

Update badge count when notifications are received:

```dart
await _notifications.show(
  id,
  title,
  body,
  notificationDetails,
  payload: payload,
);

// Update badge (iOS)
await _notifications.resolvePlatformSpecificImplementation<
    IOSFlutterLocalNotificationsPlugin>()?.requestPermissions();
```

This implementation provides a complete solution for WebSocket-based local notifications in Flutter for your Premart customer app.
