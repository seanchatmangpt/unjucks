const express = require('express');
const templateService = require('../services/templateService');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateTemplateQuery } = require('../middleware/validation');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/v1/templates
 * List available LaTeX templates
 */
router.get('/', validateTemplateQuery, asyncHandler(async (req, res) => {
  const { category, format, limit, offset } = req.query;
  
  logger.info('Templates list request', { category, format, limit, offset });

  try {
    const result = await templateService.getTemplates({
      category,
      format,
      limit,
      offset
    });

    res.json({
      success: true,
      data: result.templates,
      pagination: result.pagination,
      total: result.total,
      categories: ['article', 'book', 'report', 'beamer', 'letter', 'custom']
    });
  } catch (error) {
    logger.error('Templates list failed', { error: error.message });
    throw error;
  }
}));

/**
 * GET /api/v1/templates/:name
 * Get a specific template by name
 */
router.get('/:name', asyncHandler(async (req, res) => {
  const { name } = req.params;
  
  logger.info('Template get request', { name });

  try {
    const template = await templateService.getTemplate(name);
    
    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    logger.error('Template get failed', { error: error.message, name });
    throw error;
  }
}));

/**
 * POST /api/v1/templates
 * Add a new custom template
 */
router.post('/', asyncHandler(async (req, res) => {
  const templateData = req.body;
  
  // Basic validation
  if (!templateData.name || !templateData.content) {
    return res.status(400).json({
      success: false,
      error: 'Template name and content are required'
    });
  }

  logger.info('Template add request', { name: templateData.name });

  try {
    const template = await templateService.addTemplate({
      ...templateData,
      category: templateData.category || 'custom',
      description: templateData.description || `Custom template: ${templateData.name}`
    });
    
    res.status(201).json({
      success: true,
      data: template,
      message: 'Template created successfully'
    });
  } catch (error) {
    logger.error('Template add failed', { error: error.message });
    throw error;
  }
}));

/**
 * GET /api/v1/templates/categories/stats
 * Get template statistics by category
 */
router.get('/categories/stats', asyncHandler(async (req, res) => {
  logger.info('Template stats request');

  try {
    const { templates } = await templateService.getTemplates({ limit: 1000 });
    
    const stats = templates.reduce((acc, template) => {
      const category = template.category || 'uncategorized';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});

    const totalTemplates = templates.length;
    const categories = Object.keys(stats);

    res.json({
      success: true,
      data: {
        total: totalTemplates,
        categories: categories.length,
        breakdown: stats,
        mostPopular: categories.sort((a, b) => stats[b] - stats[a])[0]
      }
    });
  } catch (error) {
    logger.error('Template stats failed', { error: error.message });
    throw error;
  }
}));

/**
 * POST /api/v1/templates/search
 * Search templates by content or metadata
 */
router.post('/search', asyncHandler(async (req, res) => {
  const { query, category, limit = 20 } = req.body;
  
  if (!query) {
    return res.status(400).json({
      success: false,
      error: 'Search query is required'
    });
  }

  logger.info('Template search request', { query, category, limit });

  try {
    const { templates } = await templateService.getTemplates({ 
      category, 
      limit: 1000 // Get all for searching
    });

    // Simple text search in name, description, and content
    const searchTerm = query.toLowerCase();
    const results = templates.filter(template => 
      template.name.toLowerCase().includes(searchTerm) ||
      (template.description && template.description.toLowerCase().includes(searchTerm)) ||
      (template.content && template.content.toLowerCase().includes(searchTerm)) ||
      (template.variables && template.variables.some(v => v.toLowerCase().includes(searchTerm)))
    ).slice(0, limit);

    res.json({
      success: true,
      data: results,
      query,
      total: results.length,
      searchTime: Date.now()
    });
  } catch (error) {
    logger.error('Template search failed', { error: error.message });
    throw error;
  }
}));

/**
 * POST /api/v1/templates/:name/preview
 * Generate a preview of template with sample data
 */
router.post('/:name/preview', asyncHandler(async (req, res) => {
  const { name } = req.params;
  const sampleData = req.body || {};
  
  logger.info('Template preview request', { name });

  try {
    const template = await templateService.getTemplate(name);
    
    // Generate sample data for missing variables
    let previewContent = template.content;
    if (template.variables) {
      template.variables.forEach(variable => {
        const value = sampleData[variable] || `[${variable}]`;
        const regex = new RegExp(`\\{\\{\\{?${variable}\\}?\\}\\}`, 'g');
        previewContent = previewContent.replace(regex, value);
      });
    }

    res.json({
      success: true,
      data: {
        name: template.name,
        description: template.description,
        category: template.category,
        preview: previewContent,
        variables: template.variables,
        sampleData
      }
    });
  } catch (error) {
    logger.error('Template preview failed', { error: error.message, name });
    throw error;
  }
}));

/**
 * DELETE /api/v1/templates/cache
 * Clear template cache (admin endpoint)
 */
router.delete('/cache', asyncHandler(async (req, res) => {
  logger.info('Template cache clear request');

  try {
    templateService.clearCache();
    
    res.json({
      success: true,
      message: 'Template cache cleared successfully'
    });
  } catch (error) {
    logger.error('Template cache clear failed', { error: error.message });
    throw error;
  }
}));

module.exports = router;