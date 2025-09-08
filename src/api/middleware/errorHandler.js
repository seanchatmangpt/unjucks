const logger = require('../utils/logger');

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

const handleValidationError = (error) => {
  const errors = error.details.map(detail => ({
    field: detail.path.join('.'),
    message: detail.message
  }));
  
  return new AppError(`Validation failed: ${errors.map(e => e.message).join(', ')}`, 400);
};

const handleLatexError = (error) => {
  if (error.message.includes('syntax error')) {
    return new AppError('LaTeX syntax error in input', 400);
  }
  if (error.message.includes('timeout')) {
    return new AppError('LaTeX processing timeout', 408);
  }
  return new AppError('LaTeX processing failed', 500);
};

const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack
  });
};

const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message
    });
  } else {
    // Programming or other unknown error: don't leak error details
    logger.error('Unknown error:', err);
    res.status(500).json({
      status: 'error',
      message: 'Something went wrong!'
    });
  }
};

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = { ...err };
    error.message = err.message;

    // Handle specific error types
    if (err.isJoi) error = handleValidationError(err);
    if (err.name === 'LatexError') error = handleLatexError(err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      error = new AppError('File too large', 413);
    }
    if (err.type === 'entity.parse.failed') {
      error = new AppError('Invalid JSON in request body', 400);
    }

    sendErrorProd(error, res);
  }
};

const notFoundHandler = (req, res, next) => {
  const err = new AppError(`Can't find ${req.originalUrl} on this server!`, 404);
  next(err);
};

const asyncHandler = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

module.exports = {
  AppError,
  errorHandler,
  notFoundHandler,
  asyncHandler
};