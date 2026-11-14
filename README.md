# Besqaa Backend

Node + Express + MongoDB (Atlas) API powering the Besqaa mobile app and admin panel.
Uploaded images are resized with sharp and stored in MongoDB (`/api/images/:key`).

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
# Image URLs: public origin of this API (Render sets RENDER_EXTERNAL_URL itself):
PUBLIC_URL=
# Email (OTP + order-confirmed) — MAIL_PROVIDER = twilio | sendgrid | resend | brevo | ses,
# or empty for SMTP; nothing configured = logged to console. Render's free tier blocks SMTP.
# twilio reuses TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN below.
MAIL_PROVIDER= / SENDGRID_API_KEY= / RESEND_API_KEY= / BREVO_API_KEY= / MAIL_FROM=
SMTP_HOST= / SMTP_PORT= / SMTP_USER= / SMTP_PASS=
# SMS OTP — SMS_PROVIDER = twilio | sns; empty = logged to console
SMS_PROVIDER= / TWILIO_ACCOUNT_SID= / TWILIO_AUTH_TOKEN= / TWILIO_FROM=
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
