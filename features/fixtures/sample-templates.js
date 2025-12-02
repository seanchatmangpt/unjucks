/**
 * Sample Templates for Git Attestation Testing
 * 
 * Provides template hierarchies and content for comprehensive testing
 * of git-integrated provenance and attestation scenarios.
 */

export const TEMPLATE_HIERARCHIES = {
  /**
   * Basic component hierarchy
   */
  basic_component: [
    {
      name: 'base.njk',
      extends: null,
      content: `
<!DOCTYPE html>
<html>
<head>
  <title>{{title | default("KGEN Generated")}}</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  {% block head %}{% endblock %}
</head>
<body>
  <div class="app">
    {% block content %}{% endblock %}
  </div>
  {% block scripts %}{% endblock %}
</body>
</html>
      `.trim()
    },
    {
      name: 'layout.njk',
      extends: 'base.njk',
      content: `
{% extends "base.njk" %}

{% block head %}
<link rel="stylesheet" href="/styles/main.css">
{% endblock %}

{% block content %}
<header class="header">
  <h1>{{siteName | default("KGEN Site")}}</h1>
  <nav>
    {% for item in navigation | default([]) %}
    <a href="{{item.url}}">{{item.title}}</a>
    {% endfor %}
  </nav>
</header>

<main class="main">
  {% block main %}{% endblock %}
</main>

<footer class="footer">
  <p>&copy; {{currentYear}} {{siteName | default("KGEN Site")}}</p>
</footer>
{% endblock %}

{% block scripts %}
<script src="/scripts/main.js"></script>
{% endblock %}
      `.trim()
    },
    {
      name: 'page.njk',
      extends: 'layout.njk',
      content: `
{% extends "layout.njk" %}

{% block main %}
<article class="page">
  <header class="page-header">
    <h1>{{pageTitle | default(title)}}</h1>
    {% if subtitle %}
    <p class="subtitle">{{subtitle}}</p>
    {% endif %}
  </header>
  
  <div class="page-content">
    {% block pageContent %}
    <p>{{content | default("Page content goes here.")}}</p>
    {% endblock %}
  </div>
  
  {% if showMetadata %}
  <aside class="page-meta">
    <dl>
      <dt>Created</dt>
      <dd>{{createdDate | date}}</dd>
      <dt>Modified</dt>
      <dd>{{modifiedDate | date}}</dd>
      <dt>Author</dt>
      <dd>{{author | default("Unknown")}}</dd>
    </dl>
  </aside>
  {% endif %}
</article>
{% endblock %}
      `.trim()
    }
  ],

  /**
   * React component hierarchy
   */
  react_components: [
    {
      name: 'react-base.njk',
      extends: null,
      content: `
import React{% if withTypes %}, { {{ componentInterfaces | join(', ') }} }{% endif %} from 'react';

{% block imports %}{% endblock %}

{% block interfaces %}
interface {{componentName}}Props {
  {% for prop in componentProps | default([]) %}
  {{prop.name}}{% if prop.optional %}?{% endif %}: {{prop.type}};
  {% endfor %}
}
{% endblock %}

{% block component %}
export const {{componentName}}: React.FC<{{componentName}}Props> = ({% raw %}{
  {% for prop in componentProps | default([]) %}{{prop.name}}{% if prop.defaultValue %} = {{prop.defaultValue}}{% endif %}{% if not loop.last %}, {% endif %}{% endfor %}
}{% endraw %}) => {
  {% block componentBody %}
  return (
    <div className="{{componentName | lower}}">
      {/* Component content */}
    </div>
  );
  {% endblock %}
};
{% endblock %}

{% block exports %}
export default {{componentName}};
{% endblock %}
      `.trim()
    },
    {
      name: 'interactive-component.njk', 
      extends: 'react-base.njk',
      content: `
{% extends "react-base.njk" %}

{% block imports %}
import { useState, useCallback } from 'react';
{% if withStyling %}
import styles from './{{componentName}}.module.css';
{% endif %}
{% endblock %}

{% block componentBody %}
const [state, setState] = useState({{initialState | default('{}') | safe}});

{% for handler in eventHandlers | default([]) %}
const handle{{handler.name | capitalize}} = useCallback(({{handler.params | default('') | safe}}) => {
  {{handler.implementation | default('// Handler implementation') | safe}}
}, [{{handler.dependencies | default([]) | join(', ')}}]);
{% endfor %}

return (
  <div className={% raw %}{{{% endraw %}{% if withStyling %}styles.{{componentName | lower}}{% else %}"{{componentName | lower}}"{% endif %}{% raw %}}{% endraw %}>
    {% block interactiveContent %}
    <h2>{{title | default(componentName)}}</h2>
    <div className="content">
      {/* Interactive content goes here */}
    </div>
    {% endblock %}
  </div>
);
{% endblock %}
      `.trim()
    },
    {
      name: 'button.njk',
      extends: 'interactive-component.njk',
      content: `
{% extends "interactive-component.njk" %}

{% block interactiveContent %}
<button
  type="{{buttonType | default('button')}}"
  className={% raw %}{{{% endraw %}[
    {% if withStyling %}styles.button{% else %}'button'{% endif %},
    {% if variant %}{% if withStyling %}styles['button--{{variant}}']{% else %}'button--{{variant}}'{% endif %}{% endif %},
    {% if size %}{% if withStyling %}styles['button--{{size}}']{% else %}'button--{{size}}'{% endif %}{% endif %},
    disabled && {% if withStyling %}styles['button--disabled']{% else %}'button--disabled'{% endif %}
  ].filter(Boolean).join(' '){% raw %}}{% endraw %}
  onClick={handleClick}
  disabled={disabled}
  {% if ariaLabel %}aria-label="{{ariaLabel}}"{% endif %}
  {% for attr in additionalAttributes | default([]) %}
  {{attr.name}}="{{attr.value}}"
  {% endfor %}
>
  {% if withIcon && iconPosition === 'left' %}
  <span className={% raw %}{{{% endraw %}{% if withStyling %}styles.icon{% else %}'button-icon'{% endif %}{% raw %}}{% endraw %}>{{icon | safe}}</span>
  {% endif %}
  
  <span className={% raw %}{{{% endraw %}{% if withStyling %}styles.label{% else %}'button-label'{% endif %}{% raw %}}{% endraw %}>
    {children || "{{label | default('Button')}}"}
  </span>
  
  {% if withIcon && iconPosition === 'right' %}
  <span className={% raw %}{{{% endraw %}{% if withStyling %}styles.icon{% else %}'button-icon'{% endif %}{% raw %}}{% endraw %}>{{icon | safe}}</span>
  {% endif %}
</button>
{% endblock %}
      `.trim()
    }
  ],

  /**
   * API service templates
   */
  api_services: [
    {
      name: 'service-base.njk',
      extends: null,
      content: `
{% if withTypes %}import { {{ serviceInterfaces | join(', ') }} } from './types';{% endif %}
{% if withValidation %}import { validateInput, validateOutput } from './validation';{% endif %}
{% if withLogging %}import { logger } from '../utils/logger';{% endif %}
{% if withCache %}import { cache } from '../utils/cache';{% endif %}

/**
 * {{serviceName}} - {{description | default('Generated service')}}
 * 
 * Generated by KGEN v{{kgenVersion | default('2.0.0')}}
 * Template: {{templateName}}
 * Generated: {{generatedDate | default(now | date)}}
 */

export class {{serviceName}} {
  {% if withConfig %}
  private config: {{configInterface | default('ServiceConfig')}};
  {% endif %}
  
  {% if withHTTPClient %}
  private httpClient: {{httpClientType | default('HttpClient')}};
  {% endif %}

  constructor({% if withConfig %}config: {{configInterface | default('ServiceConfig')}}{% endif %}) {
    {% if withConfig %}
    this.config = config;
    {% endif %}
    
    {% if withHTTPClient %}
    this.httpClient = new {{httpClientType | default('HttpClient')}}({
      baseURL: {% if withConfig %}this.config.baseURL{% else %}'{{baseURL | default('/api')}}'{% endif %},
      timeout: {% if withConfig %}this.config.timeout{% else %}{{timeout | default(5000)}}{% endif %}
    });
    {% endif %}
    
    {% if withLogging %}
    logger.info('{{serviceName}} initialized');
    {% endif %}
  }

  {% block methods %}{% endblock %}
}

{% block exports %}
export default {{serviceName}};
{% endblock %}
      `.trim()
    },
    {
      name: 'rest-service.njk',
      extends: 'service-base.njk', 
      content: `
{% extends "service-base.njk" %}

{% block methods %}
{% for endpoint in endpoints | default([]) %}
/**
 * {{endpoint.description | default('API endpoint')}}
 * @param {{"{"}}{{endpoint.paramTypes | join(', ')}}{{"}"}}} params - Request parameters
 * @returns {{"{"}}Promise<{{endpoint.returnType | default('any')}}>{{"}"}}} Response data
 */
async {{endpoint.name}}({% if endpoint.params %}{{endpoint.params | join(', ')}}{% endif %}): Promise<{{endpoint.returnType | default('any')}}> {
  {% if withLogging %}
  logger.debug('{{serviceName}}.{{endpoint.name}} called', { {% if endpoint.params %}{{endpoint.params | join(', ')}}{% endif %} });
  {% endif %}
  
  {% if withValidation && endpoint.validation %}
  const validationResult = validateInput('{{endpoint.name}}', { {% if endpoint.params %}{{endpoint.params | join(', ')}}{% endif %} });
  if (!validationResult.valid) {
    throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
  }
  {% endif %}
  
  {% if withCache && endpoint.cacheable %}
  const cacheKey = `{{serviceName}}.{{endpoint.name}}.${JSON.stringify({ {% if endpoint.params %}{{endpoint.params | join(', ')}}{% endif %} })}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    {% if withLogging %}
    logger.debug('Returning cached result for {{endpoint.name}}');
    {% endif %}
    return cached;
  }
  {% endif %}

  try {
    const response = await this.httpClient.{{endpoint.method | lower}}('{{endpoint.path}}'{% if endpoint.method === 'POST' or endpoint.method === 'PUT' or endpoint.method === 'PATCH' %}, { {% if endpoint.bodyParams %}{{endpoint.bodyParams | join(', ')}}{% endif %} }{% endif %});
    
    {% if withValidation && endpoint.responseValidation %}
    const validatedResponse = validateOutput('{{endpoint.name}}', response.data);
    if (!validatedResponse.valid) {
      throw new Error(`Response validation failed: ${validatedResponse.errors.join(', ')}`);
    }
    {% endif %}
    
    {% if withCache && endpoint.cacheable %}
    await cache.set(cacheKey, response.data, {{endpoint.cacheTimeout | default(300000)}});
    {% endif %}
    
    return response.data;
  } catch (error) {
    {% if withLogging %}
    logger.error('{{serviceName}}.{{endpoint.name}} failed', { error: error.message, {% if endpoint.params %}{{endpoint.params | join(', ')}}{% endif %} });
    {% endif %}
    throw error;
  }
}

{% endfor %}
{% endblock %}
      `.trim()
    }
  ],

  /**
   * Configuration file templates
   */
  config_files: [
    {
      name: 'config-base.njk',
      extends: null,
      content: `
{
  "name": "{{projectName | default('kgen-project')}}",
  "version": "{{version | default('1.0.0')}}",
  "description": "{{description | default('Generated by KGEN')}}",
  
  {% if withGitInfo %}
  "repository": {
    "type": "git",
    "url": "{{gitUrl | default('https://github.com/user/repo.git')}}"
  },
  {% endif %}
  
  {% if withAuthor %}
  "author": {
    "name": "{{authorName | default('Developer')}}",
    "email": "{{authorEmail | default('dev@example.com')}}",
    "url": "{{authorUrl | default('')}}"
  },
  {% endif %}
  
  {% if withLicense %}
  "license": "{{license | default('MIT')}}",
  {% endif %}
  
  {% block configContent %}{% endblock %}
  
  "kgen": {
    "version": "{{kgenVersion | default('2.0.0')}}",
    "generated": "{{generatedDate | default(now | date)}}",
    "template": "{{templateName}}"
  }
}
      `.trim()
    },
    {
      name: 'package-json.njk', 
      extends: 'config-base.njk',
      content: `
{% extends "config-base.njk" %}

{% block configContent %}
"main": "{{mainFile | default('index.js')}}",
"types": "{{typesFile | default('index.d.ts')}}",

"scripts": {
  {% for script in scripts | default([]) %}
  "{{script.name}}": "{{script.command}}"{% if not loop.last %},{% endif %}
  {% endfor %}
},

{% if dependencies | length > 0 %}
"dependencies": {
  {% for dep in dependencies %}
  "{{dep.name}}": "{{dep.version}}"{% if not loop.last %},{% endif %}
  {% endfor %}
},
{% endif %}

{% if devDependencies | length > 0 %}
"devDependencies": {
  {% for dep in devDependencies %}
  "{{dep.name}}": "{{dep.version}}"{% if not loop.last %},{% endif %}
  {% endfor %}
},
{% endif %}

{% if withEngines %}
"engines": {
  "node": "{{nodeVersion | default('>=16.0.0')}}",
  "npm": "{{npmVersion | default('>=8.0.0')}}"
},
{% endif %}

"keywords": [
  {% for keyword in keywords | default(['kgen', 'generated']) %}
  "{{keyword}}"{% if not loop.last %},{% endif %}
  {% endfor %}
]
{% endblock %}
      `.trim()
    }
  ]
};

export const SAMPLE_VARIABLES = {
  react_button: {
    componentName: 'Button',
    withTypes: true,
    componentInterfaces: ['ButtonHTMLAttributes'],
    componentProps: [
      { name: 'children', type: 'React.ReactNode', optional: true },
      { name: 'variant', type: "'primary' | 'secondary' | 'danger'", optional: true, defaultValue: "'primary'" },
      { name: 'size', type: "'small' | 'medium' | 'large'", optional: true, defaultValue: "'medium'" },
      { name: 'disabled', type: 'boolean', optional: true, defaultValue: 'false' },
      { name: 'onClick', type: '(event: React.MouseEvent<HTMLButtonElement>) => void', optional: true }
    ],
    withStyling: true,
    withIcon: true,
    iconPosition: 'left',
    eventHandlers: [
      {
        name: 'click',
        params: 'event: React.MouseEvent<HTMLButtonElement>',
        implementation: 'onClick?.(event);',
        dependencies: ['onClick']
      }
    ],
    initialState: '{}',
    buttonType: 'button',
    label: 'Click me'
  },
  
  user_service: {
    serviceName: 'UserService',
    description: 'Service for managing user data',
    withTypes: true,
    withValidation: true,
    withLogging: true,
    withCache: true,
    withConfig: true,
    withHTTPClient: true,
    serviceInterfaces: ['User', 'CreateUserRequest', 'UpdateUserRequest'],
    configInterface: 'UserServiceConfig',
    httpClientType: 'AxiosInstance',
    baseURL: '/api/users',
    timeout: 10000,
    endpoints: [
      {
        name: 'getUser',
        method: 'GET',
        path: '/{id}',
        params: ['id: string'],
        paramTypes: ['string'],
        returnType: 'User',
        description: 'Get user by ID',
        validation: true,
        responseValidation: true,
        cacheable: true,
        cacheTimeout: 300000
      },
      {
        name: 'createUser',
        method: 'POST',
        path: '/',
        params: ['data: CreateUserRequest'],
        bodyParams: ['data'],
        paramTypes: ['CreateUserRequest'],
        returnType: 'User', 
        description: 'Create new user',
        validation: true,
        responseValidation: true
      },
      {
        name: 'updateUser',
        method: 'PUT',
        path: '/{id}',
        params: ['id: string', 'data: UpdateUserRequest'],
        bodyParams: ['data'],
        paramTypes: ['string', 'UpdateUserRequest'],
        returnType: 'User',
        description: 'Update existing user',
        validation: true,
        responseValidation: true
      }
    ]
  },
  
  project_package: {
    projectName: 'my-kgen-project',
    version: '1.0.0',
    description: 'A project generated with KGEN templates',
    withGitInfo: true,
    gitUrl: 'https://github.com/user/my-kgen-project.git',
    withAuthor: true,
    authorName: 'Developer Name',
    authorEmail: 'dev@example.com',
    authorUrl: 'https://developer.example.com',
    withLicense: true,
    license: 'MIT',
    mainFile: 'dist/index.js',
    typesFile: 'dist/index.d.ts',
    scripts: [
      { name: 'build', command: 'tsc' },
      { name: 'test', command: 'jest' },
      { name: 'lint', command: 'eslint src/' },
      { name: 'start', command: 'node dist/index.js' }
    ],
    dependencies: [
      { name: 'react', version: '^18.0.0' },
      { name: 'axios', version: '^1.0.0' }
    ],
    devDependencies: [
      { name: 'typescript', version: '^5.0.0' },
      { name: 'jest', version: '^29.0.0' },
      { name: 'eslint', version: '^8.0.0' }
    ],
    withEngines: true,
    nodeVersion: '>=18.0.0',
    npmVersion: '>=9.0.0',
    keywords: ['react', 'typescript', 'kgen', 'generated']
  }
};

export const ARTIFACT_EXPECTATIONS = {
  button_tsx: {
    fileName: 'Button.tsx',
    expectedContent: [
      'import React',
      'interface ButtonProps',
      'export const Button',
      'React.FC<ButtonProps>',
      'onClick',
      'disabled',
      'variant'
    ],
    expectedLines: 25,
    templateName: 'button.njk'
  },
  
  user_service_ts: {
    fileName: 'UserService.ts', 
    expectedContent: [
      'export class UserService',
      'async getUser',
      'async createUser', 
      'async updateUser',
      'validateInput',
      'logger.debug',
      'cache.get'
    ],
    expectedLines: 80,
    templateName: 'rest-service.njk'
  },
  
  package_json: {
    fileName: 'package.json',
    expectedContent: [
      '"name": "my-kgen-project"',
      '"scripts"',
      '"dependencies"',
      '"devDependencies"',
      '"kgen"'
    ],
    expectedLines: 35,
    templateName: 'package-json.njk'
  }
};

export default { TEMPLATE_HIERARCHIES, SAMPLE_VARIABLES, ARTIFACT_EXPECTATIONS };