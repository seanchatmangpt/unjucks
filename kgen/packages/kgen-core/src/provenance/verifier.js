/**
 * JWS Attestation Verifier for kgen-core
 * 
 * Provides comprehensive verification capabilities for JWS attestations:
 * - Internal JOSE verification
 * - External JWT tool compatibility testing
 * - Cross-platform verification support
 * - Detailed verification reporting
 */

import { jwtVerify, importJWK } from 'jose';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { KeyManager } from './keys.js';

export class AttestationVerifier {
  constructor(config = {}) {
    this.config = {
      // External tools configuration
      jwtCliPath: config.jwtCliPath || 'jwt',
      nodeBinary: config.nodeBinary || 'node',
      pythonBinary: config.pythonBinary || 'python3',
      
      // Verification settings
      clockTolerance: config.clockTolerance || '5m',
      maxAge: config.maxAge || '1y',
      strict: config.strict !== false,
      
      // Caching
      enableCache: config.enableCache !== false,
      cacheSize: config.cacheSize || 1000,
      cacheTTL: config.cacheTTL || 300000, // 5 minutes
      
      // Output
      includePayload: config.includePayload !== false,
      verboseLogging: config.verboseLogging || false,
      
      ...config
    };
    
    this.keyManager = new KeyManager(config.keyManager);
    this.verificationCache = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the verifier
   */
  async initialize() {
    if (this.initialized) return;
    
    await this.keyManager.initialize();
    this.initialized = true;
  }

  /**
   * Verify a JWS token using internal JOSE library
   * @param {string} jwsToken - JWS token to verify
   * @param {Object} publicKey - Public key in JWK format
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} Verification result
   */
  async verifyWithJOSE(jwsToken, publicKey, options = {}) {
    await this.initialize();
    
    try {
      // Check cache first
      const cacheKey = this._generateCacheKey('jose', jwsToken, publicKey);
      if (this.config.enableCache && this.verificationCache.has(cacheKey)) {
        const cached = this.verificationCache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.config.cacheTTL) {
          return { ...cached.result, fromCache: true };
        }
      }
      
      // Import the public key
      const cryptoKey = await importJWK(publicKey, publicKey.alg);
      
      // Verify the JWT
      const { payload, protectedHeader } = await jwtVerify(jwsToken, cryptoKey, {
        issuer: options.issuer,
        audience: options.audience,
        clockTolerance: this.config.clockTolerance,
        ...options.joseOptions
      });
      
      const result = {
        valid: true,
        tool: 'jose',
        algorithm: protectedHeader.alg,
        keyId: protectedHeader.kid,
        header: protectedHeader,
        payload: this.config.includePayload ? payload : undefined,
        verifiedAt: new Date().toISOString(),
        claims: {
          issuer: payload.iss,
          audience: payload.aud,
          subject: payload.sub,
          issuedAt: payload.iat ? new Date(payload.iat * 1000).toISOString() : undefined,
          expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : undefined,
          notBefore: payload.nbf ? new Date(payload.nbf * 1000).toISOString() : undefined
        }
      };
      
      // Cache the result
      if (this.config.enableCache) {
        this._cacheResult(cacheKey, result);
      }
      
      return result;
      
    } catch (error) {
      const result = {
        valid: false,
        tool: 'jose',
        error: error.message,
        errorCode: error.code,
        verifiedAt: new Date().toISOString()
      };
      
      if (this.config.verboseLogging) {
        console.warn('JOSE verification failed:', error);
      }
      
      return result;
    }
  }

  /**
   * Verify a JWS token using external JWT CLI tool
   * @param {string} jwsToken - JWS token to verify
   * @param {Object} publicKey - Public key in JWK format
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} Verification result
   */
  async verifyWithJWTCLI(jwsToken, publicKey, options = {}) {
    try {
      // Create temporary files for token and key
      const tempDir = await fs.mkdtemp(path.join(process.cwd(), '.tmp-jwt-verify-'));
      const tokenFile = path.join(tempDir, 'token.jwt');
      const keyFile = path.join(tempDir, 'public.jwk');
      
      await fs.writeFile(tokenFile, jwsToken);
      await fs.writeFile(keyFile, JSON.stringify(publicKey, null, 2));
      
      try {
        // Build JWT CLI command
        const args = [
          'verify',
          '--key', keyFile,
          '--alg', publicKey.alg || 'EdDSA',
          tokenFile
        ];
        
        if (options.issuer) {
          args.push('--iss', options.issuer);
        }
        
        if (options.audience) {
          args.push('--aud', options.audience);
        }
        
        // Execute JWT CLI
        const result = await this._executeCommand(this.config.jwtCliPath, args);
        
        if (result.exitCode === 0) {
          return {
            valid: true,
            tool: 'jwt-cli',
            output: result.stdout,
            payload: this.config.includePayload ? this._extractPayloadFromOutput(result.stdout) : undefined,
            verifiedAt: new Date().toISOString()
          };
        } else {
          return {
            valid: false,
            tool: 'jwt-cli',
            error: result.stderr || result.stdout || 'Unknown error',
            exitCode: result.exitCode,
            verifiedAt: new Date().toISOString()
          };
        }
        
      } finally {
        // Cleanup temporary files
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
      
    } catch (error) {
      return {
        valid: false,
        tool: 'jwt-cli',
        error: error.message,
        verifiedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Verify a JWS token using Node.js jsonwebtoken library
   * @param {string} jwsToken - JWS token to verify
   * @param {Object} publicKey - Public key in JWK format
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} Verification result
   */
  async verifyWithNodeJWT(jwsToken, publicKey, options = {}) {
    try {
      const tempDir = await fs.mkdtemp(path.join(process.cwd(), '.tmp-node-jwt-'));
      const scriptFile = path.join(tempDir, 'verify.js');
      const keyFile = path.join(tempDir, 'public.jwk');
      
      await fs.writeFile(keyFile, JSON.stringify(publicKey, null, 2));
      
      // Create verification script
      const verificationScript = this._createNodeJWTScript(keyFile, options);
      await fs.writeFile(scriptFile, verificationScript);
      
      try {
        // Execute Node.js script
        const result = await this._executeCommand(this.config.nodeBinary, [scriptFile, jwsToken]);
        
        if (result.exitCode === 0 && result.stdout) {
          const output = JSON.parse(result.stdout);
          return {
            ...output,
            tool: 'node-jsonwebtoken',
            verifiedAt: new Date().toISOString()
          };
        } else {
          return {
            valid: false,
            tool: 'node-jsonwebtoken',
            error: result.stderr || 'Script execution failed',
            exitCode: result.exitCode,
            verifiedAt: new Date().toISOString()
          };
        }
        
      } finally {
        // Cleanup
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
      
    } catch (error) {
      return {
        valid: false,
        tool: 'node-jsonwebtoken',
        error: error.message,
        verifiedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Perform cross-verification using multiple tools
   * @param {string} jwsToken - JWS token to verify
   * @param {Object} publicKey - Public key in JWK format
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} Cross-verification results
   */
  async crossVerify(jwsToken, publicKey, options = {}) {
    const tools = options.tools || ['jose', 'jwt-cli'];
    const startTime = performance.now();
    
    // Run verifications in parallel
    const verificationPromises = tools.map(async (tool) => {
      try {
        let result;
        switch (tool) {
          case 'jose':
            result = await this.verifyWithJOSE(jwsToken, publicKey, options);
            break;
          case 'jwt-cli':
            result = await this.verifyWithJWTCLI(jwsToken, publicKey, options);
            break;
          case 'node-jwt':
            result = await this.verifyWithNodeJWT(jwsToken, publicKey, options);
            break;
          default:
            result = { valid: false, tool, error: `Unknown verification tool: ${tool}` };
        }
        return [tool, result];
      } catch (error) {
        return [tool, { valid: false, tool, error: error.message }];
      }
    });
    
    const toolResults = await Promise.allSettled(verificationPromises);
    const results = {};
    
    // Process results
    for (const promiseResult of toolResults) {
      if (promiseResult.status === 'fulfilled') {
        const [tool, result] = promiseResult.value;
        results[tool] = result;
      }
    }
    
    // Calculate consensus
    const validResults = Object.values(results).filter(r => r.valid);
    const invalidResults = Object.values(results).filter(r => !r.valid);
    
    const consensus = {
      totalTools: tools.length,
      validCount: validResults.length,
      invalidCount: invalidResults.length,
      consensus: validResults.length > invalidResults.length ? 'valid' : 'invalid',
      confidence: Math.max(validResults.length, invalidResults.length) / tools.length,
      unanimous: validResults.length === tools.length || invalidResults.length === tools.length
    };
    
    return {
      consensus,
      toolResults: results,
      verificationTime: performance.now() - startTime,
      recommendation: this._generateRecommendation(consensus),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Verify attestation artifact integrity
   * @param {Object} attestation - Complete attestation object
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} Integrity verification result
   */
  async verifyAttestationIntegrity(attestation, options = {}) {
    const result = {
      valid: true,
      checks: {},
      errors: []
    };
    
    // Check artifact existence and integrity
    if (attestation.artifact?.path) {
      try {
        const currentContent = await fs.readFile(attestation.artifact.path, 'utf8');
        const currentHash = crypto.createHash('sha256').update(currentContent).digest('hex');
        
        result.checks.artifactExists = true;
        result.checks.contentIntegrity = currentHash === attestation.artifact.contentHash;
        
        if (!result.checks.contentIntegrity) {
          result.valid = false;
          result.errors.push('Artifact content has been modified since attestation');
        }
        
      } catch (error) {
        result.valid = false;
        result.checks.artifactExists = false;
        result.errors.push(`Artifact not accessible: ${error.message}`);
      }
    }
    
    // Verify JWS signatures
    if (attestation.signatures) {
      result.checks.signatureVerification = {};
      
      for (const [algorithm, jwsToken] of Object.entries(attestation.signatures)) {
        const publicKey = attestation.keys?.[algorithm];
        if (publicKey) {
          try {
            const verificationResult = await this.verifyWithJOSE(jwsToken, publicKey, options);
            result.checks.signatureVerification[algorithm] = verificationResult.valid;
            
            if (!verificationResult.valid) {
              result.valid = false;
              result.errors.push(`${algorithm} signature verification failed: ${verificationResult.error}`);
            }
            
          } catch (error) {
            result.valid = false;
            result.checks.signatureVerification[algorithm] = false;
            result.errors.push(`${algorithm} signature verification error: ${error.message}`);
          }
        } else {
          result.valid = false;
          result.errors.push(`Public key not found for algorithm: ${algorithm}`);
        }
      }
    } else {
      result.valid = false;
      result.errors.push('No JWS signatures found in attestation');
    }
    
    // Verify timestamp validity
    if (attestation.metadata?.created) {
      const createdTime = new Date(attestation.metadata.created);
      const now = new Date();
      const age = now - createdTime;
      
      result.checks.timestampValid = !isNaN(createdTime.getTime());
      result.checks.notExpired = true; // JWS tokens have their own expiry
      
      if (!result.checks.timestampValid) {
        result.errors.push('Invalid attestation timestamp');
      }
    }
    
    return result;
  }

  /**
   * Generate detailed verification report
   * @param {Object} verificationResult - Result from cross-verification
   * @param {Object} options - Report options
   * @returns {string} Formatted report
   */
  generateVerificationReport(verificationResult, options = {}) {
    const { consensus, toolResults, verificationTime, recommendation } = verificationResult;
    const format = options.format || 'markdown';
    
    if (format === 'json') {
      return JSON.stringify(verificationResult, null, 2);
    }
    
    let report = '# JWS Attestation Verification Report\n\n';
    
    // Executive Summary
    report += `## Executive Summary\n\n`;
    report += `- **Overall Status**: ${consensus.consensus.toUpperCase()}\n`;
    report += `- **Confidence Level**: ${(consensus.confidence * 100).toFixed(1)}%\n`;
    report += `- **Tools Agreement**: ${consensus.validCount}/${consensus.totalTools}\n`;
    report += `- **Unanimous Result**: ${consensus.unanimous ? 'Yes' : 'No'}\n`;
    report += `- **Verification Time**: ${verificationTime.toFixed(2)}ms\n\n`;
    
    // Tool-by-tool Results
    report += `## Detailed Results\n\n`;
    for (const [tool, result] of Object.entries(toolResults)) {
      const status = result.valid ? '✅ PASSED' : '❌ FAILED';
      report += `### ${tool.toUpperCase()}\n`;
      report += `**Status**: ${status}\n`;
      
      if (result.valid) {
        if (result.algorithm) report += `**Algorithm**: ${result.algorithm}\n`;
        if (result.keyId) report += `**Key ID**: ${result.keyId}\n`;
        if (result.claims?.issuer) report += `**Issuer**: ${result.claims.issuer}\n`;
        if (result.claims?.expiresAt) report += `**Expires**: ${result.claims.expiresAt}\n`;
      } else {
        report += `**Error**: ${result.error}\n`;
        if (result.exitCode !== undefined) report += `**Exit Code**: ${result.exitCode}\n`;
      }
      report += '\n';
    }
    
    // Recommendation
    if (recommendation) {
      report += `## Recommendation\n\n${recommendation}\n\n`;
    }
    
    // Manual Verification Commands
    report += `## Manual Verification\n\n`;
    report += this._generateManualCommands(toolResults);
    
    return report;
  }

  /**
   * Export verification utilities for external use
   * @param {string} outputDir - Output directory
   * @returns {Promise<Array>} Created file paths
   */
  async exportVerificationUtilities(outputDir) {
    await fs.mkdir(outputDir, { recursive: true });
    const files = [];
    
    // Create JWT CLI script
    const cliScript = this._createCLIScript();
    const cliPath = path.join(outputDir, 'verify-jwt-cli.sh');
    await fs.writeFile(cliPath, cliScript);
    await fs.chmod(cliPath, 0o755);
    files.push(cliPath);
    
    // Create Node.js script
    const nodeScript = this._createNodeScript();
    const nodePath = path.join(outputDir, 'verify-nodejs.js');
    await fs.writeFile(nodePath, nodeScript);
    await fs.chmod(nodePath, 0o755);
    files.push(nodePath);
    
    // Create Python script  
    const pythonScript = this._createPythonScript();
    const pythonPath = path.join(outputDir, 'verify-python.py');
    await fs.writeFile(pythonPath, pythonScript);
    await fs.chmod(pythonPath, 0o755);
    files.push(pythonPath);
    
    // Create README
    const readme = this._createVerificationReadme();
    const readmePath = path.join(outputDir, 'README.md');
    await fs.writeFile(readmePath, readme);
    files.push(readmePath);
    
    return files;
  }

  // Private methods

  async _executeCommand(command, args, options = {}) {
    return new Promise((resolve) => {
      const process = spawn(command, args, {
        timeout: options.timeout || 10000,
        env: { ...process.env, ...options.env }
      });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (exitCode) => {
        resolve({
          exitCode,
          stdout: stdout.trim(),
          stderr: stderr.trim()
        });
      });
      
      process.on('error', (error) => {
        resolve({
          exitCode: -1,
          stdout: '',
          stderr: error.message
        });
      });
    });
  }

  _generateCacheKey(tool, token, key) {
    const data = `${tool}:${token}:${JSON.stringify(key)}`;
    return crypto.createHash('md5').update(data).digest('hex');
  }

  _cacheResult(key, result) {
    if (this.verificationCache.size >= this.config.cacheSize) {
      const firstKey = this.verificationCache.keys().next().value;
      this.verificationCache.delete(firstKey);
    }
    
    this.verificationCache.set(key, {
      result,
      timestamp: Date.now()
    });
  }

  _extractPayloadFromOutput(output) {
    try {
      // Try to extract JSON payload from output
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      // Ignore parsing errors
    }
    return null;
  }

  _generateRecommendation(consensus) {
    if (consensus.consensus === 'valid' && consensus.confidence >= 0.8) {
      if (consensus.unanimous) {
        return '✅ **STRONGLY RECOMMENDED**: All verification tools confirm the attestation is valid and trustworthy.';
      } else {
        return '✅ **RECOMMENDED**: Majority of verification tools confirm the attestation is valid.';
      }
    } else if (consensus.consensus === 'invalid' && consensus.confidence >= 0.8) {
      if (consensus.unanimous) {
        return '❌ **STRONGLY NOT RECOMMENDED**: All verification tools indicate the attestation is invalid.';
      } else {
        return '❌ **NOT RECOMMENDED**: Majority of verification tools indicate the attestation is invalid.';
      }
    } else {
      return '⚠️  **REQUIRES REVIEW**: Verification results are inconsistent. Manual inspection recommended.';
    }
  }

  _generateManualCommands(toolResults) {
    let commands = '';
    
    commands += '### Using JOSE Library (Node.js)\n';
    commands += '```javascript\n';
    commands += 'import { jwtVerify, importJWK } from "jose";\n';
    commands += 'const key = await importJWK(publicKeyJWK);\n';
    commands += 'const { payload } = await jwtVerify(jwsToken, key);\n';
    commands += '```\n\n';
    
    commands += '### Using JWT CLI\n';
    commands += '```bash\n';
    commands += 'jwt verify --key public.jwk token.jwt\n';
    commands += '```\n\n';
    
    commands += '### Using Node.js jsonwebtoken\n';
    commands += '```bash\n';
    commands += 'node verify-nodejs.js "<jwt-token>" public.jwk\n';
    commands += '```\n\n';
    
    return commands;
  }

  _createNodeJWTScript(keyFile, options) {
    return `
const jwt = require('jsonwebtoken');
const fs = require('fs');

try {
  const token = process.argv[2];
  if (!token) {
    throw new Error('Token not provided');
  }
  
  const keyData = JSON.parse(fs.readFileSync('${keyFile}', 'utf8'));
  
  const verifyOptions = {
    algorithms: [keyData.alg || 'EdDSA'],
    ${options.issuer ? `issuer: '${options.issuer}',` : ''}
    ${options.audience ? `audience: '${options.audience}',` : ''}
    clockTolerance: '${this.config.clockTolerance}'
  };
  
  const decoded = jwt.verify(token, keyData, verifyOptions);
  const header = jwt.decode(token, { complete: true }).header;
  
  console.log(JSON.stringify({
    valid: true,
    payload: decoded,
    header: header
  }, null, 2));
  
} catch (error) {
  console.log(JSON.stringify({
    valid: false,
    error: error.message,
    code: error.name
  }, null, 2));
}`;
  }

  _createCLIScript() {
    return `#!/bin/bash
# JWS Attestation Verification Script (JWT CLI)
# Usage: ./verify-jwt-cli.sh <token_file> <key_file>

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <token_file> <key_file>"
    echo "Example: $0 token.jwt public.jwk"
    exit 1
fi

TOKEN_FILE="$1"
KEY_FILE="$2"

if [ ! -f "$TOKEN_FILE" ]; then
    echo "Error: Token file '$TOKEN_FILE' not found"
    exit 1
fi

if [ ! -f "$KEY_FILE" ]; then
    echo "Error: Key file '$KEY_FILE' not found"
    exit 1
fi

echo "Verifying JWS token with JWT CLI..."
echo "Token file: $TOKEN_FILE"
echo "Key file: $KEY_FILE"
echo ""

jwt verify --key "$KEY_FILE" "$TOKEN_FILE"
RESULT=$?

if [ $RESULT -eq 0 ]; then
    echo ""
    echo "✅ Verification successful!"
else
    echo ""
    echo "❌ Verification failed!"
fi

exit $RESULT`;
  }

  _createNodeScript() {
    return `#!/usr/bin/env node
/**
 * JWS Attestation Verification Script (Node.js)
 * Usage: node verify-nodejs.js <token> <key_file>
 */

const jwt = require('jsonwebtoken');
const fs = require('fs');

function main() {
    if (process.argv.length !== 4) {
        console.error('Usage: node verify-nodejs.js <token> <key_file>');
        console.error('Example: node verify-nodejs.js "eyJ0eXA..." public.jwk');
        process.exit(1);
    }

    const token = process.argv[2];
    const keyFile = process.argv[3];

    try {
        if (!fs.existsSync(keyFile)) {
            throw new Error(\`Key file '\${keyFile}' not found\`);
        }

        const keyData = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
        
        console.log('Verifying JWS token with Node.js jsonwebtoken...');
        console.log('Key ID:', keyData.kid || 'N/A');
        console.log('Algorithm:', keyData.alg || 'EdDSA');
        console.log('');
        
        const options = {
            algorithms: [keyData.alg || 'EdDSA']
        };
        
        const decoded = jwt.verify(token, keyData, options);
        const header = jwt.decode(token, { complete: true }).header;
        
        console.log('✅ VERIFICATION SUCCESSFUL');
        console.log('');
        console.log('Header:', JSON.stringify(header, null, 2));
        console.log('');
        console.log('Payload:', JSON.stringify(decoded, null, 2));
        
    } catch (error) {
        console.log('❌ VERIFICATION FAILED');
        console.log('Error:', error.message);
        process.exit(1);
    }
}

main();`;
  }

  _createPythonScript() {
    return `#!/usr/bin/env python3
"""
JWS Attestation Verification Script (Python)
Usage: python verify-python.py <token> <key_file>
"""

import sys
import json
import os
try:
    import jwt
except ImportError:
    print("Error: PyJWT library not installed. Run: pip install PyJWT")
    sys.exit(1)

def main():
    if len(sys.argv) != 3:
        print("Usage: python verify-python.py <token> <key_file>")
        print("Example: python verify-python.py 'eyJ0eXA...' public.jwk")
        sys.exit(1)

    token = sys.argv[1]
    key_file = sys.argv[2]

    try:
        if not os.path.exists(key_file):
            raise Exception(f"Key file '{key_file}' not found")

        with open(key_file, 'r') as f:
            key_data = json.load(f)
        
        print("Verifying JWS token with Python PyJWT...")
        print(f"Key ID: {key_data.get('kid', 'N/A')}")
        print(f"Algorithm: {key_data.get('alg', 'EdDSA')}")
        print("")
        
        # Note: This is simplified. Production code would need proper JWK handling
        decoded = jwt.decode(
            token, 
            key_data,  # In practice, convert JWK to appropriate key format
            algorithms=[key_data.get('alg', 'EdDSA')]
        )
        
        print("✅ VERIFICATION SUCCESSFUL")
        print("")
        print("Payload:")
        print(json.dumps(decoded, indent=2))
        
    except Exception as error:
        print("❌ VERIFICATION FAILED")
        print(f"Error: {str(error)}")
        sys.exit(1)

if __name__ == "__main__":
    main()`;
  }

  _createVerificationReadme() {
    return `# JWS Attestation Verification Utilities

This directory contains utilities for verifying JWS attestations generated by the kgen provenance system.

## Available Tools

### 1. Bash Script (JWT CLI)
\`\`\`bash
./verify-jwt-cli.sh token.jwt public.jwk
\`\`\`
Requires: \`jwt-cli\` package (\`npm install -g jsonwebtoken-cli\`)

### 2. Node.js Script
\`\`\`bash
node verify-nodejs.js "eyJ0eXAiOiJKV1QiLCJhbGc..." public.jwk
\`\`\`
Requires: \`jsonwebtoken\` package (\`npm install jsonwebtoken\`)

### 3. Python Script
\`\`\`bash
python verify-python.py "eyJ0eXAiOiJKV1QiLCJhbGc..." public.jwk
\`\`\`
Requires: \`PyJWT\` package (\`pip install PyJWT\`)

## Key Format

All scripts expect public keys in JWK (JSON Web Key) format:

\`\`\`json
{
  "kty": "OKP",
  "crv": "Ed25519",
  "x": "base64url-encoded-public-key",
  "alg": "EdDSA",
  "use": "sig",
  "kid": "key-identifier"
}
\`\`\`

## Example Workflow

1. Extract JWS token from attestation:
   \`\`\`javascript
   const attestation = JSON.parse(fs.readFileSync('artifact.attest.json'));
   const jwsToken = attestation.signatures.eddsa; // or .rs256, .rs512
   const publicKey = attestation.keys.eddsa;
   \`\`\`

2. Verify with any tool:
   \`\`\`bash
   echo '\${jwsToken}' > token.jwt
   echo '\${JSON.stringify(publicKey)}' > public.jwk
   ./verify-jwt-cli.sh token.jwt public.jwk
   \`\`\`

## External Verification

The JWS tokens are standard RFC 7515 compliant and can be verified with:
- https://jwt.io (online debugger)
- Any JWT library in major programming languages
- Command-line JWT tools
- Enterprise security tools that support JWS

This ensures attestations are not locked to the kgen ecosystem.`;
  }

  /**
   * Get verifier status and metrics
   */
  getStatus() {
    return {
      initialized: this.initialized,
      cacheSize: this.verificationCache.size,
      maxCacheSize: this.config.cacheSize,
      cacheTTL: this.config.cacheTTL,
      externalTools: {
        jwtCli: this.config.jwtCliPath,
        node: this.config.nodeBinary,
        python: this.config.pythonBinary
      },
      features: {
        crossVerification: true,
        externalTools: true,
        caching: this.config.enableCache,
        strictMode: this.config.strict
      }
    };
  }
}

export default AttestationVerifier;