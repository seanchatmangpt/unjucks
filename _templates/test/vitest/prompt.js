export default {
  prompt: ({ inquirer }) => {
    return inquirer
      .prompt([
        {
          type: 'input',
          name: 'testName',
          message: 'What is the test name?',
          validate: (input) => input.length > 0 || 'Test name is required'
        },
        {
          type: 'input',
          name: 'testSubject',
          message: 'What is being tested (class/function name)?',
          validate: (input) => input.length > 0 || 'Test subject is required'
        },
        {
          type: 'input',
          name: 'description',
          message: 'Test description:',
        },
        {
          type: 'list',
          name: 'testType',
          message: 'Test type:',
          choices: ['unit', 'integration'],
          default: 'unit'
        },
        {
          type: 'confirm',
          name: 'withSetup',
          message: 'Include setup and teardown?',
          default: true
        },
        {
          type: 'confirm',
          name: 'withMocks',
          message: 'Include mocking support?',
          default: false
        },
        {
          type: 'confirm',
          name: 'withAsync',
          message: 'Include async/await tests?',
          default: true
        },
        {
          type: 'confirm',
          name: 'withPerformance',
          message: 'Include performance tests?',
          default: false
        },
        {
          type: 'confirm',
          name: 'withHappyPath',
          message: 'Include happy path scenarios?',
          default: true
        },
        {
          type: 'confirm',
          name: 'withErrorHandling',
          message: 'Include error handling tests?',
          default: true
        },
        {
          type: 'confirm',
          name: 'withEdgeCases',
          message: 'Include edge case tests?',
          default: true
        },
        {
          type: 'confirm',
          name: 'withBusinessLogic',
          message: 'Include business logic validation?',
          default: false
        },
        {
          type: 'confirm',
          name: 'withDataValidation',
          message: 'Include data validation tests?',
          default: false
        },
        // Integration test specific questions
        {
          type: 'confirm',
          name: 'withDatabase',
          message: 'Include database integration?',
          default: false,
          when: (answers) => answers.testType === 'integration'
        },
        {
          type: 'confirm',
          name: 'withApi',
          message: 'Include API testing?',
          default: true,
          when: (answers) => answers.testType === 'integration'
        },
        {
          type: 'confirm',
          name: 'withAuth',
          message: 'Include authentication testing?',
          default: false,
          when: (answers) => answers.testType === 'integration'
        },
        {
          type: 'input',
          name: 'imports',
          message: 'Imports (JSON format):',
          default: '[{"exports": ["YourClass"], "from": "../src/YourClass"}]',
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