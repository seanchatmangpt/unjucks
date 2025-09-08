const Joi = require('joi');
const { AppError } = require('./errorHandler');

const requestValidator = (req, res, next) => {
  // Basic request size validation
  const contentLength = req.get('Content-Length');
  if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) { // 10MB limit
    return next(new AppError('Request entity too large', 413));
  }

  // Sanitize common XSS patterns in query params
  for (const key in req.query) {
    if (typeof req.query[key] === 'string') {
      req.query[key] = req.query[key].replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }
  }

  next();
};

const validateLatexRender = (req, res, next) => {
  const schema = Joi.object({
    latex: Joi.string().required().max(50000).messages({
      'string.empty': 'LaTeX content is required',
      'string.max': 'LaTeX content exceeds maximum length of 50000 characters'
    }),
    format: Joi.string().valid('html', 'pdf').default('html'),
    template: Joi.string().optional().max(100),
    options: Joi.object({
      displayMode: Joi.boolean().default(false),
      throwOnError: Joi.boolean().default(false),
      macros: Joi.object().optional(),
      trust: Joi.boolean().default(false),
      strict: Joi.string().valid('warn', 'ignore', 'error').default('warn')
    }).optional()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }

  req.body = value;
  next();
};

const validateLatexParse = (req, res, next) => {
  const schema = Joi.object({
    latex: Joi.string().required().max(50000).messages({
      'string.empty': 'LaTeX content is required',
      'string.max': 'LaTeX content exceeds maximum length of 50000 characters'
    }),
    options: Joi.object({
      strict: Joi.boolean().default(true),
      includeComments: Joi.boolean().default(false),
      expandMacros: Joi.boolean().default(false)
    }).optional()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }

  req.body = value;
  next();
};

const validateLatexCompile = (req, res, next) => {
  const schema = Joi.object({
    latex: Joi.string().required().max(100000),
    template: Joi.string().optional().max(100),
    format: Joi.string().valid('pdf', 'html', 'tex').default('pdf'),
    bibliography: Joi.string().optional().max(50000),
    options: Joi.object({
      engine: Joi.string().valid('pdflatex', 'xelatex', 'lualatex').default('pdflatex'),
      passes: Joi.number().integer().min(1).max(5).default(2),
      timeout: Joi.number().integer().min(1000).max(30000).default(10000),
      includeAux: Joi.boolean().default(false)
    }).optional()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }

  req.body = value;
  next();
};

const validateTemplateQuery = (req, res, next) => {
  const schema = Joi.object({
    category: Joi.string().valid('article', 'book', 'report', 'beamer', 'letter', 'custom').optional(),
    format: Joi.string().valid('json', 'list').default('json'),
    limit: Joi.number().integer().min(1).max(100).default(20),
    offset: Joi.number().integer().min(0).default(0)
  });

  const { error, value } = schema.validate(req.query);
  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }

  req.query = value;
  next();
};

module.exports = {
  requestValidator,
  validateLatexRender,
  validateLatexParse,
  validateLatexCompile,
  validateTemplateQuery
};