/**
 * @fileoverview Example usage of Variable Extractor
 * Demonstrates various features and capabilities
 */

import VariableExtractor from './variable-extractor.js';

// Create extractor with options
const extractor = new VariableExtractor({
  includeLineNumbers: true,
  validateNames: true,
  trackDependencies: true,
  ignoreComments: true
});

// Example 1: Basic variable extraction
console.log('=== Example 1: Basic Variables ===');
const basicTemplate = `
Hello {{name}}, welcome to {{site}}!
Your age is {age} and role is <role>.
Template literal: \`Welcome \${user.name}\`
`;

const basicResult = extractor.extract(basicTemplate);
console.log(`Found ${basicResult.variables.length} variables:`);
basicResult.variables.forEach(v => {
  console.log(`  - ${v.name} (${v.type}) at line ${v.line}: ${v.syntax}`);
});

// Example 2: Complex nested objects and arrays
console.log('\n=== Example 2: Nested Objects and Arrays ===');
const complexTemplate = `
User: {{user.profile.name}}
Address: {{user.addresses[0].street}}
Dynamic: {{data[key].values[index]}}
`;

const complexResult = extractor.extract(complexTemplate);
console.log('Complex variables:');
complexResult.variables.forEach(v => {
  console.log(`  - ${v.name}: ${v.path} (dependencies: ${v.dependencies.join(', ') || 'none'})`);
});

// Example 3: Loops and conditionals
console.log('\n=== Example 3: Loops and Conditionals ===');
const logicTemplate = `
{{#each items}}
  {{#if item.active}}
    <div>{{item.name}} - {{item.price|currency}}</div>
  {{/if}}
{{/each}}

{{#unless user.banned}}
  Welcome back!
{{/unless}}
`;

const logicResult = extractor.extract(logicTemplate);
console.log('Variables by type:');
for (const [type, variables] of logicResult.byType) {
  console.log(`  ${type}: ${variables.map(v => v.name).join(', ')}`);
}

// Example 4: Filters and pipes
console.log('\n=== Example 4: Filters and Pipes ===');
const filterTemplate = `
Price: {{product.price|currency|round:2}}
Date: {{createdAt|format:"YYYY-MM-DD"}}
Name: {{user.firstName|capitalize|truncate:20}}
`;

const filterResult = extractor.extract(filterTemplate);
const filterVars = filterResult.byType.get('filter') || [];
console.log('Filter variables:');
filterVars.forEach(v => {
  console.log(`  - ${v.name}: filters = ${v.metadata.filters.join(' | ')}`);
});

// Example 5: Variable validation
console.log('\n=== Example 5: Variable Validation ===');
const invalidTemplate = `
{{validName}}
{{123invalid}}
{{function}}
{{very_long_variable_name_that_exceeds_normal_limits_and_should_trigger_warnings}}
`;

const invalidResult = extractor.extract(invalidTemplate);
const validation = extractor.validateVariables(invalidResult.variables);

console.log(`Valid variables: ${validation.valid.length}`);
console.log(`Invalid variables: ${validation.invalid.length}`);
validation.invalid.forEach(item => {
  console.log(`  - ${item.variable.name}: ${item.errors.join(', ')}`);
});

console.log(`Warnings: ${validation.warnings.length}`);
validation.warnings.forEach(item => {
  console.log(`  - ${item.variable.name}: ${item.warnings.join(', ')}`);
});

// Example 6: Custom syntax
console.log('\n=== Example 6: Custom Syntax ===');
extractor.addCustomSyntax('brackets', {
  pattern: /\[\[([^\]]+)\]\]/g,
  extractor: (match, content, line, column) => {
    return [{
      name: match[1].trim(),
      type: 'custom-bracket',
      syntax: match[0],
      path: match[1].trim(),
      line,
      column,
      dependencies: [],
      metadata: { customType: 'brackets' }
    }];
  }
});

const customTemplate = 'Custom syntax: [[customVar]] and [[another.var]]';
const customResult = extractor.extract(customTemplate);
console.log('Custom syntax variables:');
customResult.variables.forEach(v => {
  console.log(`  - ${v.name} (${v.type}): ${v.syntax}`);
});

// Example 7: Dependencies analysis
console.log('\n=== Example 7: Dependency Analysis ===');
const depTemplate = `
{{users[currentIndex].profile}}
{{items[selectedId].data.values[offset]}}
{{config[theme].colors[primary]}}
`;

const depResult = extractor.extract(depTemplate);
console.log('Dependency graph:');
for (const [variable, deps] of depResult.dependencies) {
  console.log(`  ${variable} depends on: ${deps.join(', ')}`);
}

// Example 8: Statistics and complexity
console.log('\n=== Example 8: Statistics ===');
const statsTemplate = `
Simple: {{name}}
Object: {{user.profile.details.name}}
Array: {{items[index].properties[key]}}
Filter: {{price|currency|format|default:0}}
Loop: {{#each complex.nested.items}}{{item.data}}{{/each}}
Conditional: {{#if user.permissions.admin && user.active}}{{secret}}{{/if}}
`;

const statsResult = extractor.extract(statsTemplate);
console.log('Statistics:');
console.log(`  Total variables: ${statsResult.statistics.totalVariables}`);
console.log(`  Unique variables: ${statsResult.statistics.uniqueVariables}`);
console.log(`  Complexity score: ${statsResult.statistics.complexityScore}`);
console.log('  By type:');
for (const [type, count] of Object.entries(statsResult.statistics.byType)) {
  console.log(`    ${type}: ${count}`);
}

// Example 9: Documentation generation
console.log('\n=== Example 9: Documentation Generation ===');
const docTemplate = `
{{title|title}}
{{#each articles}}
  {{title}} by {{author.name}}
  {{#if featured}}⭐ Featured{{/if}}
{{/each}}
`;

const docResult = extractor.extract(docTemplate);
const markdown = extractor.generateDocumentation(docResult, {
  format: 'markdown',
  includeExamples: true,
  includeTypes: true,
  includeDependencies: true
});

console.log('Generated documentation (first 300 chars):');
console.log(markdown.substring(0, 300) + '...');

// Example 10: Real-world template
console.log('\n=== Example 10: Real-world Template ===');
const realWorldTemplate = `
<!DOCTYPE html>
<html lang="{{locale|default:'en'}}">
<head>
    <title>{{page.title|title}} - {{site.name}}</title>
    <meta name="description" content="{{page.description|truncate:160}}">
</head>
<body class="{{theme|default:'light'}}">
    <header>
        <h1>{{site.title}}</h1>
        {{#if user.authenticated}}
            <nav>
                <a href="/profile">{{user.profile.displayName}}</a>
                {{#if user.permissions.admin}}
                    <a href="/admin">Admin</a>
                {{/if}}
            </nav>
        {{else}}
            <a href="/login">Login</a>
        {{/if}}
    </header>
    
    <main>
        {{#each posts}}
            <article id="post-{{id}}">
                <h2>{{title}}</h2>
                <p class="meta">
                    By {{author.name}} on {{publishedAt|date:'MMMM D, YYYY'}}
                    {{#if tags.length > 0}}
                        | Tags: {{#each tags}}{{name}}{{#unless @last}}, {{/unless}}{{/each}}
                    {{/if}}
                </p>
                <div class="content">{{content|markdown|safe}}</div>
                {{#if comments.enabled}}
                    <p>{{comments.count}} comments</p>
                {{/if}}
            </article>
        {{/each}}
    </main>
    
    <script>
        window.config = {
            userId: \${user.id},
            theme: \${settings.theme},
            apiUrl: \${api.baseUrl}
        };
    </script>
</body>
</html>
`;

const realWorldResult = extractor.extract(realWorldTemplate);
console.log(`Real-world template analysis:`);
console.log(`  Variables found: ${realWorldResult.variables.length}`);
console.log(`  Unique variables: ${realWorldResult.statistics.uniqueVariables}`);
console.log(`  Complexity score: ${realWorldResult.statistics.complexityScore}`);
console.log(`  Types distribution:`);
for (const [type, variables] of realWorldResult.byType) {
  console.log(`    ${type}: ${variables.length} variables`);
}

if (realWorldResult.errors.length > 0) {
  console.log(`  Errors: ${realWorldResult.errors.length}`);
}
if (realWorldResult.warnings.length > 0) {
  console.log(`  Warnings: ${realWorldResult.warnings.length}`);
}

console.log('\n=== Variable Extractor Demo Complete ===');