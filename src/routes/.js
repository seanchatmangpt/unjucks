const express = require('express');



const { Controller } = require('../controllers/Controller');
const { asyncHandler } = require('../utils/async-handler');
const logger = require('../utils/logger');

const router = express.Router();
const controller = new Controller();





// Request logging middleware
router.use((req, res, next) => {
  logger.info(` API request`, {
    method: req.method,
    path: req.path,
    
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});















// Error handling middleware specific to this route
router.use((error, req, res, next) => {
  logger.error(` API error`, {
    error: error.message,
    stack: error.stack,
    method: req.method,
    path: req.path,
    
    ip: req.ip
  });
  next(error);
});

module.exports = router;