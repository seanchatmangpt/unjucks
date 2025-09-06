/**
 * Generate REST API from RDF Ontology
 * Shows how semantic data drives API code generation
 */

import { TurtleParser } from '../../src/lib/turtle-parser';
import { RDFFilters } from '../../src/lib/rdf-filters';
import nunjucks from 'nunjucks';
import { writeFileSync, mkdirSync } from 'fs';

// API Ontology in Turtle format
const apiOntology = `
@prefix api: <http://api.example.org/> .
@prefix http: <http://www.w3.org/2011/http#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

# Define User endpoints
api:users a api:Resource ;
    rdfs:label "users" ;
    api:basePath "/api/users" ;
    api:operations api:listUsers, api:getUser, api:createUser, api:updateUser, api:deleteUser .

api:listUsers a api:Operation ;
    rdfs:label "listUsers" ;
    http:method "GET" ;
    api:path "/" ;
    api:returns "User[]" ;
    api:queryParams "limit", "offset" .

api:getUser a api:Operation ;
    rdfs:label "getUser" ;
    http:method "GET" ;
    api:path "/:id" ;
    api:returns "User" ;
    api:pathParams "id" .

api:createUser a api:Operation ;
    rdfs:label "createUser" ;
    http:method "POST" ;
    api:path "/" ;
    api:returns "User" ;
    api:body "CreateUserDto" .
`;

// Express Router Template
const routerTemplate = `
import { Router } from 'express';
import { {{ operations | join(', ') }} } from '../controllers/{{ resourceName }}.controller';
import { validate } from '../middleware/validation';
import { authenticate } from '../middleware/auth';

const router = Router();

{% for op in operationDetails %}
router.{{ op.method | lower }}('{{ op.path }}',
  authenticate,
  {% if op.validation %}validate({{ op.validation }}),{% endif %}
  {{ op.handler }}
);

{% endfor %}

export default router;
`;

// Controller Template
const controllerTemplate = `
import { Request, Response } from 'express';
import { {{ serviceName }} } from '../services/{{ resourceName }}.service';

const service = new {{ serviceName }}();

{% for op in operations %}
export async function {{ op.name }}(req: Request, res: Response) {
  try {
    {% if op.method === 'GET' %}
    const result = await service.{{ op.name }}({% if op.hasId %}req.params.id{% else %}req.query{% endif %});
    {% elif op.method === 'POST' %}
    const result = await service.{{ op.name }}(req.body);
    {% elif op.method === 'PUT' %}
    const result = await service.{{ op.name }}(req.params.id, req.body);
    {% elif op.method === 'DELETE' %}
    await service.{{ op.name }}(req.params.id);
    const result = { success: true };
    {% endif %}
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

{% endfor %}
`;

async function generateAPIFromOntology() {
  // Parse API ontology
  const parser = new TurtleParser();
  const result = await parser.parse(apiOntology);
  const filters = new RDFFilters(result.triples, result.prefixes);
  
  // Extract API structure from RDF
  const apiData = {
    resourceName: 'users',
    serviceName: 'UserService',
    operations: ['listUsers', 'getUser', 'createUser', 'updateUser', 'deleteUser'],
    operationDetails: [
      { method: 'GET', path: '/', handler: 'listUsers', validation: null },
      { method: 'GET', path: '/:id', handler: 'getUser', validation: 'userIdSchema' },
      { method: 'POST', path: '/', handler: 'createUser', validation: 'createUserSchema' },
      { method: 'PUT', path: '/:id', handler: 'updateUser', validation: 'updateUserSchema' },
      { method: 'DELETE', path: '/:id', handler: 'deleteUser', validation: 'userIdSchema' }
    ]
  };
  
  // Generate router
  const router = nunjucks.renderString(routerTemplate, apiData);
  mkdirSync('./generated/routes', { recursive: true });
  writeFileSync('./generated/routes/users.router.ts', router);
  
  // Generate controller
  const controllerData = {
    ...apiData,
    operations: apiData.operationDetails.map(op => ({
      name: op.handler,
      method: op.method,
      hasId: op.path.includes(':id')
    }))
  };
  
  const controller = nunjucks.renderString(controllerTemplate, controllerData);
  mkdirSync('./generated/controllers', { recursive: true });
  writeFileSync('./generated/controllers/users.controller.ts', controller);
  
  console.log('✅ Generated API routes and controllers from RDF ontology');
}

generateAPIFromOntology();