# Onboarding Form - Integration with Monday.com & Google Sheets

Complete web project for lead onboarding, featuring a landing page and a multi-step form integrated with **Monday.com** (item creation/updates) and **Google Sheets** (data persistence).

---

## 📋 Table of Contents

- [🚀 Quick Start](#-quick-start)
- [🛠 Tech Stack](#-tech-stack)
- [⚙️ Configuration (.env)](#️-configuration-env)
- [📊 Google Sheets Integration](#-google-sheets-integration)
- [🔑 Monday.com Integration](#-mondaycom-integration)
- [🌐 Production Deployment](#-production-deployment)
- [📁 Project Structure](#-project-structure)

---

## 🚀 Quick Start

1. **Clone & Install**
   ```bash
   git clone <repo-url>
   cd onboarding-form
   npm install
   ```

2. **Environment Setup**
   Copy `.env.example` to `.env` and fill in your credentials.
   ```bash
   cp .env.example .env
   ```

3. **Development Mode**
   ```bash
   npm run dev
   ```
   Server runs at `http://localhost:3000`

---

## 🛠 Tech Stack

- **Backend:** Node.js (v20+ or v25 (Experimental) compatible) with Express.js.
- **APIs:** 
  - `googleapis`: Integration with Google Sheets API v4.
  - `monday-sdk-js`: Monday.com GraphQL API.
- **Frontend:** HTML5, CSS3, Vanilla JavaScript (No heavy frameworks).
- **Process Manager:** PM2 (for production uptime).
- **Logging:** Morgan & custom console logging for debugging.

---

## ⚙️ Configuration (.env)

| Variable | Description |
|----------|-------------|
| `PORT` | Port for the Express server (default: 3000). |
| `MONDAY_API_KEY` | Monday.com personal API token. |
| `MONDAY_BOARD_ID` | The ID of the board to interact with. |
| `GOOGLE_SPREADSHEET_ID` | The ID found in your Google Sheet URL. |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | The email address of your Google Cloud service account. |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | **Single-line** Base64 encoded JSON key from Google Cloud. |

> [!IMPORTANT]
> **Node.js 25+ / OpenSSL 3 Compatibility:** The `GOOGLE_SERVICE_ACCOUNT_KEY` must be pasted as a **single continuous line** in `.env`. The application handles converting escaped `\n` to real newlines automatically.

---

## 📊 Google Sheets Integration

### 1. Setup Service Account
1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project and enable the **Google Sheets API**.
3. Create a **Service Account** under "IAM & Admin".
4. Create a new **JSON Key** for the service account and download it.
5. Base64 encode the JSON file content and paste it into `GOOGLE_SERVICE_ACCOUNT_KEY` in `.env`.

### 2. Share the Spreadsheet
You **MUST** share your Google Sheet with the service account email (e.g., `account@project.iam.gserviceaccount.com`) as an **Editor**. Otherwise, you will receive a "Caller does not have permission" error.

### 3. Column Mapping
Configure column letters in `.env`:
- `GOOGLE_SHEET_STORENAME_COLUMN=A`
- `GOOGLE_SHEET_TIMESAVINGKIOSK_COLUMN=AC` (Supports multi-letter columns)

### 4. Testing
Use the built-in diagnostic endpoint:
`GET http://localhost:3000/api/test-google-sheets`

---

## 🔑 Monday.com Integration

### Column IDs
Monday.com uses internal IDs (e.g., `color_m123`) rather than titles. 
- **Method 1:** Use the Monday Board Developers tool (API Playground).
- **Method 2:** Turn on "Developer Mode" in Monday Labs to see IDs in the column settings.

Update the mapping in `public/js/form.js` to match your board structure.

---

## 🌐 Production Deployment

### 1. Requirements
- A Linux VPS (Ubuntu recommended).
- Nginx installed.
- PM2 (Process Manager).

### 2. Steps
1. **Prepare Server**
   ```bash
   sudo apt update && sudo apt install nginx
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs
   ```

2. **Setup Global PM2**
   ```bash
   sudo npm install -g pm2
   ```

3. **Deploy Code**
   Upload your files, run `npm install`, and configure your `.env`.

4. **Start Application**
   ```bash
   pm2 start server.js --name "onboarding-form"
   pm2 save
   pm2 startup
   ```

5. **Nginx Reverse Proxy**
   Configure Nginx to point to `localhost:3000`. This allows you to use your domain and SSL (via Certbot).

---

## 📁 Project Structure

```text
/onboarding-form
├── server.js           # Main Express server entry point
├── routes/
│   ├── monday.js       # Monday.com API logic
│   └── googleSheets.js # Google Sheets logic & Auth fixes
├── public/             # Static Assets
│   ├── form.html       # The 7-step onboarding form
│   ├── index.html      # Landing page
│   └── js/form.js      # Frontend form handling
└── .env                # Configuration (Sensitive)
```

---

## 📄 License

ISC - © 2026 Imlabs Metrics.
