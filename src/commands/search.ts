import { defineCommand } from 'citty';
import { consola } from 'consola';
import { templateDiscovery, DiscoveryFilter } from '../lib/template-discovery.js';
import { select, checkbox } from '@inquirer/prompts';

export default defineCommand({
  meta: {
    name: 'search',
    description: 'Search and filter available templates'
  },
  args: {
    query: {
      type: 'positional',
      description: 'Search query (searches name, description, and tags)',
      required: false
    },
    category: {
      type: 'string',
      description: 'Filter by category',
      alias: 'c'
    },
    tag: {
      type: 'string',
      description: 'Filter by tag',
      alias: 't',
      multiple: true
    },
    complexity: {
      type: 'string',
      description: 'Filter by complexity level',
      choices: ['beginner', 'intermediate', 'advanced']
    },
    author: {
      type: 'string',
      description: 'Filter by author',
      alias: 'a'
    },
    interactive: {
      type: 'boolean',
      description: 'Interactive search mode',
      alias: 'i',
      default: false
    },
    format: {
      type: 'string',
      description: 'Output format',
      choices: ['table', 'list', 'json', 'compact'],
      default: 'table'
    },
    limit: {
      type: 'number',
      description: 'Maximum number of results',
      default: 20
    }
  },
  async run({ args }) {
    try {
      const search = new TemplateSearch(args);
      await search.run();
    } catch (error) {
      consola.error('Search failed:', error);
      process.exit(1);
    }
  }
});

class TemplateSearch {
  private filter: DiscoveryFilter = {};

  constructor(private args: any) {
    this.buildFilter();
  }

  async run() {
    if (this.args.interactive) {
      await this.interactiveSearch();
    } else {
      await this.directSearch();
    }
  }

  private buildFilter() {
    this.filter = {
      search: this.args.query,
      category: this.args.category,
      tags: this.args.tag,
      complexity: this.args.complexity,
      author: this.args.author
    };

    // Remove undefined values
    Object.keys(this.filter).forEach(key => {
      if (this.filter[key as keyof DiscoveryFilter] === undefined) {
        delete this.filter[key as keyof DiscoveryFilter];
      }
    });
  }

  private async interactiveSearch() {
    consola.info('🔍 Interactive Template Search\n');

    // Get available options for filters
    const [categories, tags] = await Promise.all([
      templateDiscovery.getCategories(),
      templateDiscovery.getTags()
    ]);

    // Search query
    if (!this.filter.search) {
      const searchOptions = await select({
        message: 'Search mode:',
        choices: [
          { name: '🔍 Text search', value: 'text' },
          { name: '📁 Browse by category', value: 'category' },
          { name: '🏷️  Browse by tags', value: 'tags' },
          { name: '🎯 Filter by complexity', value: 'complexity' },
          { name: '📊 Show all templates', value: 'all' }
        ]
      });

      switch (searchOptions) {
        case 'text':
          const { input } = await import('@inquirer/prompts');
          this.filter.search = await input({
            message: 'Enter search query:',
            validate: input => input.trim() ? true : 'Search query cannot be empty'
          });
          break;
        
        case 'category':
          if (categories.length > 0) {
            this.filter.category = await select({
              message: 'Select category:',
              choices: categories.map(cat => ({ name: cat, value: cat }))
            });
          }
          break;
        
        case 'tags':
          if (tags.length > 0) {
            this.filter.tags = await checkbox({
              message: 'Select tags:',
              choices: tags.slice(0, 20).map(tag => ({ name: tag, value: tag }))
            });
          }
          break;
        
        case 'complexity':
          this.filter.complexity = await select({
            message: 'Select complexity:',
            choices: [
              { name: '🟢 Beginner', value: 'beginner' },
              { name: '🟡 Intermediate', value: 'intermediate' },
              { name: '🔴 Advanced', value: 'advanced' }
            ]
          });
          break;
        
        case 'all':
          // No additional filters
          break;
      }
    }

    await this.executeSearch();
  }

  private async directSearch() {
    await this.executeSearch();
  }

  private async executeSearch() {
    consola.info('🔍 Searching templates...\n');

    const results = await templateDiscovery.searchTemplates(this.filter);

    if (results.length === 0) {
      consola.warn('No templates found matching your criteria.');
      await this.showSearchSuggestions();
      return;
    }

    // Limit results
    const limitedResults = results.slice(0, this.args.limit);

    // Show search info
    this.showSearchInfo(limitedResults, results.length);

    // Display results in requested format
    switch (this.args.format) {
      case 'json':
        console.log(JSON.stringify(limitedResults, null, 2));
        break;
      case 'compact':
        this.showCompactResults(limitedResults);
        break;
      case 'list':
        this.showListResults(limitedResults);
        break;
      case 'table':
      default:
        this.showTableResults(limitedResults);
        break;
    }

    // Show additional actions if interactive
    if (this.args.interactive && limitedResults.length > 0) {
      await this.showInteractiveActions(limitedResults);
    }
  }

  private showSearchInfo(results: any[], totalResults: number) {
    const filterInfo = [];
    
    if (this.filter.search) filterInfo.push(`query: "${this.filter.search}"`);
    if (this.filter.category) filterInfo.push(`category: ${this.filter.category}`);
    if (this.filter.tags?.length) filterInfo.push(`tags: ${this.filter.tags.join(', ')}`);
    if (this.filter.complexity) filterInfo.push(`complexity: ${this.filter.complexity}`);
    if (this.filter.author) filterInfo.push(`author: ${this.filter.author}`);

    const filterText = filterInfo.length > 0 ? ` (${filterInfo.join(', ')})` : '';
    
    consola.info(`Found ${totalResults} template${totalResults !== 1 ? 's' : ''}${filterText}`);
    
    if (results.length < totalResults) {
      consola.info(`Showing first ${results.length} results (use --limit to see more)`);
    }
    
    console.log();
  }

  private showTableResults(results: any[]) {
    const table = results.map((template, index) => ({
      '#': (index + 1).toString(),
      'Name': template.name,
      'Category': template.category,
      'Complexity': this.getComplexityBadge(template.complexity),
      'Variables': template.variables.length.toString(),
      'Files': template.files.length.toString(),
      'Tags': template.tags.slice(0, 3).join(', ') + (template.tags.length > 3 ? '...' : '')
    }));

    console.table(table);
  }

  private showListResults(results: any[]) {
    for (const [index, template] of results.entries()) {
      const complexity = this.getComplexityBadge(template.complexity);
      const tags = template.tags.slice(0, 5).join(', ') + (template.tags.length > 5 ? '...' : '');
      
      console.log(`${index + 1}. ${template.name} ${complexity}`);
      console.log(`   📁 ${template.category} | 🔧 ${template.variables.length} vars | 📄 ${template.files.length} files`);
      console.log(`   📝 ${template.description}`);
      if (tags) {
        console.log(`   🏷️  ${tags}`);
      }
      console.log();
    }
  }

  private showCompactResults(results: any[]) {
    for (const [index, template] of results.entries()) {
      const complexity = this.getComplexityBadge(template.complexity);
      console.log(`${index + 1}. ${template.name} ${complexity} (${template.category}) - ${template.description}`);
    }
  }

  private getComplexityBadge(complexity: string): string {
    const badges = {
      beginner: '🟢',
      intermediate: '🟡', 
      advanced: '🔴'
    };
    return badges[complexity as keyof typeof badges] || '⚪';
  }

  private async showSearchSuggestions() {
    consola.info('\n💡 Search Suggestions:\n');

    const [categories, tags] = await Promise.all([
      templateDiscovery.getCategories(),
      templateDiscovery.getTags()
    ]);

    if (categories.length > 0) {
      console.log('📁 Available categories:');
      for (const category of categories.slice(0, 10)) {
        console.log(`   • ${category}`);
      }
      console.log();
    }

    if (tags.length > 0) {
      console.log('🏷️  Popular tags:');
      for (const tag of tags.slice(0, 15)) {
        console.log(`   • ${tag}`);
      }
      console.log();
    }

    console.log('🔍 Try different search terms:');
    console.log('   • unjucks search react');
    console.log('   • unjucks search --category starter');
    console.log('   • unjucks search --tag frontend --complexity beginner');
    console.log('   • unjucks search api --format compact');
  }

  private async showInteractiveActions(results: any[]) {
    const action = await select({
      message: 'What would you like to do?',
      choices: [
        { name: '👀 Preview template', value: 'preview' },
        { name: '⚡ Generate from template', value: 'generate' },
        { name: '📋 Show template details', value: 'details' },
        { name: '🔍 Refine search', value: 'refine' },
        { name: '❌ Exit', value: 'exit' }
      ]
    });

    switch (action) {
      case 'preview':
        await this.previewTemplate(results);
        break;
      case 'generate':
        await this.generateFromTemplate(results);
        break;
      case 'details':
        await this.showTemplateDetails(results);
        break;
      case 'refine':
        await this.refineSearch();
        break;
      case 'exit':
        break;
    }
  }

  private async previewTemplate(results: any[]) {
    const templateChoice = await select({
      message: 'Select template to preview:',
      choices: results.map((template, index) => ({
        name: `${index + 1}. ${template.name} (${template.category})`,
        value: template.id
      }))
    });

    try {
      const { execSync } = await import('child_process');
      execSync(`unjucks preview ${templateChoice}`, { stdio: 'inherit' });
    } catch (error) {
      consola.error('Preview failed:', error);
    }
  }

  private async generateFromTemplate(results: any[]) {
    const templateChoice = await select({
      message: 'Select template to generate:',
      choices: results.map((template, index) => ({
        name: `${index + 1}. ${template.name} (${template.category})`,
        value: template.id
      }))
    });

    const { input } = await import('@inquirer/prompts');
    const name = await input({
      message: 'Enter name for generated files:',
      validate: input => input.trim() ? true : 'Name is required'
    });

    try {
      const { execSync } = await import('child_process');
      execSync(`unjucks generate ${templateChoice} ${name}`, { stdio: 'inherit' });
    } catch (error) {
      consola.error('Generation failed:', error);
    }
  }

  private async showTemplateDetails(results: any[]) {
    const templateChoice = await select({
      message: 'Select template for details:',
      choices: results.map((template, index) => ({
        name: `${index + 1}. ${template.name} (${template.category})`,
        value: template
      }))
    });

    console.log(`\n📋 ${templateChoice.name}\n`);
    console.log(`📝 Description: ${templateChoice.description}`);
    console.log(`📁 Category: ${templateChoice.category}`);
    console.log(`🎯 Complexity: ${templateChoice.complexity}`);
    console.log(`🏷️  Tags: ${templateChoice.tags.join(', ')}`);
    console.log(`📊 Variables: ${templateChoice.variables.length}`);
    console.log(`📄 Files: ${templateChoice.files.length}`);
    
    if (templateChoice.meta.author) {
      console.log(`👤 Author: ${templateChoice.meta.author}`);
    }
    
    if (templateChoice.meta.version) {
      console.log(`🔖 Version: ${templateChoice.meta.version}`);
    }

    if (templateChoice.variables.length > 0) {
      console.log(`\n🔧 Variables:`);
      for (const variable of templateChoice.variables.slice(0, 10)) {
        const required = variable.required ? ' (required)' : ' (optional)';
        console.log(`   • ${variable.name}: ${variable.type}${required}`);
        if (variable.description) {
          console.log(`     ${variable.description}`);
        }
      }
      
      if (templateChoice.variables.length > 10) {
        console.log(`     ... and ${templateChoice.variables.length - 10} more variables`);
      }
    }

    if (templateChoice.files.length > 0) {
      console.log(`\n📄 Files:`);
      for (const file of templateChoice.files.slice(0, 10)) {
        console.log(`   • ${file}`);
      }
      
      if (templateChoice.files.length > 10) {
        console.log(`     ... and ${templateChoice.files.length - 10} more files`);
      }
    }
  }

  private async refineSearch() {
    // Reset filter and start interactive search again
    this.filter = {};
    await this.interactiveSearch();
  }
}