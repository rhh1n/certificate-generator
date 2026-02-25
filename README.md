# Online Certificate Generation & Verification System

Production-ready full-stack web application for generating certificates and verifying authenticity using Certificate ID and QR code.

## Features

- Admin authentication with session-based access control
- Protected admin dashboard
- Certificate generation with UUID-based unique certificate ID
- MongoDB persistence with schema validations and uniqueness
- PDF certificate generation using PDFKit
- Embedded QR code for instant verification link
- Public verification by certificate ID or QR image upload
- Verification status UI (Valid/Invalid)
- Certificate preview before PDF download
- Search history on verification page (localStorage)
- Responsive modern UI with smooth animations and loading states

## Tech Stack

- Frontend: HTML, CSS, Vanilla JavaScript, EJS templates
- Backend: Node.js, Express.js
- Database: MongoDB Atlas + Mongoose
- Utilities: UUID, QRCode, PDFKit, express-validator, helmet

## Project Structure

```text
/public
  /css/style.css
  /js/main.js
  /js/dashboard.js
  /js/verify.js
/routes
  auth.js
  certificates.js
  public.js
/models
  Certificate.js
/views
  /partials
    head.ejs
    foot.ejs
    alert.ejs
  home.ejs
  login.ejs
  dashboard.ejs
  certificate-preview.ejs
  verify.ejs
  404.ejs
  error.ejs
/middleware
  auth.js
server.js
package.json
.env.example
README.md
docs/prompt-usage-template.md
```

## Environment Variables

Create `.env` from `.env.example`:

```env
PORT=5000
MONGODB_URI=<your_mongodb_atlas_connection_string>
SESSION_SECRET=<long_random_secret>
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=<bcrypt_hash>
BASE_URL=http://localhost:5000
NODE_ENV=development
```

### Generate bcrypt hash

```bash
node -e "console.log(require('bcryptjs').hashSync('YourStrongPassword123!', 10))"
```

Use output as `ADMIN_PASSWORD_HASH`.

## Local Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure `.env`
3. Start development server:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:5000`

## Architecture Overview

- `server.js` bootstraps Express, security middleware, MongoDB connection, sessions, routes, and error handlers.
- `routes/auth.js` handles admin login/logout.
- `routes/certificates.js` handles protected certificate creation, preview, and PDF generation.
- `routes/public.js` handles public verification endpoints.
- `models/Certificate.js` defines certificate schema and uniqueness index.
- `middleware/auth.js` protects admin routes.

## Render Deployment Guide

1. Push repository to GitHub.
2. In Render, click **New +** -> **Blueprint** and select this repo (uses `render.yaml`).
3. Configure:
   - Build command: `npm install`
   - Start command: `npm start`
4. Add environment variables in Render dashboard:
   - `PORT` (Render sets automatically, optional)
   - `MONGODB_URI`
   - `SESSION_SECRET`
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD_HASH`
   - `BASE_URL` (set to your Render service URL, e.g. `https://your-app.onrender.com`)
   - `NODE_ENV=production`
5. Deploy and test:
   - `/admin/login`
   - `/verify`

### Security Note

- If credentials were shared publicly during setup, rotate MongoDB password and update `MONGODB_URI`.

## MongoDB Atlas Setup

1. Create a MongoDB Atlas cluster.
2. Create database user and password.
3. Add IP access (Render outbound IP or `0.0.0.0/0` with caution).
4. Get connection string and set `MONGODB_URI`.
5. Ensure database user has read/write access.

## Production Notes

- Uses `helmet`, session cookies (`httpOnly`, `sameSite`, `secure` in production), and server-side validation.
- Certificate IDs are UUID-derived and collision-checked.
- Input validation and sanitization are applied before persistence.
- Generic error pages prevent sensitive stack trace exposure.

## API / Route Summary

- `GET /` home
- `GET /verify` verification page
- `POST /verify` manual verification
- `GET /verify/:certificateId` QR/manual direct verification
- `GET /admin/login` admin login page
- `POST /admin/login` admin login submit
- `GET /admin/logout` admin logout
- `GET /admin/dashboard` protected dashboard
- `POST /admin/certificates` create certificate
- `GET /admin/certificates/:certificateId/preview` preview certificate
- `GET /admin/certificates/:certificateId/download` download certificate PDF

## Competition Submission Assets

Use `docs/prompt-usage-template.md` to document your prompt strategy and build workflow.
