import { Request, Response, NextFunction } from 'express';
{% if withDatabase %}import { {{ endpointName | pascalCase }}Service } from './{{ endpointName }}.service.js';{% endif %}
{% if withValidation %}import { validate{{ endpointName | pascalCase }}Request } from './{{ endpointName }}.validation.js';{% endif %}
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export class {{ endpointName | pascalCase }}Controller {
  {% if withDatabase %}private {{ endpointName }}Service: {{ endpointName | pascalCase }}Service;

  constructor() {
    this.{{ endpointName }}Service = new {{ endpointName | pascalCase }}Service();
  }
  {% endif %}

  {% for method in methods %}{% if method === 'GET' %}/**
   * Get all {{ resourceName }}
   * @route GET /api/{{ resourceName }}
   */
  public getAll{{ endpointName | pascalCase }} = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const { page = 1, limit = 10, ...filters } = req.query;
      
      {% if withDatabase %}const result = await this.{{ endpointName }}Service.findAll({
        page: Number(page),
        limit: Number(limit),
        filters
      });{% else %}// TODO: Implement data fetching logic
      const result = {
        data: [],
        total: 0,
        page: Number(page),
        limit: Number(limit)
      };{% endif %}

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          pages: Math.ceil(result.total / result.limit)
        }
      });
    }
  );

  /**
   * Get {{ resourceName }} by ID
   * @route GET /api/{{ resourceName }}/:id
   */
  public get{{ endpointName | pascalCase }}ById = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const { id } = req.params;

      {% if withDatabase %}const {{ endpointName }} = await this.{{ endpointName }}Service.findById(id);
      
      if (!{{ endpointName }}) {
        throw new ApiError(404, '{{ endpointName | pascalCase }} not found');
      }{% else %}// TODO: Implement find by ID logic
      const {{ endpointName }} = null;
      
      if (!{{ endpointName }}) {
        throw new ApiError(404, '{{ endpointName | pascalCase }} not found');
      }{% endif %}

      res.status(200).json({
        success: true,
        data: {{ endpointName }}
      });
    }
  );
  {% endif %}{% if method === 'POST' %}
  /**
   * Create new {{ endpointName }}
   * @route POST /api/{{ resourceName }}
   */
  public create{{ endpointName | pascalCase }} = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      {% if withValidation %}// Validate request body
      const validatedData = validate{{ endpointName | pascalCase }}Request(req.body);
      {% endif %}
      
      {% if withDatabase %}const new{{ endpointName | pascalCase }} = await this.{{ endpointName }}Service.create({% if withValidation %}validatedData{% else %}req.body{% endif %});{% else %}// TODO: Implement creation logic
      const new{{ endpointName | pascalCase }} = {% if withValidation %}validatedData{% else %}req.body{% endif %};{% endif %}

      res.status(201).json({
        success: true,
        data: new{{ endpointName | pascalCase }},
        message: '{{ endpointName | pascalCase }} created successfully'
      });
    }
  );
  {% endif %}{% if method === 'PUT' %}
  /**
   * Update {{ endpointName }} by ID
   * @route PUT /api/{{ resourceName }}/:id
   */
  public update{{ endpointName | pascalCase }} = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const { id } = req.params;
      {% if withValidation %}const validatedData = validate{{ endpointName | pascalCase }}Request(req.body, false);
      {% endif %}

      {% if withDatabase %}const updated{{ endpointName | pascalCase }} = await this.{{ endpointName }}Service.update(id, {% if withValidation %}validatedData{% else %}req.body{% endif %});
      
      if (!updated{{ endpointName | pascalCase }}) {
        throw new ApiError(404, '{{ endpointName | pascalCase }} not found');
      }{% else %}// TODO: Implement update logic
      const updated{{ endpointName | pascalCase }} = { id, ...{% if withValidation %}validatedData{% else %}req.body{% endif %} };{% endif %}

      res.status(200).json({
        success: true,
        data: updated{{ endpointName | pascalCase }},
        message: '{{ endpointName | pascalCase }} updated successfully'
      });
    }
  );
  {% endif %}{% if method === 'DELETE' %}
  /**
   * Delete {{ endpointName }} by ID
   * @route DELETE /api/{{ resourceName }}/:id
   */
  public delete{{ endpointName | pascalCase }} = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const { id } = req.params;

      {% if withDatabase %}const deleted{{ endpointName | pascalCase }} = await this.{{ endpointName }}Service.delete(id);
      
      if (!deleted{{ endpointName | pascalCase }}) {
        throw new ApiError(404, '{{ endpointName | pascalCase }} not found');
      }{% else %}// TODO: Implement deletion logic
      const deleted{{ endpointName | pascalCase }} = true;{% endif %}

      res.status(200).json({
        success: true,
        message: '{{ endpointName | pascalCase }} deleted successfully'
      });
    }
  );
  {% endif %}{% endfor %}
}