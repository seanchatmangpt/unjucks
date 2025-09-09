/**
 * Security Headers Configuration for Fortune 5 Compliance
 * Implements OWASP security headers and enterprise security policies
 */

const securityHeaders = {
  // Content Security Policy - Strict policy for enterprise security
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // TODO: Remove unsafe-* in production
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '),

  // Prevent clickjacking attacks
  'X-Frame-Options': 'DENY',

  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',

  // Enable XSS protection
  'X-XSS-Protection': '1; mode=block',

  // Enforce HTTPS
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

  // Referrer policy for privacy
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Permissions policy (formerly Feature Policy)
  'Permissions-Policy': [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'accelerometer=()',
    'gyroscope=()'
  ].join(', '),

  // Cross-Origin policies
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',

  // Remove server information
  'Server': 'Unjucks Enterprise',

  // Cache control for sensitive data
  'Cache-Control': 'no-cache, no-store, must-revalidate, private',
  'Pragma': 'no-cache',
  'Expires': '0'
};

/**
 * Apply security headers to Express.js application
 * @param {Object} app - Express application instance
 */
function applySecurityHeaders(app) {
  // Apply all security headers
  app.use((req, res, next) => {
    Object.entries(securityHeaders).forEach(([header, value]) => {
      res.setHeader(header, value);
    });
    next();
  });

  // Remove sensitive headers
  app.disable('x-powered-by');

  // Additional security middleware recommendations
  console.log('Security headers applied. Consider adding:');
  console.log('- helmet.js for additional protection');
  console.log('- express-rate-limit for rate limiting');
  console.log('- express-validator for input validation');
  console.log('- cors with strict origin policy');
}

/**
 * Validate current security headers
 * @param {Object} headers - Response headers to validate
 * @returns {Object} Validation results
 */
function validateSecurityHeaders(headers) {
  const requiredHeaders = Object.keys(securityHeaders);
  const missing = [];
  const present = [];

  requiredHeaders.forEach(header => {
    if (headers[header] || headers[header.toLowerCase()]) {
      present.push(header);
    } else {
      missing.push(header);
    }
  });

  return {
    score: (present.length / requiredHeaders.length) * 100,
    missing,
    present,
    total: requiredHeaders.length
  };
}

module.exports = {
  securityHeaders,
  applySecurityHeaders,
  validateSecurityHeaders
};