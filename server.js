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

// Routes for SPA (Single Page Application) - redirect everything to index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/form.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'form.html'));
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
  console.log(`🔌 API endpoints available at: http://localhost:${PORT}/api/monday`);
  console.log('='.repeat(50));
});

module.exports = app;
