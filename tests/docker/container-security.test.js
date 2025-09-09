/**
 * Container Security and Isolation Verification Tests
 * Validates security configurations and container isolation
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('Container Security and Isolation', () => {
  const testContainerName = 'unjucks-security-test';
  const testImageName = 'unjucks:test';
  
  beforeAll(async () => {
    // Ensure test image exists
    try {
      await execAsync(`docker image inspect ${testImageName}`);
    } catch (error) {
      throw new Error('Test image not found. Run docker-environment-setup tests first.');
    }
  });

  afterAll(async () => {
    try {
      execSync(`docker stop ${testContainerName} 2>/dev/null || true`, { stdio: 'pipe' });
      execSync(`docker rm ${testContainerName} 2>/dev/null || true`, { stdio: 'pipe' });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should enforce security constraints', async () => {
    const securityCommand = `docker run --rm --name ${testContainerName}-security ` +
      `--security-opt=no-new-privileges --user=1000:1000 ` +
      `--cap-drop=ALL --cap-add=SETUID --cap-add=SETGID ` +
      `${testImageName} sh -c "
        echo 'Testing privilege escalation:';
        su - root 2>&1 || echo 'BLOCKED: Cannot escalate to root';
        echo 'Testing file system permissions:';
        touch /test-write 2>&1 || echo 'BLOCKED: Cannot write to root filesystem';
        echo 'Testing capability restrictions:';
        ping -c 1 8.8.8.8 2>&1 || echo 'BLOCKED: Network capabilities restricted';
      "`;
    
    const { stdout } = await execAsync(securityCommand);
    
    expect(stdout).toContain('BLOCKED: Cannot escalate to root');
    expect(stdout).toContain('BLOCKED: Cannot write to root filesystem');
  });

  test('should validate network isolation', async () => {
    const networkCommand = `docker run --rm --network=none ${testImageName} sh -c "
      echo 'Testing network isolation:';
      ping -c 1 8.8.8.8 2>&1 || echo 'ISOLATED: No network access';
      curl -s http://google.com 2>&1 || echo 'ISOLATED: No external connectivity';
      netstat -rn 2>&1 || echo 'ISOLATED: No routing table';
    "`;
    
    const { stdout } = await execAsync(networkCommand);
    
    expect(stdout).toContain('ISOLATED: No network access');
    expect(stdout).toContain('ISOLATED: No external connectivity');
  });

  test('should validate resource limits enforcement', async () => {
    const resourceCommand = `docker run --rm --memory=128m --cpus=0.5 ` +
      `${testImageName} node -e "
        const start = Date.now();
        const arr = [];
        try {
          // Try to allocate more memory than limit
          for (let i = 0; i < 200; i++) {
            arr.push(new Array(1024 * 1024).fill('x')); // 1MB chunks
          }
          console.log('ERROR: Memory limit not enforced');
        } catch (error) {
          console.log('SUCCESS: Memory limit enforced -', error.message);
        }
        
        // Test CPU limits
        const cpuStart = Date.now();
        while (Date.now() - cpuStart < 1000) {
          Math.random();
        }
        const actualTime = Date.now() - start;
        console.log('CPU test duration:', actualTime, 'ms');
      "`;
    
    const { stdout } = await execAsync(resourceCommand);
    
    expect(stdout).toContain('SUCCESS: Memory limit enforced');
    
    // CPU limit should slow down execution
    const duration = parseInt(stdout.match(/CPU test duration: (\d+)/)?.[1] || '0');
    expect(duration).toBeGreaterThan(1000); // Should take longer due to CPU limits
  });

  test('should validate filesystem isolation', async () => {
    const fsCommand = `docker run --rm --read-only --tmpfs /tmp ` +
      `${testImageName} sh -c "
        echo 'Testing read-only filesystem:';
        echo 'test' > /root/test.txt 2>&1 || echo 'BLOCKED: Root filesystem read-only';
        echo 'Testing tmpfs write:';
        echo 'test' > /tmp/test.txt && echo 'SUCCESS: tmpfs writable' || echo 'ERROR: tmpfs not writable';
        echo 'Testing app directory:';
        ls -la /app | head -5;
      "`;
    
    const { stdout } = await execAsync(fsCommand);
    
    expect(stdout).toContain('BLOCKED: Root filesystem read-only');
    expect(stdout).toContain('SUCCESS: tmpfs writable');
  });

  test('should validate container process isolation', async () => {
    const processCommand = `docker run --rm ${testImageName} sh -c "
      echo 'Container processes:';
      ps aux;
      echo 'Container hostname:';
      hostname;
      echo 'Container user:';
      whoami;
      echo 'Container environment isolation:';
      env | grep -E '^(HOME|USER|PATH)' | sort;
    "`;
    
    const { stdout } = await execAsync(processCommand);
    
    // Should have minimal processes
    const processLines = stdout.split('\n').filter(line => 
      line.includes('PID') || line.includes('sh') || line.includes('node')
    );
    expect(processLines.length).toBeLessThan(10);
    
    // Should have unique hostname
    expect(stdout).toMatch(/Container hostname:\s*[a-f0-9]{12}/);
  });

  test('should validate secrets and sensitive data protection', async () => {
    const secretsCommand = `docker run --rm ${testImageName} sh -c "
      echo 'Scanning for common secret patterns:';
      find /app -type f -name '*.js' -exec grep -l 'password\\|secret\\|key\\|token' {} \\; 2>/dev/null | wc -l;
      echo 'Checking for environment variables:';
      env | grep -i 'password\\|secret\\|key\\|token' | wc -l;
      echo 'Checking for credential files:';
      find / -name '.env*' -o -name '*.key' -o -name '*.pem' 2>/dev/null | wc -l;
    "`;
    
    const { stdout } = await execAsync(secretsCommand);
    
    // Parse counts
    const lines = stdout.split('\n');
    const secretFiles = parseInt(lines[1] || '0');
    const secretEnvs = parseInt(lines[3] || '0');
    const credFiles = parseInt(lines[5] || '0');
    
    expect(secretFiles).toBeLessThan(5); // Minimal secret patterns in code
    expect(secretEnvs).toBe(0); // No secrets in environment
    expect(credFiles).toBe(0); // No credential files
  });

  test('should validate container image security', async () => {
    const imageCommand = `docker run --rm ${testImageName} sh -c "
      echo 'Checking for SUID/SGID binaries:';
      find / -perm /6000 -type f 2>/dev/null | wc -l;
      echo 'Checking for world-writable files:';
      find /app -perm -2 -type f 2>/dev/null | wc -l;
      echo 'Checking node_modules security:';
      ls -la /app/node_modules/.bin 2>/dev/null | wc -l;
    "`;
    
    const { stdout } = await execAsync(imageCommand);
    
    const lines = stdout.split('\n');
    const suidFiles = parseInt(lines[1] || '0');
    const worldWritable = parseInt(lines[3] || '0');
    
    expect(suidFiles).toBeLessThan(10); // Minimal SUID binaries
    expect(worldWritable).toBe(0); // No world-writable files in app
  });
});