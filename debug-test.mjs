import { TestHelper } from './tests/support/TestHelper.js';

const helper = new TestHelper(process.cwd());

console.log('Testing TestHelper CLI execution...');

try {
  const result = await helper.executeCommand('node dist/cli.mjs --version');
  console.log('TestHelper result:', {
    exitCode: result.exitCode,
    stdout: JSON.stringify(result.stdout),
    stderr: JSON.stringify(result.stderr),
    duration: result.duration
  });
} catch (error) {
  console.error('TestHelper error:', error);
}

console.log('Testing TestHelper runCli method...');

try {
  const result2 = await helper.runCli('unjucks --version');
  console.log('TestHelper runCli result:', {
    exitCode: result2.exitCode,
    stdout: JSON.stringify(result2.stdout),
    stderr: JSON.stringify(result2.stderr),
    duration: result2.duration
  });
} catch (error) {
  console.error('TestHelper runCli error:', error);
}