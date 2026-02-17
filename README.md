# PreMart_Back-End
Nodejs V-

## Customer mobile app – all notifications (push + in-app)

To show **all notifications** for a customer (push notifications, order updates, promos, admin broadcasts), use the **user-notifications** API. Every notification sent via the backend (FCM push + in-app) is stored in `UserNotification` and returned by these endpoints.

| Action | Method | Endpoint |
|--------|--------|----------|
| Get all notifications | `GET` | `/api/user-notifications/:userId` |
| Get unread only | `GET` | `/api/user-notifications/:userId?unreadOnly=true` |
| Pagination | `GET` | `/api/user-notifications/:userId?page=1&limit=20` |
| Mark one as read | `PATCH` | `/api/user-notifications/:notificationId/read/:userId` |
| Mark all as read | `PATCH` | `/api/user-notifications/:userId/read-all` |

**Response (list):** each item has `_id`, `userId`, `title`, `body`, `type` (`order`, `order_status`, `promo`, `info`, `alert`), `data` (e.g. `orderId`, `route`, `shopId`), `read`, `createdAt`.