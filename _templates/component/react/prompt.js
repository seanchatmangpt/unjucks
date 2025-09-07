export default {
  prompt: ({ inquirer }) => {
    return inquirer
      .prompt([
        {
          type: 'input',
          name: 'componentName',
          message: 'What is the component name?',
          validate: (input) => input.length > 0 || 'Component name is required'
        },
        {
          type: 'input',
          name: 'description',
          message: 'Component description (optional):',
        },
        {
          type: 'confirm',
          name: 'withProps',
          message: 'Include TypeScript props interface?',
          default: true
        },
        {
          type: 'confirm',
          name: 'withState',
          message: 'Include React state management?',
          default: false
        },
        {
          type: 'confirm',
          name: 'withEffect',
          message: 'Include useEffect hook?',
          default: false
        },
        {
          type: 'confirm',
          name: 'withHandlers',
          message: 'Include event handlers?',
          default: false
        },
        {
          type: 'confirm',
          name: 'withStyles',
          message: 'Include CSS modules?',
          default: true
        },
        {
          type: 'confirm',
          name: 'withTests',
          message: 'Include test files?',
          default: true
        },
        {
          type: 'confirm',
          name: 'withTestId',
          message: 'Include test data attributes?',
          default: true
        },
        {
          type: 'input',
          name: 'properties',
          message: 'Component properties (JSON format):',
          default: '[{"name": "title", "type": "string", "required": true, "testValue": "Test Title"}, {"name": "count", "type": "number", "required": false, "defaultValue": "0", "testValue": "5"}]',
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