/**
 * KGEN Core Artifact Verification
 * 
 * Verification utilities for artifacts and attestations
 * Handles different attestation formats
 */

import crypto from 'crypto';
import { promises as fs } from 'fs';

/**
 * Verify artifact attestation
 * Supports both simple and full provenance attestation formats
 */
export async function verifyArtifactAttestation(attestationPath, options = {}) {
  try {
    const attestationContent = await fs.readFile(attestationPath, 'utf-8');
    const attestation = JSON.parse(attestationContent);

    // Determine attestation format and verify accordingly
    if (attestation.signature && attestation.generation && !attestation.inputs) {
      // Simple artifact generator attestation format
      return verifySimpleAttestation(attestation, options);
    } else if (attestation.inputs && attestation.outputs && attestation.signature) {
      // Full provenance tracker attestation format  
      return verifyProvenanceAttestation(attestation, options);
    } else {
      throw new Error('Unknown or invalid attestation format');
    }

  } catch (error) {
    return {
      verified: false,
      error: error.message,
      attestationPath
    };
  }
}

/**
 * Verify simple artifact generator attestation
 */
function verifySimpleAttestation(attestation, options = {}) {
  try {
    const originalSignature = attestation.signature;
    
    // Recalculate signature using the same method as generation
    const signatureData = {
      contentHash: attestation.artifact.contentHash,
      templateHash: attestation.generation.templateHash,
      contextHash: attestation.generation.contextHash,
      operationId: attestation.generation.operationId,
      generatedAt: attestation.generation.generatedAt
    };

    const calculatedSignature = crypto
      .createHash('sha256')
      .update(JSON.stringify(signatureData))
      .digest('hex');

    const verified = originalSignature.signature === calculatedSignature;

    return {
      verified,
      attestation,
      originalSignature,
      recalculatedSignature: {
        algorithm: 'sha256',
        signature: calculatedSignature,
        signedAt: originalSignature.signedAt
      },
      attestationType: 'simple'
    };

  } catch (error) {
    return {
      verified: false,
      error: error.message,
      attestationType: 'simple'
    };
  }
}

/**
 * Verify full provenance tracker attestation
 */
function verifyProvenanceAttestation(attestation, options = {}) {
  try {
    const originalSignature = attestation.signature;
    
    // Create canonical representation for verification
    const canonical = JSON.stringify({
      operationId: attestation.operationId,
      temporal: attestation.temporal,
      cryptography: attestation.cryptography,
      inputs: attestation.inputs.map(i => ({ path: i.path, hash: i.hash })),
      outputs: attestation.outputs.map(o => ({ path: o.path, contentHash: o.contentHash }))
    });

    const calculatedSignature = crypto.createHash('sha256')
      .update(canonical)
      .digest('hex');

    const verified = originalSignature.signature === calculatedSignature;

    return {
      verified,
      attestation,
      originalSignature,
      recalculatedSignature: {
        algorithm: 'sha256-hmac',
        signature: calculatedSignature,
        canonical: crypto.createHash('sha256').update(canonical).digest('hex'),
        signedAt: originalSignature.signedAt
      },
      attestationType: 'provenance'
    };

  } catch (error) {
    return {
      verified: false,
      error: error.message,
      attestationType: 'provenance'
    };
  }
}

/**
 * Verify artifact file integrity against attestation
 */
export async function verifyArtifactFile(artifactPath, options = {}) {
  try {
    const attestationPath = `${artifactPath}.attest.json`;
    
    // Verify attestation first
    const attestationVerification = await verifyArtifactAttestation(attestationPath, options);
    
    if (!attestationVerification.verified) {
      return {
        verified: false,
        error: 'Attestation verification failed',
        attestationVerification
      };
    }

    // Read artifact file and verify content hash
    const artifactContent = await fs.readFile(artifactPath);
    const actualHash = crypto.createHash('sha256').update(artifactContent).digest('hex');
    
    const expectedHash = attestationVerification.attestation.artifact?.contentHash ||
                        attestationVerification.attestation.outputs?.[0]?.contentHash;
    
    if (!expectedHash) {
      return {
        verified: false,
        error: 'No content hash found in attestation'
      };
    }

    const contentVerified = actualHash === expectedHash;

    return {
      verified: contentVerified && attestationVerification.verified,
      artifactPath,
      attestationPath,
      contentHash: {
        expected: expectedHash,
        actual: actualHash,
        matches: contentVerified
      },
      attestationVerification
    };

  } catch (error) {
    return {
      verified: false,
      error: error.message,
      artifactPath
    };
  }
}

/**
 * Compare two artifacts for reproducibility
 */
export async function compareArtifacts(artifact1Path, artifact2Path, options = {}) {
  try {
    const [verification1, verification2] = await Promise.all([
      verifyArtifactFile(artifact1Path, options),
      verifyArtifactFile(artifact2Path, options)
    ]);

    if (!verification1.verified || !verification2.verified) {
      return {
        reproducible: false,
        error: 'One or both artifacts failed verification',
        artifact1: verification1.verified,
        artifact2: verification2.verified
      };
    }

    // Compare content hashes
    const hash1 = verification1.contentHash.actual;
    const hash2 = verification2.contentHash.actual;
    const reproducible = hash1 === hash2;

    return {
      reproducible,
      artifact1: {
        path: artifact1Path,
        hash: hash1,
        verified: verification1.verified
      },
      artifact2: {
        path: artifact2Path,
        hash: hash2,
        verified: verification2.verified
      },
      hashMatch: reproducible,
      differences: reproducible ? [] : [
        {
          type: 'content_hash_mismatch',
          artifact1Hash: hash1,
          artifact2Hash: hash2
        }
      ]
    };

  } catch (error) {
    return {
      reproducible: false,
      error: error.message
    };
  }
}

export default {
  verifyArtifactAttestation,
  verifyArtifactFile,
  compareArtifacts
};