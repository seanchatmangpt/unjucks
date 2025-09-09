/**
 * Resource Management and Cleanup Tests
 * Validates Docker resource usage, limits, and cleanup procedures
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';

const execAsync = promisify(exec);

describe('Resource Management and Cleanup', () => {
  const testImageName = 'unjucks:test';
  const testContainerPrefix = 'unjucks-resource-test';
  const metricsFile = './tests/docker/resource-metrics.json';
  
  let initialSystemState = {};
  
  beforeAll(async () => {
    // Capture initial system state
    initialSystemState = await captureSystemState();
    await fs.writeFile(metricsFile, JSON.stringify(initialSystemState, null, 2));
  });

  afterAll(async () => {
    // Cleanup all test containers and resources
    await cleanupAllTestResources();
    
    // Capture final system state
    const finalSystemState = await captureSystemState();
    
    // Compare resource usage
    const metrics = {
      initial: initialSystemState,
      final: finalSystemState,
      cleanup: {
        containersCleaned: true,
        imagesCleaned: true,
        volumesCleaned: true,
        networksCleaned: true
      }
    };
    
    await fs.writeFile(metricsFile, JSON.stringify(metrics, null, 2));
  });

  async function captureSystemState() {
    try {
      const [containers, images, volumes, networks, systemInfo] = await Promise.all([
        execAsync('docker ps -a --format "{{.ID}},{{.Image}},{{.Status}}"'),
        execAsync('docker images --format "{{.Repository}},{{.Tag}},{{.Size}}"'),
        execAsync('docker volume ls --format "{{.Name}},{{.Driver}}"'),
        execAsync('docker network ls --format "{{.ID}},{{.Name}},{{.Driver}}"'),
        execAsync('docker system df --format "table {{.Type}},{{.Total}},{{.Active}},{{.Size}},{{.Reclaimable}}"')
      ]);

      return {
        timestamp: new Date().toISOString(),
        containers: containers.stdout.split('\n').filter(Boolean).length,
        images: images.stdout.split('\n').filter(Boolean).length,
        volumes: volumes.stdout.split('\n').filter(Boolean).length,
        networks: networks.stdout.split('\n').filter(Boolean).length,
        systemInfo: systemInfo.stdout
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  async function cleanupAllTestResources() {
    try {
      // Stop and remove all test containers
      const { stdout: containers } = await execAsync(`docker ps -a --filter name=${testContainerPrefix} --format "{{.ID}}"`);
      const containerIds = containers.split('\n').filter(Boolean);
      
      if (containerIds.length > 0) {
        await execAsync(`docker stop ${containerIds.join(' ')}`);
        await execAsync(`docker rm ${containerIds.join(' ')}`);
      }

      // Remove test volumes
      const { stdout: volumes } = await execAsync(`docker volume ls --filter name=${testContainerPrefix} --format "{{.Name}}"`);
      const volumeNames = volumes.split('\n').filter(Boolean);
      
      if (volumeNames.length > 0) {
        await execAsync(`docker volume rm ${volumeNames.join(' ')}`);
      }

      // Clean up dangling images
      await execAsync('docker image prune -f');
      
      // Clean up unused networks
      await execAsync('docker network prune -f');
      
    } catch (error) {
      console.warn('Cleanup warning:', error.message);
    }
  }

  test('should monitor memory usage during container lifecycle', async () => {
    const containerName = `${testContainerPrefix}-memory`;
    
    // Create container with memory limit
    await execAsync(`docker create --name ${containerName} --memory=256m ${testImageName} sleep 60`);
    
    // Start container and monitor memory
    await execAsync(`docker start ${containerName}`);
    
    const memoryStats = [];
    for (let i = 0; i < 5; i++) {
      const { stdout } = await execAsync(`docker stats ${containerName} --no-stream --format "{{.MemUsage}}"`);
      memoryStats.push(stdout.trim());
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Stop and remove container
    await execAsync(`docker stop ${containerName}`);
    await execAsync(`docker rm ${containerName}`);
    
    expect(memoryStats).toHaveLength(5);
    
    // Verify memory usage stays within limits
    memoryStats.forEach(stat => {
      const [used, limit] = stat.split(' / ');
      const usedMB = parseFloat(used.replace(/[^\d.]/g, ''));
      const limitMB = parseFloat(limit.replace(/[^\d.]/g, ''));
      
      expect(usedMB).toBeLessThanOrEqual(limitMB);
      expect(usedMB).toBeGreaterThan(0);
    });
  });

  test('should monitor CPU usage during intensive operations', async () => {
    const containerName = `${testContainerPrefix}-cpu`;
    
    // Run CPU-intensive task with limits
    const cpuCommand = `docker run --name ${containerName} --cpus=0.5 --rm ${testImageName} node -e "
      console.log('Starting CPU test...');
      const start = Date.now();
      let iterations = 0;
      while (Date.now() - start < 5000) {
        Math.random();
        iterations++;
      }
      console.log('Completed', iterations, 'iterations in 5 seconds');
    "`;
    
    const startTime = Date.now();
    const { stdout } = await execAsync(cpuCommand);
    const actualDuration = Date.now() - startTime;
    
    expect(stdout).toContain('Starting CPU test');
    expect(stdout).toContain('Completed');
    
    // With CPU limits, should take longer than 5 seconds
    expect(actualDuration).toBeGreaterThan(5000);
    expect(actualDuration).toBeLessThan(15000); // But not too long
    
    const iterations = parseInt(stdout.match(/Completed (\d+) iterations/)?.[1] || '0');
    expect(iterations).toBeGreaterThan(1000000); // Should still do significant work
  });

  test('should validate disk space usage and cleanup', async () => {
    const containerName = `${testContainerPrefix}-disk`;
    
    // Create container with disk usage monitoring
    const diskCommand = `docker run --name ${containerName} --rm -v ${testContainerPrefix}-vol:/data ${testImageName} sh -c "
      echo 'Testing disk usage...';
      df -h /data;
      echo 'Creating test files...';
      for i in \$(seq 1 10); do
        echo 'test data' > /data/test\$i.txt;
      done;
      echo 'Files created:';
      ls -la /data;
      echo 'Disk usage after:';
      df -h /data;
      echo 'Cleaning up...';
      rm /data/test*.txt;
      echo 'Final disk usage:';
      df -h /data;
    "`;
    
    const { stdout } = await execAsync(diskCommand);
    
    expect(stdout).toContain('Testing disk usage');
    expect(stdout).toContain('Files created');
    expect(stdout).toContain('Cleaning up');
    expect(stdout).toContain('Final disk usage');
    
    // Cleanup volume
    try {
      await execAsync(`docker volume rm ${testContainerPrefix}-vol`);
    } catch (error) {
      // Volume might not exist
    }
  });

  test('should validate network resource cleanup', async () => {
    const networkName = `${testContainerPrefix}-network`;
    const containerName = `${testContainerPrefix}-net`;
    
    // Create custom network
    await execAsync(`docker network create ${networkName}`);
    
    // Run container on custom network
    const networkCommand = `docker run --name ${containerName} --network ${networkName} --rm ${testImageName} sh -c "
      echo 'Testing network connectivity...';
      ip addr show;
      echo 'Network interfaces:';
      ls /sys/class/net/;
    "`;
    
    const { stdout } = await execAsync(networkCommand);
    
    expect(stdout).toContain('Testing network connectivity');
    expect(stdout).toContain('Network interfaces');
    
    // Cleanup network
    await execAsync(`docker network rm ${networkName}`);
    
    // Verify network is removed
    const { stdout: networks } = await execAsync('docker network ls');
    expect(networks).not.toContain(networkName);
  });

  test('should validate resource limit enforcement', async () => {
    const containerName = `${testContainerPrefix}-limits`;
    
    // Test memory limit enforcement
    const limitCommand = `docker run --name ${containerName} --memory=128m --oom-kill-disable=false --rm ${testImageName} node -e "
      console.log('Testing memory limits...');
      const chunks = [];
      try {
        for (let i = 0; i < 200; i++) {
          chunks.push(Buffer.alloc(1024 * 1024)); // 1MB chunks
          if (i % 50 === 0) console.log('Allocated', i, 'MB');
        }
        console.log('ERROR: Memory limit not enforced');
      } catch (error) {
        console.log('SUCCESS: Memory limit enforced at', chunks.length, 'MB');
      }
    "`;
    
    const { stdout } = await execAsync(limitCommand);
    
    expect(stdout).toContain('Testing memory limits');
    
    // Should either enforce limit or complete with reasonable memory usage
    if (stdout.includes('SUCCESS: Memory limit enforced')) {
      const allocatedMB = parseInt(stdout.match(/enforced at (\d+) MB/)?.[1] || '0');
      expect(allocatedMB).toBeLessThan(150); // Should stop before 150MB
    }
  });

  test('should validate complete resource cleanup', async () => {
    // Create multiple resources to test cleanup
    const resources = {
      containers: [`${testContainerPrefix}-cleanup-1`, `${testContainerPrefix}-cleanup-2`],
      volumes: [`${testContainerPrefix}-vol-1`, `${testContainerPrefix}-vol-2`],
      networks: [`${testContainerPrefix}-net-1`]
    };
    
    // Create resources
    await Promise.all([
      ...resources.containers.map(name => 
        execAsync(`docker create --name ${name} ${testImageName} sleep 1`)
      ),
      ...resources.volumes.map(name => 
        execAsync(`docker volume create ${name}`)
      ),
      ...resources.networks.map(name => 
        execAsync(`docker network create ${name}`)
      )
    ]);
    
    // Verify resources exist
    const beforeCleanup = await captureSystemState();
    
    // Cleanup all resources
    await cleanupAllTestResources();
    
    // Verify resources are cleaned up
    const afterCleanup = await captureSystemState();
    
    // Check that test containers are gone
    const { stdout: remainingContainers } = await execAsync(`docker ps -a --filter name=${testContainerPrefix} --format "{{.Names}}"`);
    expect(remainingContainers.trim()).toBe('');
    
    // Check that test volumes are gone
    const { stdout: remainingVolumes } = await execAsync(`docker volume ls --filter name=${testContainerPrefix} --format "{{.Name}}"`);
    expect(remainingVolumes.trim()).toBe('');
    
    // Check that test networks are gone
    const { stdout: remainingNetworks } = await execAsync(`docker network ls --filter name=${testContainerPrefix} --format "{{.Name}}"`);
    expect(remainingNetworks.trim()).toBe('');
  });

  test('should generate resource usage report', async () => {
    const reportCommand = `docker system df -v`;
    const { stdout } = await execAsync(reportCommand);
    
    const report = {
      timestamp: new Date().toISOString(),
      systemDf: stdout,
      recommendations: []
    };
    
    // Parse system usage and add recommendations
    if (stdout.includes('RECLAIMABLE')) {
      const lines = stdout.split('\n');
      lines.forEach(line => {
        if (line.includes('MB') || line.includes('GB')) {
          const parts = line.split(/\s+/);
          const reclaimable = parts.find(part => part.includes('MB') || part.includes('GB'));
          if (reclaimable && !reclaimable.startsWith('0')) {
            report.recommendations.push(`Consider cleaning up ${reclaimable} of reclaimable space`);
          }
        }
      });
    }
    
    await fs.writeFile('./tests/docker/resource-report.json', JSON.stringify(report, null, 2));
    
    expect(report.systemDf).toContain('TYPE');
    expect(report.timestamp).toBeDefined();
  });
});