/**
 * List Views Command
 * 
 * Lists available persona views and their capabilities.
 */

import { defineCommand } from 'citty';

export default defineCommand({
  meta: {
    name: 'list-views',
    description: 'List available persona views'
  },
  args: {
    format: {
      type: 'string',
      description: 'Output format',
      default: 'table',
      valueHint: 'json|yaml|table'
    },
    detailed: {
      type: 'boolean',
      description: 'Show detailed view information',
      default: false
    }
  },
  async run({ args }) {
    const { format, detailed } = args;
    
    const views = [
      {
        persona: 'executive',
        description: 'C-level executive perspective with ROI and business metrics',
        features: ['ROI Analysis', 'Compliance Matrix', 'Risk Assessment', 'Portfolio Summary'],
        audience: 'C-level executives, business decision makers',
        metrics: ['Monthly ROI', 'Compliance Score', 'Risk Level', 'Business Impact'],
        outputSchema: 'kmkt:ExecutiveView'
      },
      {
        persona: 'architect',
        description: 'Solution architect perspective with technical deep-dive',
        features: ['Dependency Graphs', 'Integration Patterns', 'Performance Benchmarks', 'Technical Debt'],
        audience: 'Solution architects, technical leads, system designers',
        metrics: ['Complexity Score', 'Performance Score', 'Health Score', 'Technical Debt Level'],
        outputSchema: 'kmkt:ArchitectView'
      },
      {
        persona: 'developer',
        description: 'Software developer perspective with implementation details',
        features: ['API Documentation', 'Code Examples', 'Quickstart Guides', 'Implementation Patterns'],
        audience: 'Software developers, engineers, implementers',
        metrics: ['API Count', 'Example Count', 'Guide Count', 'Difficulty Level'],
        outputSchema: 'kmkt:DeveloperView'
      }
    ];
    
    const result = {
      success: true,
      data: {
        availableViews: views.length,
        views: detailed ? views : views.map(v => ({
          persona: v.persona,
          description: v.description,
          audience: v.audience,
          schema: v.outputSchema
        })),
        usage: {
          basic: 'kgen explore --persona <persona>',
          filtered: 'kgen explore --persona <persona> --filter <category>',
          comprehensive: 'kgen explore --persona <persona> --depth comprehensive',
          output: 'kgen explore --persona <persona> --output ./report.json'
        }
      },
      metadata: {
        generated: new Date().toISOString(),
        version: '1.0.0'
      }
    };

    if (format === 'json') {
      console.log(JSON.stringify(result, null, 2));
    } else if (format === 'table') {
      console.log('Available Persona Views:');
      console.log('━'.repeat(80));
      
      views.forEach(view => {
        console.log(`\n📊 ${view.persona.toUpperCase()}`);
        console.log(`   ${view.description}`);
        console.log(`   👥 Audience: ${view.audience}`);
        console.log(`   📋 Schema: ${view.outputSchema}`);
        
        if (detailed) {
          console.log(`   🔧 Features: ${view.features.join(', ')}`);
          console.log(`   📈 Metrics: ${view.metrics.join(', ')}`);
        }
      });
      
      console.log('\n' + '━'.repeat(80));
      console.log('Usage Examples:');
      console.log('  kgen explore --persona executive');
      console.log('  kgen explore --persona architect --depth comprehensive');
      console.log('  kgen explore --persona developer --filter api-services');
    }

    process.exit(0);
  }
});