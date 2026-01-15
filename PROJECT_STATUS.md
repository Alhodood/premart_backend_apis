📘 Project Status & API Usage Guide

Living document for internal tracking. Updated on every commit. Owner: Ashutosh

⸻

🎯 Purpose

This document tracks real engineering progress, current system state, and how to use APIs.
Irshad (and any stakeholder) should read this instead of Slack pings.

If it is not updated, the work is not considered complete.

⸻

📦 Project: PreMart Backend APIs
	•	Stack: Node.js + Express + MongoDB + JWT + RBAC
	•	Architecture: Modular controllers, middleware-based authorization
	•	Status: Auth Layer Completed & Verified

⸻

✅ Completed Milestones

1. Authentication Architecture
	•	JWT based authentication
	•	Centralized RBAC system
	•	Role-model mapping via roleModelMap
	•	Unified /register, /login, /verify-otp endpoints

Status: COMPLETE & TESTED

⸻

2. Roles Implemented

Role	Login Type	Status
CUSTOMER	Email + Password	✅ Working
SUPER_ADMIN	Email + Password	✅ Working
SHOP_ADMIN	Email + Password	✅ Working
AGENCY	Email + Password	✅ Working
DELIVERY_BOY	OTP (Phone + Code)	✅ Working

Self-registration is blocked for privileged roles (Admin, ShopAdmin, Agency).

⸻

3. OTP Flow
	•	Endpoint: POST /api/auth/verify-otp
	•	DEV OTP: 123456
	•	Auto user creation if number not found

Status: COMPLETE

⸻

4. RBAC Enforcement

Middleware chain applied to routes:

protect → authorize(role) → mustBeOwner(param)

Example rules:
	•	Customer can only access own profile
	•	Admin can access admin-only routes
	•	Ownership enforced via route params

Status: STRICTLY ENFORCED & VERIFIED

⸻

🔐 How to Use Auth APIs

Register (Customer only)

POST /api/auth/register

{
  "role": "CUSTOMER",
  "email": "user@test.com",
  "password": "123456",
  "name": "Test User"
}


⸻

Login (All email/password roles)

POST /api/auth/login

{
  "role": "CUSTOMER",
  "email": "user@test.com",
  "password": "123456"
}

Response returns JWT token.

⸻

OTP Login (Delivery Boy)

POST /api/auth/verify-otp

{
  "role": "DELIVERY_BOY",
  "phone": "9999999999",
  "code": "123456"
}


⸻

Using Protected APIs

All protected APIs require header:

Authorization: Bearer <JWT_TOKEN>

Ownership rules apply where userId, agencyId, shopId are used.

⸻

🧪 Verified Test Coverage (Postman)

Test	Result
Customer register/login	✅ Pass
Delivery OTP login	✅ Pass
Token protected routes	✅ Pass
Cross-user access blocked	✅ Pass
Role-based access blocked	✅ Pass


⸻

📌 Current Phase

Auth & Security Layer Complete
Moving into: Business Modules (Orders, Products, Payments, Reports)


🧭 Next Planned Modules
	1.	Orders module (shop-based + delivery flow)
	2.	Product & stock module
	3.	Payment & payout flow
	4.	Reporting & analytics
	5.	Notification system

⸻


Last updated: (update this date on every commit)