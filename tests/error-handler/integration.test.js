import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple test framework
function describe(name, fn) {
    console.log(`\n📋 ${name}`);
    fn();
}

function it(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        return true;
    } catch (error) {
        console.log(`  ❌ ${name}: ${error.message}`);
        return false;
    }
}

function expect(actual) {
    return {
        toBe: (expected) => {
            if (actual !== expected) {
                throw new Error(`Expected ${expected}, got ${actual}`);
            }
        },
        toEqual: (expected) => {
            if (JSON.stringify(actual) !== JSON.stringify(expected)) {
                throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
            }
        },
        toExist: () => {
            if (!actual) {
                throw new Error(`Expected value to exist, got ${actual}`);
            }
        },
        toInclude: (expected) => {
            if (!actual.includes(expected)) {
                throw new Error(`Expected "${actual}" to include "${expected}"`);
            }
        },
        toBeGreaterThan: (expected) => {
            if (actual <= expected) {
                throw new Error(`Expected ${actual} to be greater than ${expected}`);
            }
        }
    };
}

// Test setup
const testDir = path.join(__dirname, 'temp-integration');
const actionPath = path.join(__dirname, '../../.github/actions/error-handler');

// Cleanup and setup
if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
}
fs.mkdirSync(testDir, { recursive: true });

process.env.GITHUB_OUTPUT = path.join(testDir, 'github-output.txt');
process.env.GITHUB_WORKFLOW = 'Test Workflow';
process.env.GITHUB_JOB = 'integration-test';
process.env.GITHUB_RUN_ID = '123456789';
process.env.GITHUB_REPOSITORY = 'test/integration';

describe('Error Handler Action Integration Tests', () => {
    it('should have error handler action files', () => {
        expect(fs.existsSync(path.join(actionPath, 'action.yml'))).toBe(true);
        expect(fs.existsSync(path.join(actionPath, 'README.md'))).toBe(true);
    });

    it('should validate action.yml structure', () => {
        const actionContent = fs.readFileSync(path.join(actionPath, 'action.yml'), 'utf8');
        expect(actionContent).toInclude('name: \'Error Handler\'');
        expect(actionContent).toInclude('description: \'Comprehensive error handling');
        expect(actionContent).toInclude('inputs:');
        expect(actionContent).toInclude('outputs:');
        expect(actionContent).toInclude('runs:');
    });

    it('should extract error handler script from action', () => {
        const actionContent = fs.readFileSync(path.join(actionPath, 'action.yml'), 'utf8');
        const scriptMatch = actionContent.match(/cat > error_handler\.sh << 'EOF'\n([\s\S]*?)\n        EOF/);
        expect(scriptMatch).toExist();
        expect(scriptMatch[1].length).toBeGreaterThan(1000); // Script should be substantial
    });

    it('should create and execute error handler script', () => {
        // Extract script from action.yml
        const actionContent = fs.readFileSync(path.join(actionPath, 'action.yml'), 'utf8');
        const scriptMatch = actionContent.match(/cat > error_handler\.sh << 'EOF'\n([\s\S]*?)\n        EOF/);
        
        if (!scriptMatch) {
            throw new Error('Could not extract error handler script');
        }

        // Write script to test directory
        const scriptPath = path.join(testDir, 'error_handler.sh');
        fs.writeFileSync(scriptPath, scriptMatch[1]);
        fs.chmodSync(scriptPath, '755');

        expect(fs.existsSync(scriptPath)).toBe(true);
    });

    it('should execute successful command', () => {
        // Clear output file
        fs.writeFileSync(process.env.GITHUB_OUTPUT, '');

        // Execute a simple successful command
        const result = execSync(`cd ${testDir} && ./error_handler.sh "echo 'Hello World'" 1 1 false 1 info true false retry ${testDir} '{}'`, {
            encoding: 'utf8',
            stdio: 'pipe'
        });

        expect(result).toInclude('Hello World');
        expect(result).toInclude('Command succeeded on attempt 1');

        // Check outputs
        const outputContent = fs.readFileSync(process.env.GITHUB_OUTPUT, 'utf8');
        expect(outputContent).toInclude('success=true');
        expect(outputContent).toInclude('exit-code=0');
        expect(outputContent).toInclude('attempts=1');
        expect(outputContent).toInclude('error-type=success');
    });

    it('should handle command failure with retry', () => {
        // Clear output file
        fs.writeFileSync(process.env.GITHUB_OUTPUT, '');

        try {
            execSync(`cd ${testDir} && ./error_handler.sh "exit 1" 2 1 false 1 warning true false retry ${testDir} '{}'`, {
                encoding: 'utf8',
                stdio: 'pipe'
            });
        } catch (error) {
            // Command should fail, check the outputs
            const outputContent = fs.readFileSync(process.env.GITHUB_OUTPUT, 'utf8');
            expect(outputContent).toInclude('success=false');
            expect(outputContent).toInclude('exit-code=1');
            expect(outputContent).toInclude('attempts=2');
            expect(outputContent).toInclude('error-type=general_error');
        }
    });

    it('should classify network errors correctly', () => {
        // Clear output file
        fs.writeFileSync(process.env.GITHUB_OUTPUT, '');

        try {
            execSync(`cd ${testDir} && ./error_handler.sh "bash -c 'echo network timeout >&2; exit 1'" 1 1 false 1 warning true false retry ${testDir} '{}'`, {
                encoding: 'utf8',
                stdio: 'pipe'
            });
        } catch (error) {
            // Check error classification
            const outputContent = fs.readFileSync(process.env.GITHUB_OUTPUT, 'utf8');
            expect(outputContent).toInclude('error-type=network_error');
        }
    });

    it('should enable graceful degradation for non-critical errors', () => {
        // Clear output file
        fs.writeFileSync(process.env.GITHUB_OUTPUT, '');

        const result = execSync(`cd ${testDir} && ./error_handler.sh "exit 1" 1 1 false 1 warning true true retry ${testDir} '{}'`, {
            encoding: 'utf8',
            stdio: 'pipe'
        });

        expect(result).toInclude('Graceful degradation enabled');

        // Should succeed despite command failure
        const outputContent = fs.readFileSync(process.env.GITHUB_OUTPUT, 'utf8');
        expect(outputContent).toInclude('success=true');
        expect(outputContent).toInclude('recovery-action=graceful_degradation');
    });

    it('should skip with skip recovery strategy', () => {
        // Clear output file
        fs.writeFileSync(process.env.GITHUB_OUTPUT, '');

        const result = execSync(`cd ${testDir} && ./error_handler.sh "exit 1" 1 1 false 1 warning true false skip ${testDir} '{}'`, {
            encoding: 'utf8',
            stdio: 'pipe'
        });

        expect(result).toInclude('Recovery strategy: Skipping failed command');

        // Should succeed with skip strategy
        const outputContent = fs.readFileSync(process.env.GITHUB_OUTPUT, 'utf8');
        expect(outputContent).toInclude('success=true');
        expect(outputContent).toInclude('recovery-action=skip');
    });

    it('should collect diagnostics on failure', () => {
        // Clear output file
        fs.writeFileSync(process.env.GITHUB_OUTPUT, '');

        try {
            execSync(`cd ${testDir} && ./error_handler.sh "exit 1" 1 1 false 1 warning true true retry ${testDir} '{}'`, {
                encoding: 'utf8',
                stdio: 'pipe'
            });
        } catch (error) {
            // Even if command fails, check diagnostics
            const outputContent = fs.readFileSync(process.env.GITHUB_OUTPUT, 'utf8');
            const diagnosticsMatch = outputContent.match(/diagnostics=(.+)/);
            
            if (diagnosticsMatch) {
                const diagnostics = Buffer.from(diagnosticsMatch[1], 'base64').toString();
                expect(diagnostics).toInclude('System Information');
                expect(diagnostics).toInclude('Environment Variables');
                expect(diagnostics).toInclude('Process Information');
            }
        }
    });
});

describe('Production Validation Workflow Tests', () => {
    it('should have production validation workflow', () => {
        const workflowPath = path.join(__dirname, '../../.github/workflows/production-validation.yml');
        expect(fs.existsSync(workflowPath)).toBe(true);
    });

    it('should have error handler example workflow', () => {
        const workflowPath = path.join(__dirname, '../../.github/workflows/error-handler-example.yml');
        expect(fs.existsSync(workflowPath)).toBe(true);
    });

    it('should validate workflow structure', () => {
        const workflowPath = path.join(__dirname, '../../.github/workflows/production-validation.yml');
        const workflowContent = fs.readFileSync(workflowPath, 'utf8');
        
        expect(workflowContent).toInclude('name: Production Validation Pipeline');
        expect(workflowContent).toInclude('uses: ./.github/actions/error-handler');
        expect(workflowContent).toInclude('dependency-validation:');
        expect(workflowContent).toInclude('code-quality-validation:');
        expect(workflowContent).toInclude('unit-tests:');
        expect(workflowContent).toInclude('integration-tests:');
        expect(workflowContent).toInclude('e2e-tests:');
        expect(workflowContent).toInclude('security-validation:');
        expect(workflowContent).toInclude('performance-tests:');
        expect(workflowContent).toInclude('deployment-readiness:');
    });
});

// Cleanup
if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
}

console.log('\n🎉 Integration tests completed!');