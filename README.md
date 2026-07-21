# Besqaa Backend

Node + Express + MongoDB (Atlas) + AWS S3 API powering the Besqaa mobile app and admin panel.

Related repos: [besqaa_app](https://github.com/Ravilovecode/besqaa_app) (Expo mobile app) · besqaa_admin (React admin panel).

## Setup

```bash
npm install
cp .env.example .env      # fill in the values below
npm run seed              # bootstrap admin + demo catalog
npm run dev               # http://localhost:5000
```

**Required `.env` values:**

```
MONGO_URI=<your MongoDB / Atlas connection string, db name: besqaa>
JWT_SECRET=<long random string>
SEED_ADMIN_EMAIL=admin@besqaa.in
SEED_ADMIN_PASSWORD=Admin@12345
# S3 (product images, avatars, payment proofs):
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET=besqaa-product-images
# Email (order-confirmed notifications) — empty = logged to console:
SMTP_HOST= / SMTP_PORT= / SMTP_USER= / SMTP_PASS=
```

## Test

```bash
node smoke-test.mjs   # end-to-end suite on an in-memory MongoDB (no setup needed)
```

## API overview

| Area | Routes |
|------|--------|
| Buyer auth | `POST /api/auth/register` → OTP → `POST /api/auth/verify-otp` (email **or** phone code), `POST /api/auth/login` |
| Profile | `GET/PUT /api/auth/me`, `POST /api/auth/me/avatar`, `PUT /api/auth/me/buyback` |
| Admin | `POST /api/admin/auth/login`, `GET/PUT /api/admin/orders`, `GET/PUT /api/admin/queries` |
| Catalog | `GET/POST/PUT/DELETE /api/categories`, `/api/products` (writes admin-only) |
| Uploads | `POST /api/upload` (admin), `POST /api/upload/payment-proof` (buyer) |
| Cart/Orders | `GET/POST/PUT/DELETE /api/cart/*`, `POST/GET /api/orders` (online orders require a payment screenshot) |
| Besqaa Query | `POST /api/queries` |
