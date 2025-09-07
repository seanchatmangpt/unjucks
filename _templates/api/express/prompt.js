export default {
  prompt: ({ inquirer }) => {
    return inquirer
      .prompt([
        {
          type: 'input',
          name: 'entityName',
          message: 'What is the entity name (singular)?',
          validate: (input) => input.length > 0 || 'Entity name is required'
        },
        {
          type: 'confirm',
          name: 'withDatabase',
          message: 'Include database integration (Sequelize)?',
          default: true
        },
        {
          type: 'confirm',
          name: 'withAuth',
          message: 'Include authentication middleware?',
          default: true
        },
        {
          type: 'confirm',
          name: 'withValidation',
          message: 'Include request validation (Joi)?',
          default: true
        },
        {
          type: 'confirm',
          name: 'withLogging',
          message: 'Include logging?',
          default: true
        },
        {
          type: 'confirm',
          name: 'withPagination',
          message: 'Include pagination support?',
          default: true
        },
        {
          type: 'confirm',
          name: 'withRateLimit',
          message: 'Include rate limiting?',
          default: false
        },
        {
          type: 'input',
          name: 'fields',
          message: 'Entity fields (JSON format):',
          default: '[{"name": "name", "type": "string", "required": true, "swaggerType": "string", "description": "Entity name", "example": "John Doe", "mockValue": "\'Test Name\'"}, {"name": "email", "type": "string", "required": true, "email": true, "swaggerType": "string", "description": "Email address", "example": "john@example.com", "mockValue": "\'test@example.com\'"}]',
          filter: (input) => {
            try {
              return JSON.parse(input);
            } catch {
              return [];
            }
          }
        }
      ]);
  }
};