const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { requestValidator } = require('./middleware/validation');
const latexRoutes = require('./routes/latex');
const templateRoutes = require('./routes/templates');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiting for processing endpoints
const processingLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // limit each IP to 20 processing requests per 5 minutes
  message: {
    error: 'Too many processing requests, please try again later.',
    retryAfter: '5 minutes'
  }
});

// Apply rate limiting
app.use(limiter);

// Middleware
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request validation middleware
app.use(requestValidator);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API routes
app.use('/api/v1', processingLimiter);
app.use('/api/v1/latex', latexRoutes);
app.use('/api/v1/templates', templateRoutes);

// API documentation
app.get('/api/v1/docs', (req, res) => {
  res.json({
    title: 'LaTeX Processing API',
    version: '1.0.0',
    description: 'REST API for LaTeX processing with unjucks templates',
    endpoints: {
      'POST /api/v1/latex/render': 'Convert LaTeX to HTML/PDF',
      'POST /api/v1/latex/parse': 'Parse LaTeX to AST',
      'POST /api/v1/latex/compile': 'Full document compilation',
      'GET /api/v1/templates': 'List available templates',
      'GET /health': 'Health check'
    },
    rateLimit: {
      general: '100 requests per 15 minutes',
      processing: '20 requests per 5 minutes'
    }
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`LaTeX Processing API running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`API docs: http://localhost:${PORT}/api/v1/docs`);
  });
}

module.exports = app;