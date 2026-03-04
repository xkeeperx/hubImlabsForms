# Onboarding Form - Web Project with Monday.com Integration

Complete web project ready for production on a Linux VPS (Ubuntu) server. Includes a public landing page and a form application integrated with Monday.com.

## 📋 Table of Contents

- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Local Development](#local-development)
- [Production Deployment](#production-deployment)
- [Nginx Configuration](#nginx-configuration)
- [How to Get Monday.com Column IDs](#how-to-get-mondaycom-column-ids)
- [Project Structure](#project-structure)

---

## 🛠 Tech Stack

- **Backend:** Node.js with Express.js
- **Frontend:** HTML5 + CSS3 + Vanilla JavaScript
- **Process Manager:** PM2 for production
- **Environment Variables:** `.env` file with `dotenv`
- **Key Dependencies:** `express`, `axios`, `dotenv`, `cors`, `morgan`

---

## 📦 Prerequisites

- Node.js 18+ (LTS recommended)
- npm (included with Node.js)
- Access to a Linux VPS (Ubuntu) server for production
- Monday.com account with API access

---

## 🚀 Installation

1. **Clone the repository:**

```bash
git clone <repo-url>
cd onboarding-form
```

2. **Install dependencies:**

```bash
npm install
```

3. **Configure environment variables:**

```bash
cp .env.example .env
```

4. **Edit the `.env` file with your actual values:**

```env
PORT=3000
MONDAY_API_KEY=your_api_key_here
MONDAY_BOARD_ID=123456789
MONDAY_STATUS_COLUMN_ID=status
MONDAY_STATUS_VALUE=Completed
MONDAY_STORE_COLUMN_ID=store_number
```

---

## ⚙️ Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Port where the server will run (default: 3000) |
| `MONDAY_API_KEY` | Your Monday.com API token |
| `MONDAY_BOARD_ID` | Numeric ID of the Monday.com board |
| `MONDAY_STATUS_COLUMN_ID` | Column ID of the "Status" column |
| `MONDAY_STATUS_VALUE` | Status value after saving (e.g., "Completed") |
| `MONDAY_STORE_COLUMN_ID` | Column ID of the "Store Number" column |

### Form Field Mapping

In the [`public/js/form.js`](public/js/form.js:1) file, you need to update the `columnMapping` object with the actual column IDs from your Monday.com board:

```javascript
const columnMapping = {
    firstName: 'texto',           // Replace with actual column ID
    lastName: 'texto2',           // Replace with actual column ID
    email: 'email',               // Replace with actual column ID
    phone: 'telefono',            // Replace with actual column ID
    position: 'estado1',          // Replace with actual column ID
    storeAddress: 'texto4',       // Replace with actual column ID
    city: 'texto5',               // Replace with actual column ID
    region: 'texto6',             // Replace with actual column ID
    openDate: 'fecha',            // Replace with actual column ID
    teamSize: 'estado2',          // Replace with actual column ID
    comments: 'texto_largo'       // Replace with actual column ID
};
```

---

## 💻 Local Development

To run the server in development mode with auto-reload:

```bash
npm run dev
```

The server will be available at `http://localhost:3000`

---

## 🌐 Production Deployment

### 1. Install PM2 globally

PM2 is a process manager for Node.js that keeps your application running in production.

```bash
npm install -g pm2
```

### 2. Start the application with PM2

```bash
pm2 start server.js --name "onboarding-form"
```

### 3. Save the PM2 process list

```bash
pm2 save
```

### 4. Configure PM2 to start automatically on server restart

```bash
pm2 startup
```

This command will show you an additional command to execute. For example:

```bash
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u your_user --hp /home/your_user
```

### 5. Useful PM2 commands

```bash
# Check application status
pm2 status

# View logs in real-time
pm2 logs onboarding-form

# Restart the application
pm2 restart onboarding-form

# Stop the application
pm2 stop onboarding-form

# Remove the application from PM2
pm2 delete onboarding-form
```

---

## 🔧 Nginx Configuration (Optional but Recommended)

Nginx can act as a reverse proxy for your application, providing SSL, better performance, and security.

### 1. Install Nginx

```bash
sudo apt update
sudo apt install nginx
```

### 2. Create a configuration file for your site

```bash
sudo nano /etc/nginx/sites-available/onboarding-form
```

### 3. Add the following configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4. Enable the site

```bash
sudo ln -s /etc/nginx/sites-available/onboarding-form /etc/nginx/sites-enabled/
```

### 5. Verify Nginx configuration

```bash
sudo nginx -t
```

### 6. Restart Nginx

```bash
sudo systemctl restart nginx
```

### 7. Configure SSL with Let's Encrypt (Optional)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

---

## 🔑 How to Get Monday.com Column IDs

### Get the Board ID

1. Open your board on Monday.com
2. The Board ID is the number that appears in the URL after `/boards/`
   - Example: `https://monday.com/boards/123456789` → Board ID: `123456789`

### Get the Column IDs

#### Method 1: Using the Monday.com API

1. Go to [Monday.com Developers](https://developer.monday.com/api-reference/docs/graphql-api)
2. Use the API Playground with your API token
3. Run the following query:

```graphql
query {
  boards(ids: [YOUR_BOARD_ID]) {
    columns {
      id
      title
      type
    }
  }
}
```

4. The response will show all column IDs with their titles:

```json
{
  "data": {
    "boards": [
      {
        "columns": [
          {
            "id": "texto",
            "title": "Name",
            "type": "text"
          },
          {
            "id": "email",
            "title": "Email",
            "type": "email"
          }
        ]
      }
    ]
  }
}
```

#### Method 2: Using browser developer tools

1. Open your board on Monday.com
2. Press F12 to open developer tools
3. Go to the "Network" tab
4. Make an action on the board (like changing a cell)
5. Look for a GraphQL request in the network
6. In the response, look for the column IDs

### Get your Monday.com API Key

1. Go to monday.com and log in
2. Click on your avatar in the top left corner
3. Select "Developers"
4. In the "API tokens" section, click "Copy" to copy your token
5. Paste this token in your `.env` file as `MONDAY_API_KEY`

---

## 📁 Project Structure

```
/onboarding-form
│
├── server.js                  # Main Express server
├── .env                       # Environment variables (DO NOT commit to git)
├── .env.example               # Example variables without sensitive values
├── .gitignore                 # Files ignored by git
├── package.json               # Project dependencies
├── README.md                  # This file
│
├── /public                    # Static files served by Express
│   ├── index.html             # Landing page
│   ├── form.html              # Form page
│   ├── /css
│   │   ├── styles.css         # Global styles and landing
│   │   └── form.css           # Form styles
│   └── /js
│       ├── main.js            # Landing page JS
│       └── form.js            # Form logic + API calls
│
└── /routes
    └── monday.js              # API routes for Monday.com
```

---

## 🔒 Security

- **Never** expose the Monday.com API Key in the frontend
- The `.env` file is included in `.gitignore` to prevent it from being committed to git
- Make sure to configure HTTPS in production using Nginx with Let's Encrypt
- Keep your dependencies updated: `npm audit fix`

---

## 📝 Additional Notes

### Form Flow

1. **Store Search:** User enters the store number
2. **Validation:** Backend searches Monday.com for a store with that number and "pending" status
3. **Selection:** If found, user confirms the selection
4. **Form:** Complete form is displayed to fill out
5. **Saving:** Data is sent to backend which updates the item in Monday.com and changes the status

### Customization

- Colors and styles can be easily customized by modifying CSS variables in [`public/css/styles.css`](public/css/styles.css:1) and [`public/css/form.css`](public/css/form.css:1)
- Service cards content can be edited in [`public/index.html`](public/index.html:1)
- Form fields can be modified in [`public/form.html`](public/form.html:1)

---

## 📄 License

ISC

---

## 🤝 Support

For issues or questions, please open an issue in the repository or contact the development team.
