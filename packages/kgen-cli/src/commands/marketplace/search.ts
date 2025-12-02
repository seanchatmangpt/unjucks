/**
 * Marketplace Search Command
 * 
 * Faceted search with N-dimensional filtering for knowledge packages.
 * Supports complex queries with domain, artifact type, compliance, and other dimensions.
 */

import { defineCommand } from 'citty';
import { consola } from 'consola';

interface SearchDimension {
  name: string;
  values: string[];
}

interface Package {
  name: string;
  version: string;
  description: string;
  author?: string;
  license?: string;
  keywords: string[];
  dimensions: Record<string, string | string[]>;
  downloads: number;
  rating: number;
  verified: boolean;
  compliance: string[];
  lastUpdated: string;
  size: number;
}

interface SearchResult {
  packages: Package[];
  facets: Record<string, Array<{ value: string; count: number }>>;
  totalResults: number;
  query: string;
  appliedFilters: Record<string, string[]>;
}

export default defineCommand({
  meta: {
    name: 'search',
    description: 'Search knowledge packages with N-dimensional faceted filtering'
  },
  args: {
    query: {
      type: 'positional',
      description: 'Search query string',
      required: false
    },
    dim: {
      type: 'string',
      description: 'Dimension filter (format: key=value1,value2)',
      alias: 'd'
    },
    domain: {
      type: 'string',
      description: 'Domain filter (Legal, Financial, Healthcare, etc.)',
      alias: 'domain'
    },
    artifact: {
      type: 'string',
      description: 'Artifact type filter (API, Service, DOCX, PDF, etc.)',
      alias: 'type'
    },
    language: {
      type: 'string',
      description: 'Programming language filter',
      alias: 'lang'
    },
    compliance: {
      type: 'string',
      description: 'Compliance standard filter (GDPR, HIPAA, SOX, etc.)',
      alias: 'comp'
    },
    maturity: {
      type: 'string',
      description: 'Maturity level filter (alpha, beta, stable, deprecated)',
      alias: 'mat'
    },
    license: {
      type: 'string',
      description: 'License filter (MIT, Apache-2.0, GPL-3.0, etc.)',
      alias: 'lic'
    },
    verified: {
      type: 'boolean',
      description: 'Show only verified packages',
      default: false
    },
    sort: {
      type: 'string',
      description: 'Sort by (relevance, downloads, rating, updated, name)',
      default: 'relevance',
      alias: 's'
    },
    limit: {
      type: 'number',
      description: 'Maximum number of results',
      default: 20,
      alias: 'l'
    },
    offset: {
      type: 'number',
      description: 'Results offset for pagination',
      default: 0,
      alias: 'o'
    },
    facets: {
      type: 'boolean',
      description: 'Show available facets and counts',
      default: false,
      alias: 'f'
    },
    format: {
      type: 'string',
      description: 'Output format (table, json, compact)',
      default: 'table'
    },
    json: {
      type: 'boolean',
      description: 'Output result as JSON',
      default: false
    }
  },
  async run({ args }) {
    try {
      // Parse dimension filters
      const dimensionFilters = parseDimensionFilters(args);
      
      // Execute search
      const searchResult = await executeSearch(args.query || '', dimensionFilters, args);
      
      // Output results
      await outputResults(searchResult, args);

    } catch (error) {
      const errorResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'SEARCH_FAILED',
        timestamp: new Date().toISOString()
      };

      if (args.json) {
        console.log(JSON.stringify(errorResult, null, 2));
      } else {
        consola.error(`Search failed: ${errorResult.error}`);
      }
      process.exit(1);
    }
  }
});

function parseDimensionFilters(args: any): Record<string, string[]> {
  const filters: Record<string, string[]> = {};
  
  // Parse --dim key=value1,value2 format
  if (args.dim) {
    const dimFilters = Array.isArray(args.dim) ? args.dim : [args.dim];
    for (const dimFilter of dimFilters) {
      const [key, values] = dimFilter.split('=');
      if (key && values) {
        filters[key] = values.split(',').map(v => v.trim());
      }
    }
  }
  
  // Add specific dimension filters
  if (args.domain) {
    filters.domain = args.domain.split(',').map(v => v.trim());
  }
  
  if (args.artifact) {
    filters.artifact = args.artifact.split(',').map(v => v.trim());
  }
  
  if (args.language) {
    filters.language = args.language.split(',').map(v => v.trim());
  }
  
  if (args.compliance) {
    filters.compliance = args.compliance.split(',').map(v => v.trim());
  }
  
  if (args.maturity) {
    filters.maturity = args.maturity.split(',').map(v => v.trim());
  }
  
  if (args.license) {
    filters.license = args.license.split(',').map(v => v.trim());
  }
  
  if (args.verified) {
    filters.verified = ['true'];
  }
  
  return filters;
}

async function executeSearch(
  query: string,
  dimensionFilters: Record<string, string[]>,
  args: any
): Promise<SearchResult> {
  
  // Mock data for demonstration - in real implementation this would query a registry
  const mockPackages: Package[] = [
    {
      name: '@legal/gdpr-contract-generator',
      version: '2.1.0',
      description: 'GDPR-compliant contract generation templates and validation rules',
      author: 'Legal Tech Corp',
      license: 'MIT',
      keywords: ['legal', 'gdpr', 'contracts', 'compliance'],
      dimensions: {
        domain: 'Legal',
        artifact: ['DOCX', 'PDF'],
        compliance: ['GDPR', 'EU-Privacy'],
        maturity: 'stable',
        language: 'JavaScript'
      },
      downloads: 15420,
      rating: 4.8,
      verified: true,
      compliance: ['GDPR', 'EU-Privacy'],
      lastUpdated: '2024-09-10T10:30:00Z',
      size: 2048576
    },
    {
      name: '@financial/api-service-generator',
      version: '3.0.1',
      description: 'Financial services API generator with compliance validation',
      author: 'FinTech Solutions',
      license: 'Apache-2.0',
      keywords: ['financial', 'api', 'services', 'compliance'],
      dimensions: {
        domain: 'Financial',
        artifact: ['API', 'Service'],
        compliance: ['SOX', 'PCI-DSS'],
        maturity: 'stable',
        language: ['TypeScript', 'Python']
      },
      downloads: 8932,
      rating: 4.6,
      verified: true,
      compliance: ['SOX', 'PCI-DSS'],
      lastUpdated: '2024-09-08T14:22:00Z',
      size: 1536000
    },
    {
      name: '@healthcare/hipaa-forms',
      version: '1.4.2',
      description: 'HIPAA-compliant healthcare forms and documentation templates',
      author: 'MedTech Inc',
      license: 'MIT',
      keywords: ['healthcare', 'hipaa', 'forms', 'medical'],
      dimensions: {
        domain: 'Healthcare',
        artifact: ['DOCX', 'PDF', 'Forms'],
        compliance: ['HIPAA', 'FDA-21CFR11'],
        maturity: 'stable',
        language: 'JavaScript'
      },
      downloads: 5642,
      rating: 4.7,
      verified: true,
      compliance: ['HIPAA', 'FDA-21CFR11'],
      lastUpdated: '2024-09-05T09:15:00Z',
      size: 3072000
    },
    {
      name: '@experimental/ml-pipeline-beta',
      version: '0.8.0',
      description: 'Experimental machine learning pipeline generator',
      author: 'AI Research Lab',
      license: 'GPL-3.0',
      keywords: ['machine-learning', 'pipeline', 'experimental'],
      dimensions: {
        domain: 'Technology',
        artifact: ['Service', 'Pipeline'],
        compliance: [],
        maturity: 'beta',
        language: ['Python', 'R']
      },
      downloads: 234,
      rating: 3.9,
      verified: false,
      compliance: [],
      lastUpdated: '2024-09-12T16:45:00Z',
      size: 512000
    }
  ];
  
  // Apply filters
  let filteredPackages = mockPackages;
  
  // Text search
  if (query) {
    const queryLower = query.toLowerCase();
    filteredPackages = filteredPackages.filter(pkg => 
      pkg.name.toLowerCase().includes(queryLower) ||
      pkg.description.toLowerCase().includes(queryLower) ||
      pkg.keywords.some(k => k.toLowerCase().includes(queryLower))
    );
  }
  
  // Apply dimension filters
  for (const [dimension, values] of Object.entries(dimensionFilters)) {
    filteredPackages = filteredPackages.filter(pkg => {
      const pkgDimValue = pkg.dimensions[dimension];
      if (!pkgDimValue) return false;
      
      const pkgValues = Array.isArray(pkgDimValue) ? pkgDimValue : [pkgDimValue];
      return values.some(filterValue => 
        pkgValues.some(pkgValue => 
          pkgValue.toLowerCase().includes(filterValue.toLowerCase())
        )
      );
    });
  }
  
  // Apply verification filter
  if (args.verified) {
    filteredPackages = filteredPackages.filter(pkg => pkg.verified);
  }
  
  // Sort results
  filteredPackages = sortPackages(filteredPackages, args.sort);
  
  // Apply pagination
  const totalResults = filteredPackages.length;
  const startIndex = args.offset;
  const endIndex = Math.min(startIndex + args.limit, totalResults);
  const pagedPackages = filteredPackages.slice(startIndex, endIndex);
  
  // Generate facets
  const facets = generateFacets(mockPackages);
  
  return {
    packages: pagedPackages,
    facets,
    totalResults,
    query: query || '',
    appliedFilters: dimensionFilters
  };
}

function sortPackages(packages: Package[], sortBy: string): Package[] {
  switch (sortBy) {
    case 'downloads':
      return packages.sort((a, b) => b.downloads - a.downloads);
    case 'rating':
      return packages.sort((a, b) => b.rating - a.rating);
    case 'updated':
      return packages.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
    case 'name':
      return packages.sort((a, b) => a.name.localeCompare(b.name));
    case 'relevance':
    default:
      return packages; // Keep original order for relevance
  }
}

function generateFacets(packages: Package[]): Record<string, Array<{ value: string; count: number }>> {
  const facets: Record<string, Map<string, number>> = {
    domain: new Map(),
    artifact: new Map(),
    compliance: new Map(),
    maturity: new Map(),
    language: new Map(),
    license: new Map(),
    verified: new Map()
  };
  
  for (const pkg of packages) {
    // Domain facet
    if (pkg.dimensions.domain) {
      const domain = Array.isArray(pkg.dimensions.domain) ? pkg.dimensions.domain[0] : pkg.dimensions.domain;
      facets.domain.set(domain, (facets.domain.get(domain) || 0) + 1);
    }
    
    // Artifact facet
    if (pkg.dimensions.artifact) {
      const artifacts = Array.isArray(pkg.dimensions.artifact) ? pkg.dimensions.artifact : [pkg.dimensions.artifact];
      for (const artifact of artifacts) {
        facets.artifact.set(artifact, (facets.artifact.get(artifact) || 0) + 1);
      }
    }
    
    // Compliance facet
    for (const comp of pkg.compliance) {
      facets.compliance.set(comp, (facets.compliance.get(comp) || 0) + 1);
    }
    
    // Maturity facet
    if (pkg.dimensions.maturity) {
      const maturity = pkg.dimensions.maturity as string;
      facets.maturity.set(maturity, (facets.maturity.get(maturity) || 0) + 1);
    }
    
    // Language facet
    if (pkg.dimensions.language) {
      const languages = Array.isArray(pkg.dimensions.language) ? pkg.dimensions.language : [pkg.dimensions.language];
      for (const lang of languages) {
        facets.language.set(lang, (facets.language.get(lang) || 0) + 1);
      }
    }
    
    // License facet
    if (pkg.license) {
      facets.license.set(pkg.license, (facets.license.get(pkg.license) || 0) + 1);
    }
    
    // Verified facet
    const verifiedStr = pkg.verified ? 'true' : 'false';
    facets.verified.set(verifiedStr, (facets.verified.get(verifiedStr) || 0) + 1);
  }
  
  // Convert to result format
  const result: Record<string, Array<{ value: string; count: number }>> = {};
  for (const [facetName, facetMap] of Object.entries(facets)) {
    result[facetName] = Array.from(facetMap.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
  }
  
  return result;
}

async function outputResults(result: SearchResult, args: any): Promise<void> {
  if (args.json || args.format === 'json') {
    const output = {
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }
  
  if (args.format === 'compact') {
    // Compact format - one line per package
    console.log(`Found ${result.totalResults} packages:\n`);
    for (const pkg of result.packages) {
      const verified = pkg.verified ? '✅' : '  ';
      const rating = '⭐'.repeat(Math.floor(pkg.rating));
      console.log(`${verified} ${pkg.name}@${pkg.version} ${rating} (${pkg.downloads.toLocaleString()} downloads)`);
    }
    return;
  }
  
  // Table format (default)
  consola.info(`🔍 Search Results: ${result.totalResults} packages found`);
  
  if (result.query) {
    consola.info(`Query: "${result.query}"`);
  }
  
  if (Object.keys(result.appliedFilters).length > 0) {
    const filterDesc = Object.entries(result.appliedFilters)
      .map(([key, values]) => `${key}: ${values.join(', ')}`)
      .join(', ');
    consola.info(`Filters: ${filterDesc}`);
  }
  
  console.log('\n' + '─'.repeat(100));
  
  for (const pkg of result.packages) {
    const verified = pkg.verified ? '✅' : '❌';
    const rating = '⭐'.repeat(Math.floor(pkg.rating)) + ` (${pkg.rating.toFixed(1)})`;
    const size = formatBytes(pkg.size);
    const updated = new Date(pkg.lastUpdated).toLocaleDateString();
    
    console.log(`\n📦 ${pkg.name}@${pkg.version} ${verified}`);
    console.log(`   ${pkg.description}`);
    console.log(`   👤 ${pkg.author || 'Unknown'} | 📄 ${pkg.license || 'No license'} | 📊 ${pkg.downloads.toLocaleString()} downloads`);
    console.log(`   ${rating} | 📏 ${size} | 📅 Updated ${updated}`);
    
    if (pkg.keywords.length > 0) {
      console.log(`   🏷️  ${pkg.keywords.join(', ')}`);
    }
    
    if (pkg.compliance.length > 0) {
      console.log(`   ⚖️  Compliance: ${pkg.compliance.join(', ')}`);
    }
    
    // Show dimensions
    const dimensions = Object.entries(pkg.dimensions)
      .filter(([key]) => key !== 'compliance') // Already shown above
      .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
      .join(' | ');
    
    if (dimensions) {
      console.log(`   🎯 ${dimensions}`);
    }
  }
  
  // Show facets if requested
  if (args.facets) {
    console.log('\n' + '═'.repeat(50));
    consola.info('📊 Available Facets:');
    
    for (const [facetName, facetValues] of Object.entries(result.facets)) {
      if (facetValues.length > 0) {
        console.log(`\n${facetName.toUpperCase()}:`);
        for (const { value, count } of facetValues.slice(0, 10)) { // Show top 10
          console.log(`  ${value} (${count})`);
        }
      }
    }
    
    console.log('\nExample usage:');
    console.log('  kgen marketplace search --dim domain=Legal --dim artifact=API');
    console.log('  kgen marketplace search "contract" --compliance GDPR --verified');
    console.log('  kgen marketplace search --domain Financial --language TypeScript');
  }
  
  if (result.packages.length < result.totalResults) {
    const remaining = result.totalResults - result.packages.length - args.offset;
    consola.info(`\n... and ${remaining} more results. Use --offset and --limit for pagination.`);
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}