/**
 * Template marketplace MCP tool for discovering and purchasing enterprise templates
 */

import type { ToolResult } from '../types.js';
import { createJSONToolResult, handleToolError } from '../utils.js';
import { WebFetch } from '../utils.js';

export interface MarketplaceParams {
  action: 'search' | 'details' | 'purchase' | 'install' | 'list' | 'trending';
  query?: string;
  templateId?: string;
  category?: string;
  tags?: string[];
  sort?: 'popular' | 'recent' | 'price' | 'rating';
  filters?: {
    minRating?: number;
    maxPrice?: number;
    enterprise?: boolean;
    verified?: boolean;
  };
}

interface MarketplaceTemplate {
  id: string;
  name: string;
  description: string;
  author: string;
  organization?: string;
  version: string;
  category: string;
  tags: string[];
  price: number;
  currency: string;
  rating: number;
  downloads: number;
  verified: boolean;
  enterprise: boolean;
  features: string[];
  requirements?: string[];
  screenshots?: string[];
  lastUpdated: string;
}

// Mock marketplace data (production would use API)
const marketplaceTemplates: MarketplaceTemplate[] = [
  {
    id: 'ent-microservice-001',
    name: 'Enterprise Microservice Suite',
    description: 'Complete microservice architecture with Kubernetes, service mesh, and observability',
    author: 'Unjucks Enterprise Team',
    organization: 'Unjucks Inc.',
    version: '2.4.0',
    category: 'backend',
    tags: ['microservices', 'kubernetes', 'istio', 'enterprise', 'scalable'],
    price: 4999,
    currency: 'USD',
    rating: 4.9,
    downloads: 15420,
    verified: true,
    enterprise: true,
    features: [
      'Multi-service architecture',
      'Kubernetes deployment configs',
      'Istio service mesh',
      'Distributed tracing',
      'Circuit breakers',
      'API gateway'
    ],
    requirements: ['kubernetes', 'docker', 'istio'],
    lastUpdated: '2024-12-15'
  },
  {
    id: 'ent-saas-starter-002',
    name: 'SaaS Starter Kit Enterprise',
    description: 'Production-ready SaaS application with multi-tenancy, billing, and analytics',
    author: 'CloudScale Solutions',
    organization: 'CloudScale Inc.',
    version: '3.1.0',
    category: 'fullstack',
    tags: ['saas', 'multi-tenant', 'billing', 'stripe', 'analytics'],
    price: 9999,
    currency: 'USD',
    rating: 4.8,
    downloads: 8234,
    verified: true,
    enterprise: true,
    features: [
      'Multi-tenant architecture',
      'Stripe billing integration',
      'User management & RBAC',
      'Analytics dashboard',
      'Email automation',
      'API documentation'
    ],
    requirements: ['nodejs', 'postgresql', 'redis'],
    lastUpdated: '2024-12-20'
  },
  {
    id: 'ent-ml-pipeline-003',
    name: 'ML Pipeline Enterprise',
    description: 'Enterprise machine learning pipeline with MLOps, model versioning, and monitoring',
    author: 'AI Systems Corp',
    version: '1.8.0',
    category: 'ml',
    tags: ['machine-learning', 'mlops', 'pipeline', 'monitoring', 'enterprise'],
    price: 14999,
    currency: 'USD',
    rating: 4.7,
    downloads: 3456,
    verified: true,
    enterprise: true,
    features: [
      'MLOps pipeline',
      'Model versioning',
      'A/B testing framework',
      'Performance monitoring',
      'Data validation',
      'Automated retraining'
    ],
    requirements: ['python', 'kubernetes', 'mlflow'],
    lastUpdated: '2024-12-10'
  },
  {
    id: 'ent-security-audit-004',
    name: 'Security & Compliance Suite',
    description: 'Complete security and compliance templates for SOC2, HIPAA, GDPR',
    author: 'SecureOps Team',
    organization: 'SecureOps Inc.',
    version: '2.2.0',
    category: 'security',
    tags: ['security', 'compliance', 'soc2', 'hipaa', 'gdpr', 'audit'],
    price: 7499,
    currency: 'USD',
    rating: 5.0,
    downloads: 12567,
    verified: true,
    enterprise: true,
    features: [
      'SOC2 compliance templates',
      'HIPAA audit tools',
      'GDPR data protection',
      'Security scanning',
      'Audit logging',
      'Vulnerability reports'
    ],
    requirements: ['docker', 'postgresql'],
    lastUpdated: '2024-12-22'
  },
  {
    id: 'ent-realtime-collab-005',
    name: 'Real-time Collaboration Platform',
    description: 'WebSocket-based real-time collaboration with presence, cursors, and CRDT',
    author: 'CollabTech Solutions',
    version: '1.5.0',
    category: 'realtime',
    tags: ['websocket', 'collaboration', 'realtime', 'crdt', 'presence'],
    price: 5999,
    currency: 'USD',
    rating: 4.6,
    downloads: 4589,
    verified: true,
    enterprise: true,
    features: [
      'WebSocket server',
      'Presence indicators',
      'Collaborative editing',
      'CRDT implementation',
      'Cursor tracking',
      'Session management'
    ],
    requirements: ['nodejs', 'redis', 'websocket'],
    lastUpdated: '2024-12-18'
  }
];

/**
 * Template marketplace handler
 */
export async function unjucksTemplateMarketplace(params: MarketplaceParams): Promise<ToolResult> {
  try {
    const { action } = params;

    switch (action) {
      case 'search':
        return await searchTemplates(params);
      
      case 'details':
        return await getTemplateDetails(params.templateId);
      
      case 'purchase':
        return await purchaseTemplate(params.templateId);
      
      case 'install':
        return await installTemplate(params.templateId);
      
      case 'list':
        return await listUserTemplates();
      
      case 'trending':
        return await getTrendingTemplates();
      
      default:
        return createJSONToolResult({
          error: `Unknown action: ${action}`
        });
    }
  } catch (error) {
    return handleToolError(error, 'unjucks_template_marketplace', 'marketplace operation');
  }
}

async function searchTemplates(params: MarketplaceParams): Promise<ToolResult> {
  let results = [...marketplaceTemplates];

  // Apply filters
  if (params.query) {
    const query = params.query.toLowerCase();
    results = results.filter(t => 
      t.name.toLowerCase().includes(query) ||
      t.description.toLowerCase().includes(query) ||
      t.tags.some(tag => tag.toLowerCase().includes(query))
    );
  }

  if (params.category) {
    results = results.filter(t => t.category === params.category);
  }

  if (params.tags && params.tags.length > 0) {
    results = results.filter(t => 
      params.tags!.some(tag => t.tags.includes(tag))
    );
  }

  if (params.filters) {
    const { minRating, maxPrice, enterprise, verified } = params.filters;
    
    if (minRating !== undefined) {
      results = results.filter(t => t.rating >= minRating);
    }
    if (maxPrice !== undefined) {
      results = results.filter(t => t.price <= maxPrice);
    }
    if (enterprise !== undefined) {
      results = results.filter(t => t.enterprise === enterprise);
    }
    if (verified !== undefined) {
      results = results.filter(t => t.verified === verified);
    }
  }

  // Sort results
  if (params.sort) {
    switch (params.sort) {
      case 'popular':
        results.sort((a, b) => b.downloads - a.downloads);
        break;
      case 'recent':
        results.sort((a, b) => 
          new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
        );
        break;
      case 'price':
        results.sort((a, b) => a.price - b.price);
        break;
      case 'rating':
        results.sort((a, b) => b.rating - a.rating);
        break;
    }
  }

  return createJSONToolResult({
    success: true,
    count: results.length,
    templates: results.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      author: t.author,
      category: t.category,
      price: `${t.currency} ${t.price}`,
      rating: t.rating,
      downloads: t.downloads,
      tags: t.tags,
      verified: t.verified,
      enterprise: t.enterprise
    }))
  });
}

async function getTemplateDetails(templateId?: string): Promise<ToolResult> {
  if (!templateId) {
    return createJSONToolResult({
      error: 'Template ID required'
    });
  }

  const template = marketplaceTemplates.find(t => t.id === templateId);
  
  if (!template) {
    return createJSONToolResult({
      error: `Template ${templateId} not found`
    });
  }

  // Fetch additional details (in production, from API)
  const details = {
    ...template,
    readme: `# ${template.name}\n\n${template.description}\n\n## Features\n${template.features.map(f => `- ${f}`).join('\n')}`,
    changelog: '## Version 2.4.0\n- Added Kubernetes support\n- Improved performance\n- Bug fixes',
    reviews: [
      {
        user: 'john.doe@fortune500.com',
        rating: 5,
        comment: 'Excellent template, saved us months of development',
        date: '2024-12-01'
      },
      {
        user: 'jane.smith@enterprise.com',
        rating: 4,
        comment: 'Great features, well documented',
        date: '2024-11-15'
      }
    ],
    dependencies: template.requirements,
    fileCount: 127,
    installSize: '15.3 MB',
    license: 'Enterprise License',
    support: {
      email: 'support@unjucks.enterprise',
      documentation: 'https://docs.unjucks.enterprise/templates/' + templateId,
      slack: 'https://unjucks-enterprise.slack.com'
    }
  };

  return createJSONToolResult({
    success: true,
    template: details
  });
}

async function purchaseTemplate(templateId?: string): Promise<ToolResult> {
  if (!templateId) {
    return createJSONToolResult({
      error: 'Template ID required'
    });
  }

  const template = marketplaceTemplates.find(t => t.id === templateId);
  
  if (!template) {
    return createJSONToolResult({
      error: `Template ${templateId} not found`
    });
  }

  // In production, process payment through payment gateway
  const purchase = {
    orderId: 'ORD-' + Date.now(),
    templateId: template.id,
    templateName: template.name,
    price: template.price,
    currency: template.currency,
    status: 'completed',
    purchaseDate: new Date().toISOString(),
    license: {
      key: 'LIC-' + crypto.randomBytes(16).toString('hex').toUpperCase(),
      type: 'Enterprise',
      seats: 'unlimited',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    },
    downloadUrl: `https://marketplace.unjucks.enterprise/download/${templateId}`,
    invoice: {
      number: 'INV-2024-' + Math.floor(Math.random() * 10000),
      url: `https://marketplace.unjucks.enterprise/invoice/ORD-${Date.now()}`
    }
  };

  return createJSONToolResult({
    success: true,
    message: `Successfully purchased ${template.name}`,
    purchase
  });
}

async function installTemplate(templateId?: string): Promise<ToolResult> {
  if (!templateId) {
    return createJSONToolResult({
      error: 'Template ID required'
    });
  }

  const template = marketplaceTemplates.find(t => t.id === templateId);
  
  if (!template) {
    return createJSONToolResult({
      error: `Template ${templateId} not found`
    });
  }

  // In production, download and install template
  const installation = {
    templateId: template.id,
    templateName: template.name,
    version: template.version,
    installPath: `_templates/marketplace/${template.id}`,
    status: 'completed',
    installedAt: new Date().toISOString(),
    files: [
      `_templates/marketplace/${template.id}/config.yml`,
      `_templates/marketplace/${template.id}/README.md`,
      `_templates/marketplace/${template.id}/template.njk`,
      // ... more files
    ],
    commands: [
      `unjucks ${template.id} create --name MyProject`,
      `unjucks list ${template.id}`
    ]
  };

  return createJSONToolResult({
    success: true,
    message: `Successfully installed ${template.name}`,
    installation
  });
}

async function listUserTemplates(): Promise<ToolResult> {
  // In production, fetch from user's purchased templates
  const userTemplates = marketplaceTemplates.slice(0, 2).map(t => ({
    id: t.id,
    name: t.name,
    version: t.version,
    installedAt: '2024-12-01',
    lastUsed: '2024-12-20',
    timesUsed: Math.floor(Math.random() * 100)
  }));

  return createJSONToolResult({
    success: true,
    templates: userTemplates
  });
}

async function getTrendingTemplates(): Promise<ToolResult> {
  // Get trending templates based on recent downloads and ratings
  const trending = marketplaceTemplates
    .sort((a, b) => {
      const scoreA = a.downloads * 0.7 + a.rating * 1000 * 0.3;
      const scoreB = b.downloads * 0.7 + b.rating * 1000 * 0.3;
      return scoreB - scoreA;
    })
    .slice(0, 5)
    .map(t => ({
      id: t.id,
      name: t.name,
      category: t.category,
      downloads: t.downloads,
      rating: t.rating,
      trend: '+' + Math.floor(Math.random() * 50) + '%'
    }));

  return createJSONToolResult({
    success: true,
    trending
  });
}

// Export schema for tool registration
export const unjucksTemplateMarketplaceSchema = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      enum: ['search', 'details', 'purchase', 'install', 'list', 'trending'],
      description: 'Marketplace action to perform'
    },
    query: {
      type: 'string',
      description: 'Search query'
    },
    templateId: {
      type: 'string',
      description: 'Template identifier'
    },
    category: {
      type: 'string',
      description: 'Template category'
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: 'Filter by tags'
    },
    sort: {
      type: 'string',
      enum: ['popular', 'recent', 'price', 'rating'],
      description: 'Sort order'
    },
    filters: {
      type: 'object',
      description: 'Additional filters'
    }
  },
  required: ['action']
};