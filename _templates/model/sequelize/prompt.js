export default {
  prompt: ({ inquirer }) => {
    return inquirer
      .prompt([
        {
          type: 'input',
          name: 'modelName',
          message: 'What is the model name?',
          validate: (input) => input.length > 0 || 'Model name is required'
        },
        {
          type: 'input',
          name: 'tableName',
          message: 'Table name (leave empty for auto-generated):',
        },
        {
          type: 'input',
          name: 'description',
          message: 'Model description:',
        },
        {
          type: 'confirm',
          name: 'withTimestamps',
          message: 'Include timestamps (createdAt, updatedAt)?',
          default: true
        },
        {
          type: 'confirm',
          name: 'withSoftDeletes',
          message: 'Include soft deletes (deletedAt)?',
          default: false
        },
        {
          type: 'confirm',
          name: 'withVersioning',
          message: 'Include version tracking?',
          default: false
        },
        {
          type: 'confirm',
          name: 'withAssociations',
          message: 'Include model associations?',
          default: false
        },
        {
          type: 'confirm',
          name: 'withPagination',
          message: 'Include pagination helpers?',
          default: true
        },
        {
          type: 'confirm',
          name: 'underscored',
          message: 'Use underscored field names?',
          default: true
        },
        {
          type: 'input',
          name: 'timestamp',
          message: 'Migration timestamp (YYYYMMDDHHMMSS):',
          default: () => new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
        },
        {
          type: 'input',
          name: 'fields',
          message: 'Model fields (JSON format):',
          default: '[{"name": "name", "type": "string", "tsType": "string", "sequelizeType": "STRING", "required": true, "length": 255, "comment": "Entity name"}, {"name": "email", "type": "string", "tsType": "string", "sequelizeType": "STRING", "required": true, "unique": true, "validate": [{"rule": "isEmail", "value": "true"}], "comment": "Email address"}]',
          filter: (input) => {
            try {
              return JSON.parse(input);
            } catch {
              return [];
            }
          }
        },
        {
          type: 'input',
          name: 'indexes',
          message: 'Indexes (JSON format, optional):',
          default: '[]',
          filter: (input) => {
            try {
              return JSON.parse(input);
            } catch {
              return [];
            }
          }
        },
        {
          type: 'input',
          name: 'associations',
          message: 'Associations (JSON format, optional):',
          default: '[]',
          when: (answers) => answers.withAssociations,
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