/**
 * @fileoverview KGEN Marketplace Package Management System
 * @version 1.0.0
 * @description Deterministic TAR packaging with cryptographic signing and verification
 */

// ==============================================================================
// Exports
// ==============================================================================

// Builder exports
export {
  DeterministicTarBuilder,
  createPackageBuilder,
  buildPackage,
  analyzePackage,
  verifyPackageIntegrity,
  type PackageEntry,
  type PackageManifest,
  type BuildOptions,
  type BuildResult
} from './builder.js';

// Signer exports
export {
  PackageSigner,
  createPackageSigner,
  signPackage,
  generateSigningKeyPair,
  createPackageSignatureBundle,
  type KeyPair,
  type SigningOptions,
  type PackageSignature,
  type AttestationClaim,
  type PackageAttestation,
  type SignatureBundle
} from './signer.js';

// Verifier exports
export {
  PackageVerifier,
  createPackageVerifier,
  verifyPackage,
  createDefaultTrustPolicy,
  saveTrustPolicy,
  type TrustPolicy,
  type VerificationContext,
  type VerificationResult,
  type AttestationChainResult
} from './verifier.js';

// ==============================================================================
// Re-exports from types
// ==============================================================================

export {
  type KPackManifest,
  type ContentAddress,
  type ContentAddressType,
  type ArtifactReference,
  type Publisher,
  type TrustIndicators,
  type AttestationRequirements
} from '../types/kpack.js';

// ==============================================================================
// Utility Functions
// ==============================================================================

/**
 * Complete package creation workflow
 */
export async function createSignedPackage(options: {
  baseDir: string;
  outputPath: string;
  manifest: import('../types/kpack.js').KPackManifest;
  privateKey: CryptoKey;
  publisherId: string;
  exclude?: string[];
}): Promise<{
  buildResult: BuildResult;
  signatureBundle: SignatureBundle;
  packagePath: string;
}> {
  const { DeterministicTarBuilder } = await import('./builder.js');
  const { PackageSigner } = await import('./signer.js');

  // Build the package
  const builder = new DeterministicTarBuilder({
    baseDir: options.baseDir,
    outputPath: options.outputPath,
    manifest: options.manifest,
    exclude: options.exclude
  });

  const buildResult = await builder.build();

  // Sign the package
  const signer = new PackageSigner();
  const signatureBundle = await signer.createSignatureBundle(
    buildResult.manifest,
    {
      privateKey: options.privateKey,
      publisherId: options.publisherId,
      contentAddress: buildResult.contentAddress,
      manifest: buildResult.manifest
    }
  );

  return {
    buildResult,
    signatureBundle,
    packagePath: buildResult.packagePath
  };
}

/**
 * Complete package verification workflow
 */
export async function verifySignedPackage(options: {
  packagePath: string;
  signatureBundle: SignatureBundle;
  trustPolicyPath: string;
  allowExpired?: boolean;
}): Promise<{
  verificationResult: VerificationResult;
  trusted: boolean;
  errors: string[];
}> {
  const { PackageVerifier } = await import('./verifier.js');
  const { createContentAddress } = await import('../types/kpack.js');
  const fs = await import('fs/promises');

  // Calculate package content address
  const packageContent = await fs.readFile(options.packagePath);
  const contentAddress = await createContentAddress(packageContent, 'sha256');

  // Verify the package
  const verifier = new PackageVerifier();
  const trustPolicy = await verifier.loadTrustPolicy(options.trustPolicyPath);

  const verificationResult = await verifier.verifySignatureBundle(
    options.signatureBundle,
    contentAddress,
    {
      trustPolicy,
      allowExpired: options.allowExpired
    }
  );

  return {
    verificationResult,
    trusted: verificationResult.valid && verificationResult.trustScore > 0.7,
    errors: verificationResult.errors
  };
}