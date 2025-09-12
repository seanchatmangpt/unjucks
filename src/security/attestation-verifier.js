/**
 * External JWT/JWS Attestation Verifier
 * 
 * Provides utilities for verifying JWS attestations with external tools:
 * - Command-line JWT verification
 * - Node.js jwt library compatibility  
 * - External service integration
 * - Cross-platform verification
 */

import { jwtVerify, createLocalJWKSet, importJWK } from 'jose';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import consola from 'consola';

export class AttestationVerifier {
  constructor(config = {}) {
    this.config = {
      // External tools
      jwtCliPath: config.jwtCliPath || 'jwt',
      nodeBinary: config.nodeBinary || 'node',
      
      // Verification settings
      clockTolerance: config.clockTolerance || '5m',
      maxAge: config.maxAge || '1y',
      
      // External services
      verificationEndpoints: config.verificationEndpoints || [],
      
      // Output options
      outputFormat: config.outputFormat || 'detailed', // detailed, simple, json
      includePayload: config.includePayload !== false,
      
      ...config
    };
    
    this.logger = consola.withTag('attestation-verifier');
  }

  /**
   * Verify JWS token using external JWT CLI tool
   * @param {string} jwsToken - JWS token to verify
   * @param {Object} publicKey - Public key (JWK format)
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} Verification result
   */
  async verifyWithJWTCLI(jwsToken, publicKey, options = {}) {
    try {
      this.logger.info('Verifying JWS token with external JWT CLI...');
      
      // Create temporary files for token and key
      const tempDir = await fs.mkdtemp('/tmp/jwt-verify-');
      const tokenFile = path.join(tempDir, 'token.jwt');
      const keyFile = path.join(tempDir, 'public.jwk');
      
      await fs.writeFile(tokenFile, jwsToken);
      await fs.writeFile(keyFile, JSON.stringify(publicKey, null, 2));
      
      // Prepare JWT CLI command
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
      
      // Cleanup temp files
      await fs.rm(tempDir, { recursive: true }).catch(() => {});
      
      if (result.exitCode === 0) {
        return {
          valid: true,
          tool: 'jwt-cli',
          output: result.stdout,
          payload: options.includePayload ? this._extractPayloadFromOutput(result.stdout) : null
        };
      } else {
        return {
          valid: false,
          tool: 'jwt-cli',
          error: result.stderr || result.stdout,
          exitCode: result.exitCode
        };
      }
      
    } catch (error) {
      this.logger.error('JWT CLI verification failed:', error);
      return {
        valid: false,
        tool: 'jwt-cli',
        error: error.message
      };
    }
  }

  /**
   * Verify JWS token using Node.js jsonwebtoken library
   * @param {string} jwsToken - JWS token to verify
   * @param {Object} publicKey - Public key (JWK format)
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} Verification result
   */
  async verifyWithNodeJWT(jwsToken, publicKey, options = {}) {
    try {
      this.logger.info('Verifying JWS token with Node.js jsonwebtoken...');
      
      // Create temporary verification script
      const tempDir = await fs.mkdtemp('/tmp/node-jwt-verify-');
      const scriptFile = path.join(tempDir, 'verify.js');
      const keyFile = path.join(tempDir, 'public.jwk');
      
      await fs.writeFile(keyFile, JSON.stringify(publicKey, null, 2));
      
      const verificationScript = `
const jwt = require('jsonwebtoken');
const fs = require('fs');

try {
  const token = process.argv[2];
  const keyData = JSON.parse(fs.readFileSync('${keyFile}', 'utf8'));
  
  // Convert JWK to PEM if needed
  let key;
  if (keyData.kty === 'RSA') {
    key = keyData; // Use JWK directly for RSA
  } else {
    // For Ed25519, we need to convert or use a different approach
    key = keyData;
  }
  
  const options = {
    algorithms: ['${publicKey.alg || 'EdDSA'}'],
    ${options.issuer ? `issuer: '${options.issuer}',` : ''}
    ${options.audience ? `audience: '${options.audience}',` : ''}
    clockTolerance: '${this.config.clockTolerance}'
  };
  
  const decoded = jwt.verify(token, key, options);
  
  console.log(JSON.stringify({
    valid: true,
    payload: decoded,
    header: jwt.decode(token, { complete: true }).header
  }, null, 2));
  
} catch (error) {
  console.log(JSON.stringify({
    valid: false,
    error: error.message,
    code: error.name
  }, null, 2));
}
`;
      
      await fs.writeFile(scriptFile, verificationScript);
      
      // Execute Node.js script
      const result = await this._executeCommand(this.config.nodeBinary, [scriptFile, jwsToken]);
      
      // Cleanup
      await fs.rm(tempDir, { recursive: true }).catch(() => {});
      
      const output = JSON.parse(result.stdout || '{"valid": false, "error": "No output"}');
      
      return {
        ...output,
        tool: 'node-jsonwebtoken',
        exitCode: result.exitCode
      };
      
    } catch (error) {
      this.logger.error('Node.js JWT verification failed:', error);
      return {
        valid: false,
        tool: 'node-jsonwebtoken',
        error: error.message
      };
    }
  }

  /**
   * Verify JWS token using JOSE library (internal)
   * @param {string} jwsToken - JWS token to verify
   * @param {Object} publicKey - Public key (JWK format)
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} Verification result
   */
  async verifyWithJOSE(jwsToken, publicKey, options = {}) {
    try {
      this.logger.debug('Verifying JWS token with JOSE library...');
      
      // Import the public key
      const key = await importJWK(publicKey, publicKey.alg);
      
      // Verify the token
      const { payload, protectedHeader } = await jwtVerify(jwsToken, key, {
        issuer: options.issuer,
        audience: options.audience,
        clockTolerance: this.config.clockTolerance
      });
      
      return {
        valid: true,
        tool: 'jose',
        payload,
        header: protectedHeader,
        keyId: protectedHeader.kid
      };
      
    } catch (error) {
      this.logger.error('JOSE verification failed:', error);
      return {
        valid: false,
        tool: 'jose',
        error: error.message,
        code: error.code
      };
    }
  }

  /**
   * Cross-verify JWS token with multiple tools
   * @param {string} jwsToken - JWS token to verify
   * @param {Object} publicKey - Public key (JWK format)
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} Comprehensive verification result
   */
  async crossVerify(jwsToken, publicKey, options = {}) {
    const tools = options.tools || ['jose', 'jwt-cli', 'node-jwt'];
    const results = {};
    
    this.logger.info(`Cross-verifying JWS token with ${tools.length} tools...`);
    
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
    
    const toolResults = await Promise.all(verificationPromises);
    
    // Compile results
    for (const [tool, result] of toolResults) {
      results[tool] = result;
    }
    
    // Calculate consensus
    const validResults = Object.values(results).filter(r => r.valid);
    const invalidResults = Object.values(results).filter(r => !r.valid);
    
    const consensus = {
      totalTools: tools.length,
      validCount: validResults.length,
      invalidCount: invalidResults.length,
      consensus: validResults.length > invalidResults.length ? 'valid' : 'invalid',
      confidence: Math.max(validResults.length, invalidResults.length) / tools.length
    };
    
    this.logger.info(`Cross-verification complete: ${consensus.consensus} (${consensus.validCount}/${consensus.totalTools} tools agree)`);
    
    return {
      consensus,
      toolResults: results,
      recommendation: this._generateRecommendation(consensus, results)
    };
  }

  /**
   * Generate verification report
   * @param {Object} verificationResult - Result from cross-verification
   * @returns {string} Formatted report
   */
  generateVerificationReport(verificationResult) {
    const { consensus, toolResults, recommendation } = verificationResult;
    
    let report = '# JWS Attestation Verification Report\n\n';
    
    // Summary
    report += `## Summary\n`;
    report += `- **Consensus**: ${consensus.consensus.toUpperCase()}\n`;
    report += `- **Confidence**: ${(consensus.confidence * 100).toFixed(1)}%\n`;
    report += `- **Tools Verified**: ${consensus.validCount}/${consensus.totalTools}\n\n`;
    
    // Tool Results
    report += `## Tool Results\n\n`;
    for (const [tool, result] of Object.entries(toolResults)) {
      const status = result.valid ? '✅ VALID' : '❌ INVALID';
      report += `### ${tool}\n`;
      report += `**Status**: ${status}\n`;
      
      if (result.valid && result.payload) {
        report += `**Key ID**: ${result.header?.kid || 'N/A'}\n`;
        report += `**Algorithm**: ${result.header?.alg || 'N/A'}\n`;
        if (result.payload.iss) report += `**Issuer**: ${result.payload.iss}\n`;
        if (result.payload.aud) report += `**Audience**: ${result.payload.aud}\n`;
        if (result.payload.exp) report += `**Expires**: ${new Date(result.payload.exp * 1000).toISOString()}\n`;
      } else if (result.error) {
        report += `**Error**: ${result.error}\n`;
      }
      report += '\n';
    }
    
    // Recommendation
    if (recommendation) {
      report += `## Recommendation\n\n${recommendation}\n\n`;
    }
    
    // Verification Commands
    report += `## Manual Verification Commands\n\n`;
    report += this._generateManualCommands(verificationResult);
    
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
    
    // Create JWT CLI verification script
    const jwtCliScript = `#!/bin/bash
# JWS Attestation Verification Script (JWT CLI)
#
# Usage: ./verify-jwt-cli.sh <token_file> <key_file>

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <token_file> <key_file>"
    exit 1
fi

TOKEN_FILE="$1"
KEY_FILE="$2"

echo "Verifying JWS token with JWT CLI..."
echo "Token file: $TOKEN_FILE"
echo "Key file: $KEY_FILE"
echo ""

jwt verify --key "$KEY_FILE" "$TOKEN_FILE"
`;
    
    const jwtCliPath = path.join(outputDir, 'verify-jwt-cli.sh');
    await fs.writeFile(jwtCliPath, jwtCliScript);
    await fs.chmod(jwtCliPath, 0o755);
    files.push(jwtCliPath);
    
    // Create Node.js verification script
    const nodeScript = `#!/usr/bin/env node
/**
 * JWS Attestation Verification Script (Node.js)
 *
 * Usage: node verify-nodejs.js <token> <key_file>
 */

const jwt = require('jsonwebtoken');
const fs = require('fs');

if (process.argv.length !== 4) {
    console.error('Usage: node verify-nodejs.js <token> <key_file>');
    process.exit(1);
}

const token = process.argv[2];
const keyFile = process.argv[3];

try {
    const keyData = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
    
    console.log('Verifying JWS token with Node.js jsonwebtoken...');
    console.log('Key ID:', keyData.kid);
    console.log('Algorithm:', keyData.alg);
    console.log('');
    
    const decoded = jwt.verify(token, keyData, {
        algorithms: [keyData.alg]
    });
    
    console.log('✅ VERIFICATION SUCCESSFUL');
    console.log('');
    console.log('Payload:');
    console.log(JSON.stringify(decoded, null, 2));
    
} catch (error) {
    console.log('❌ VERIFICATION FAILED');
    console.log('Error:', error.message);
    process.exit(1);
}
`;
    
    const nodePath = path.join(outputDir, 'verify-nodejs.js');
    await fs.writeFile(nodePath, nodeScript);
    await fs.chmod(nodePath, 0o755);
    files.push(nodePath);
    
    // Create Python verification script
    const pythonScript = `#!/usr/bin/env python3
"""
JWS Attestation Verification Script (Python)

Usage: python verify-python.py <token> <key_file>
"""

import sys
import json
import jwt

if len(sys.argv) != 3:
    print("Usage: python verify-python.py <token> <key_file>")
    sys.exit(1)

token = sys.argv[1]
key_file = sys.argv[2]

try:
    with open(key_file, 'r') as f:
        key_data = json.load(f)
    
    print("Verifying JWS token with Python PyJWT...")
    print(f"Key ID: {key_data.get('kid', 'N/A')}")
    print(f"Algorithm: {key_data.get('alg', 'N/A')}")
    print("")
    
    # Note: This is a simplified example. Production code would need
    # proper JWK to key conversion
    decoded = jwt.decode(
        token, 
        key_data, 
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
`;
    
    const pythonPath = path.join(outputDir, 'verify-python.py');
    await fs.writeFile(pythonPath, pythonScript);
    await fs.chmod(pythonPath, 0o755);
    files.push(pythonPath);
    
    // Create README
    const readme = `# JWS Attestation Verification Utilities

This directory contains utilities for verifying JWS attestations with external tools.

## Available Scripts

### 1. JWT CLI Verification
\`\`\`bash
./verify-jwt-cli.sh token.jwt public.jwk
\`\`\`

### 2. Node.js Verification
\`\`\`bash
node verify-nodejs.js "eyJ0eXAiOiJKV1QiLCJhbGc..." public.jwk
\`\`\`

### 3. Python Verification
\`\`\`bash
python verify-python.py "eyJ0eXAiOiJKV1QiLCJhbGc..." public.jwk
\`\`\`

## Key Formats

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

## Dependencies

- **JWT CLI**: Install with \`npm install -g jsonwebtoken-cli\`
- **Node.js**: Requires \`jsonwebtoken\` package
- **Python**: Requires \`PyJWT\` package (\`pip install PyJWT\`)

## Example Usage

1. Generate a JWS attestation:
   \`\`\`javascript
   const attestation = await joseAttestationSystem.createAttestationJWS(artifact);
   \`\`\`

2. Extract public key:
   \`\`\`javascript
   const jwks = await joseAttestationSystem.exportPublicJWKS();
   \`\`\`

3. Verify with any external tool:
   \`\`\`bash
   echo "${attestation}" > token.jwt
   echo '${jwks.keys[0]}' > public.jwk
   ./verify-jwt-cli.sh token.jwt public.jwk
   \`\`\`
`;
    
    const readmePath = path.join(outputDir, 'README.md');
    await fs.writeFile(readmePath, readme);
    files.push(readmePath);
    
    this.logger.success(`Exported verification utilities to ${outputDir}`);
    
    return files;
  }

  // Private methods

  async _executeCommand(command, args) {
    return new Promise((resolve) => {
      const process = spawn(command, args);
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
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

  _extractPayloadFromOutput(output) {
    try {
      // Try to extract JSON payload from JWT CLI output
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      // Ignore parsing errors
    }
    return null;
  }

  _generateRecommendation(consensus, results) {
    if (consensus.consensus === 'valid' && consensus.confidence >= 0.8) {
      return '✅ **RECOMMENDED**: The attestation is valid and can be trusted.';
    } else if (consensus.consensus === 'invalid' && consensus.confidence >= 0.8) {
      return '❌ **NOT RECOMMENDED**: The attestation is invalid and should not be trusted.';
    } else {
      return '⚠️  **CAUTION**: Verification results are inconsistent. Manual review recommended.';
    }
  }

  _generateManualCommands(verificationResult) {
    const { toolResults } = verificationResult;
    
    let commands = '';
    
    if (toolResults.jose?.valid) {
      commands += '### JOSE Library (Node.js)\n';
      commands += '```javascript\n';
      commands += 'const { jwtVerify, importJWK } = require("jose");\n';
      commands += 'const key = await importJWK(publicJWK);\n';
      commands += 'const { payload } = await jwtVerify(token, key);\n';
      commands += '```\n\n';
    }
    
    commands += '### JWT CLI\n';
    commands += '```bash\n';
    commands += 'jwt verify --key public.jwk token.jwt\n';
    commands += '```\n\n';
    
    commands += '### Node.js jsonwebtoken\n';
    commands += '```javascript\n';
    commands += 'const jwt = require("jsonwebtoken");\n';
    commands += 'const decoded = jwt.verify(token, publicKey, { algorithms: ["EdDSA"] });\n';
    commands += '```\n\n';
    
    return commands;
  }
}

export const attestationVerifier = new AttestationVerifier();
export default AttestationVerifier;