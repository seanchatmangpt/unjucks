const express = require('express');
const latexService = require('../services/latexService');
const { asyncHandler } = require('../middleware/errorHandler');
const { 
  validateLatexRender, 
  validateLatexParse, 
  validateLatexCompile 
} = require('../middleware/validation');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * POST /api/v1/latex/render
 * Convert LaTeX to HTML or PDF
 */
router.post('/render', validateLatexRender, asyncHandler(async (req, res) => {
  const { latex, format, template, options } = req.body;
  
  logger.info('LaTeX render request', { 
    format, 
    latexLength: latex.length, 
    hasTemplate: !!template 
  });

  let result;
  const startTime = Date.now();

  try {
    if (format === 'pdf') {
      result = await latexService.renderToPdf(latex, options);
      
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="rendered.pdf"',
        'Content-Length': result.pdf.length,
        'Cache-Control': 'private, max-age=300' // 5 minutes
      });
      
      return res.send(result.pdf);
    } else {
      result = await latexService.renderToHtml(latex, options);
      
      res.set({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, max-age=300'
      });
      
      return res.send(result.html);
    }
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error('LaTeX render failed', { 
      error: error.message, 
      format, 
      processingTime 
    });
    throw error;
  } finally {
    const processingTime = Date.now() - startTime;
    logger.info('LaTeX render completed', { 
      format, 
      processingTime, 
      success: !!result 
    });
  }
}));

/**
 * POST /api/v1/latex/parse
 * Parse LaTeX to AST (Abstract Syntax Tree)
 */
router.post('/parse', validateLatexParse, asyncHandler(async (req, res) => {
  const { latex, options } = req.body;
  
  logger.info('LaTeX parse request', { 
    latexLength: latex.length, 
    options 
  });

  const startTime = Date.now();
  
  try {
    const result = await latexService.parseLatex(latex, options);
    const processingTime = Date.now() - startTime;
    
    res.json({
      success: true,
      data: {
        ast: result.ast,
        metadata: {
          nodeCount: result.nodeCount,
          processingTime,
          inputLength: latex.length,
          options
        }
      }
    });
    
    logger.info('LaTeX parse completed', { 
      nodeCount: result.nodeCount, 
      processingTime 
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error('LaTeX parse failed', { 
      error: error.message, 
      processingTime 
    });
    throw error;
  }
}));

/**
 * POST /api/v1/latex/compile
 * Full document compilation
 */
router.post('/compile', validateLatexCompile, asyncHandler(async (req, res) => {
  const { latex, template, format, bibliography, options } = req.body;
  
  logger.info('LaTeX compile request', { 
    format, 
    latexLength: latex.length,
    hasTemplate: !!template,
    hasBibliography: !!bibliography,
    engine: options?.engine
  });

  const startTime = Date.now();
  
  try {
    const result = await latexService.compileDocument(latex, { 
      ...options, 
      format, 
      template, 
      bibliography 
    });
    
    const processingTime = Date.now() - startTime;
    
    if (format === 'pdf') {
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="compiled.pdf"',
        'Content-Length': result.output.length,
        'X-Processing-Time': processingTime.toString(),
        'X-Compilation-Passes': result.compilation.passes.toString(),
        'X-LaTeX-Engine': result.compilation.engine
      });
      
      return res.send(result.output);
    } else if (format === 'html') {
      res.set({
        'Content-Type': 'text/html; charset=utf-8',
        'X-Processing-Time': processingTime.toString()
      });
      
      return res.send(result.output);
    } else {
      // tex format
      res.set({
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Processing-Time': processingTime.toString()
      });
      
      return res.send(result.output);
    }
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error('LaTeX compile failed', { 
      error: error.message, 
      format, 
      processingTime 
    });
    throw error;
  }
}));

/**
 * GET /api/v1/latex/status
 * Get service status and health
 */
router.get('/status', asyncHandler(async (req, res) => {
  res.json({
    status: 'operational',
    services: {
      katex: 'available',
      puppeteer: 'available',
      parser: 'available'
    },
    limits: {
      maxLatexLength: 100000,
      maxProcessingTime: 30000,
      supportedFormats: ['html', 'pdf', 'tex']
    },
    timestamp: new Date().toISOString()
  });
}));

/**
 * POST /api/v1/latex/validate
 * Validate LaTeX syntax without rendering
 */
router.post('/validate', validateLatexParse, asyncHandler(async (req, res) => {
  const { latex } = req.body;
  
  try {
    const result = await latexService.parseLatex(latex, { strict: true });
    
    res.json({
      valid: true,
      nodeCount: result.nodeCount,
      message: 'LaTeX syntax is valid'
    });
  } catch (error) {
    res.json({
      valid: false,
      error: error.message,
      message: 'LaTeX syntax validation failed'
    });
  }
}));

module.exports = router;