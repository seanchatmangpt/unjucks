import { Router } from 'express';
import { {{ endpointName | pascalCase }}Controller } from './{{ endpointName }}.controller.js';
{% if withAuth %}import { authenticate } from '../middleware/auth.middleware.js';{% endif %}
{% if withValidation %}import { validateRequest } from '../middleware/validation.middleware.js';
import { {{ endpointName }}Schemas } from './{{ endpointName }}.validation.js';{% endif %}
import { rateLimiter } from '../middleware/rateLimiter.middleware.js';

const router = Router();
const {{ endpointName }}Controller = new {{ endpointName | pascalCase }}Controller();

{% for method in methods %}{% if method === 'GET' %}// GET /api/{{ resourceName }} - Get all {{ resourceName }}
router.get(
  '/',
  rateLimiter({ windowMs: 15 * 60 * 1000, max: 100 }), // 100 requests per 15 minutes
  {% if withAuth %}authenticate,{% endif %}
  {{ endpointName }}Controller.getAll{{ endpointName | pascalCase }}
);

// GET /api/{{ resourceName }}/:id - Get {{ endpointName }} by ID
router.get(
  '/:id',
  rateLimiter({ windowMs: 15 * 60 * 1000, max: 200 }), // 200 requests per 15 minutes
  {% if withAuth %}authenticate,{% endif %}
  {{ endpointName }}Controller.get{{ endpointName | pascalCase }}ById
);
{% endif %}{% if method === 'POST' %}
// POST /api/{{ resourceName }} - Create new {{ endpointName }}
router.post(
  '/',
  rateLimiter({ windowMs: 15 * 60 * 1000, max: 20 }), // 20 requests per 15 minutes
  {% if withAuth %}authenticate,{% endif %}
  {% if withValidation %}validateRequest({{ endpointName }}Schemas.create),{% endif %}
  {{ endpointName }}Controller.create{{ endpointName | pascalCase }}
);
{% endif %}{% if method === 'PUT' %}
// PUT /api/{{ resourceName }}/:id - Update {{ endpointName }}
router.put(
  '/:id',
  rateLimiter({ windowMs: 15 * 60 * 1000, max: 30 }), // 30 requests per 15 minutes
  {% if withAuth %}authenticate,{% endif %}
  {% if withValidation %}validateRequest({{ endpointName }}Schemas.update),{% endif %}
  {{ endpointName }}Controller.update{{ endpointName | pascalCase }}
);
{% endif %}{% if method === 'PATCH' %}
// PATCH /api/{{ resourceName }}/:id - Partially update {{ endpointName }}
router.patch(
  '/:id',
  rateLimiter({ windowMs: 15 * 60 * 1000, max: 30 }), // 30 requests per 15 minutes
  {% if withAuth %}authenticate,{% endif %}
  {% if withValidation %}validateRequest({{ endpointName }}Schemas.patch),{% endif %}
  {{ endpointName }}Controller.update{{ endpointName | pascalCase }}
);
{% endif %}{% if method === 'DELETE' %}
// DELETE /api/{{ resourceName }}/:id - Delete {{ endpointName }}
router.delete(
  '/:id',
  rateLimiter({ windowMs: 15 * 60 * 1000, max: 10 }), // 10 requests per 15 minutes
  {% if withAuth %}authenticate,{% endif %}
  {{ endpointName }}Controller.delete{{ endpointName | pascalCase }}
);
{% endif %}{% endfor %}

export { router as {{ endpointName }}Routes };