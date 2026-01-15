PROJECT STATUS & API USAGE GUIDE
Living document for internal tracking
Updated on every commit
Owner: Ashutosh

⸻

PURPOSE

This document tracks real engineering progress, current system state, and how to use APIs.
Irshad (and any stakeholder) should read this instead of Slack or WhatsApp.

Rule:
If this file is not updated, the work is NOT considered complete.

⸻

PROJECT: PreMart Backend APIs

Stack: Node.js + Express + MongoDB + JWT
Auth: JWT + RBAC middleware
Architecture: Modular routes, controllers, models
Design goal: Scalable multi-vendor marketplace backend
Current state: Auth + Product Architecture stabilized

⸻

COMPLETED MILESTONES
	1.	Authentication Architecture

	•	Unified login/register across all roles
	•	Central RBAC implementation
	•	roleModelMap abstraction for multi-model auth
	•	JWT based protection
	•	Ownership enforced via middleware

Status: COMPLETE & TESTED

⸻

	2.	Roles Implemented

CUSTOMER – Email + Password – Working
SUPER_ADMIN – Email + Password – Working
SHOP_ADMIN – Email + Password – Working
AGENCY – Email + Password – Working
DELIVERY_BOY – OTP (Phone + Code) – Working

Self-registration is blocked for privileged roles.

⸻

	3.	OTP Flow

	•	Endpoint: POST /api/auth/verify-otp
	•	DEV OTP: 123456
	•	Auto user creation if number not found

Status: COMPLETE

⸻

	4.	RBAC Enforcement

Middleware chain enforced:
protect → authorize(role) → mustBeOwner(param)

Rules enforced:
	•	Customer can only access own data
	•	Admin only accesses admin routes
	•	Ownership verified using route params

Status: STRICTLY ENFORCED & VERIFIED

⸻

	5.	Product Architecture Refactor (Major Upgrade)

Old problem:
	•	Product duplicated per shop
	•	Difficult pricing logic
	•	Hard to scale orders, stock, analytics

New architecture implemented:

A) PartsCatalog (Global Master Product)
Represents universal product master (one entry globally)

Fields:
	•	partNumber
	•	partName
	•	description
	•	brand (ObjectId → Brand)
	•	model (ObjectId → Model)
	•	category (ObjectId → Category)
	•	yearFrom / yearTo
	•	engineCode
	•	transmission
	•	images[]

APIs:
POST /api/catalog → Create catalog part
GET /api/catalog → List all parts
GET /api/catalog/:id → Get by ID
GET /api/catalog/search/query → Search with filters

⸻

B) ShopProduct (Marketplace Layer)
Represents which shop sells which part.

Fields:
	•	shopId
	•	part (ObjectId → PartsCatalog)
	•	price
	•	discountedPrice
	•	stock
	•	isAvailable (used for active/inactive instead of delete)

APIs:
POST /api/shop-product/:shopId
GET /api/shop-product/:shopId
PATCH /api/shop-product/:id
DELETE /api/shop-product/:id → sets isAvailable = false (soft delete)

Hard delete removed. Soft delete enforced across system.

⸻

Why this architecture matters

This now supports:
	•	Multi-vendor marketplace
	•	Shop-level pricing
	•	Stock control
	•	Clean order references
	•	Proper reporting
	•	Long-term scalability

Status: COMPLETE & VERIFIED in Postman

⸻

HOW TO USE AUTH APIS

Register (Customer only)
POST /api/auth/register

{
“role”: “CUSTOMER”,
“email”: “user@test.com”,
“password”: “123456”,
“name”: “Test User”
}

⸻

Login (All email/password roles)
POST /api/auth/login

{
“role”: “CUSTOMER”,
“email”: “user@test.com”,
“password”: “123456”
}

Returns JWT token.

⸻

OTP Login (Delivery Boy)
POST /api/auth/verify-otp

{
“role”: “DELIVERY_BOY”,
“phone”: “9999999999”,
“code”: “123456”
}

⸻

Protected APIs
All protected APIs require header:

Authorization: Bearer <JWT_TOKEN>

Ownership rules apply when userId, shopId, agencyId are used.

⸻

VERIFIED TEST COVERAGE (POSTMAN)

Customer register/login – Pass
Delivery OTP login – Pass
JWT protection – Pass
RBAC blocking – Pass
Ownership enforcement – Pass
Create catalog product – Pass
Assign product to shop – Pass
Fetch shop products – Pass
Soft delete product – Pass

⸻

CURRENT PHASE

Auth Layer – Complete
Product Architecture – Complete

Now entering: Core Business Flow

⸻

NEXT MODULES (EXECUTION ORDER)
	1.	Orders refactor using ShopProduct
	2.	Cart linked to ShopProduct
	3.	Delivery flow enforcement
	4.	Payment & payout correctness
	5.	Reporting & analytics
	6.	Notification workflows

⸻

Last updated: 15 Jan 2026

⸻

Now you can commit with:

If only doc added:
docs: add project status and API usage guide

If product refactor included:
feat(product): refactor to catalog + shop-product architecture

If both together:
feat: stabilize auth + implement scalable product architecture