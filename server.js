require('dotenv').config();
const express = require('express');
const path = require('path');
const morgan = require('morgan');
const cors = require('cors');

// Import routes
const mondayRoutes = require('./routes/monday');

const app = express();

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api/monday', mondayRoutes);

// Test endpoint for Google Sheets — sends a sample row to verify connectivity
app.get('/api/test-google-sheets', async (req, res) => {
  try {
    const { appendToGoogleSheet } = require('./routes/googleSheets');
    const result = await appendToGoogleSheet({
      storeId: 'TEST-001',
      storeName: 'Verification Store',
      accountState: 'TX',
      storeOwner: 'Test Owner',
      adsAddress: '1 Test Ave',
      mailboxColor: 'Red',
      manager: 'Test Manager',
      timeSavingKiosk: 'Yes',
      productsNotOffered: 'None',
      generalFocus: 'Connectivity Test'
    });
    res.json(result);
  } catch (error) {
    console.error('Error in Google Sheets test endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing Google Sheets',
      error: error.message
    });
  }
});

// Routes for SPA (Single Page Application) - redirect everything to index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/form.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'form.html'));
});

// OAuth callback endpoint
app.get('/oauth2callback', (req, res) => {
  res.send('OAuth callback would be handled here');
});

// 404 error handling
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handling
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📁 Static files served from: ${path.join(__dirname, 'public')}`);
  console.log(`🔌 API Monday endpoints: http://localhost:${PORT}/api/monday`);
  console.log(`📊 Google Sheets test:   http://localhost:${PORT}/api/test-google-sheets`);
  console.log('='.repeat(50));
});

module.exports = app;