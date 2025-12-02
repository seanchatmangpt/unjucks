/**
 * Trust Infrastructure Main Exports
 * Provides unified access to all cryptographic signing and trust management components
 */

export {
  DIDManager,
  VerifiableCredentialManager,
  SigstoreManager,
  SigningInfrastructure,
  KeyStore
} from './signing.js';

export {
  IdentityManager,
  HSMConfig
} from '../identity/manager.js';

export {
  SLSAValidator,
  AttestationChainValidator,
  CertificateTransparencyManager
} from './validation.js';

export {
  TrustPolicyEngine,
  TrustStore
} from './policy-engine.js';

/**
 * Main Trust Infrastructure Class
 * Orchestrates all trust-related components
 */
export class TrustInfrastructure {
  constructor(options = {}) {
    this.keyStorePath = options.keyStorePath || '.kgen/keys';
    this.trustPolicyPath = options.trustPolicyPath || '.kgen/trust-policy.json';
    this.trustStorePath = options.trustStorePath || '.kgen/trust-store';
    this.hsmEnabled = options.hsmEnabled || false;
    this.hsmOptions = options.hsmOptions || {};
    
    this.components = {};
  }

  /**
   * Initialize all trust infrastructure components
   */
  async initialize() {
    // Initialize identity management
    this.components.identityManager = new (await import('../identity/manager.js')).IdentityManager({
      keyStorePath: this.keyStorePath,
      hsmEnabled: this.hsmEnabled,
      ...this.hsmOptions
    });
    await this.components.identityManager.initialize();

    // Initialize signing infrastructure
    const { SigningInfrastructure } = await import('./signing.js');
    this.components.signingInfra = new SigningInfrastructure(this.keyStorePath);
    await this.components.signingInfra.initialize();

    // Initialize trust policy engine
    const { TrustPolicyEngine } = await import('./policy-engine.js');
    this.components.policyEngine = new TrustPolicyEngine({
      policyPath: this.trustPolicyPath
    });
    await this.components.policyEngine.initialize();

    // Initialize trust store
    const { TrustStore } = await import('./policy-engine.js');
    this.components.trustStore = new TrustStore({
      storePath: this.trustStorePath
    });
    await this.components.trustStore.initialize();

    // Initialize validators
    const { AttestationChainValidator } = await import('./validation.js');
    this.components.chainValidator = new AttestationChainValidator({
      trustStore: this.components.trustStore
    });

    return this.components;
  }

  /**
   * Create a complete KPack attestation with full trust chain
   */
  async createKPackAttestation(kpackData, options = {}) {
    // Generate or use existing publisher identity
    let publisherIdentity = options.publisherIdentity;
    if (!publisherIdentity) {
      publisherIdentity = await this.components.identityManager.generateIdentity({
        keyType: options.keyType || 'Ed25519',
        purpose: 'kpack-attestation'
      });
    }

    // Create DID for the identity
    const didResult = await this.components.signingInfra.didManager.generateDID(
      publisherIdentity.keyType
    );

    // Create the attestation
    const attestation = await this.components.signingInfra.createKPackAttestation({
      ...kpackData,
      subjectDID: didResult.did
    }, {
      publisherDID: didResult.did,
      ...options
    });

    // Evaluate against trust policy
    const policyEvaluation = await this.components.policyEngine.evaluateAttestation(
      attestation.credential
    );

    // Validate attestation chain
    const chainValidation = await this.components.chainValidator.validateAttestationChain([
      attestation.credential
    ]);

    return {
      attestation,
      publisherIdentity,
      didDocument: didResult.document,
      policyEvaluation,
      chainValidation,
      trustLevel: chainValidation.trustLevel
    };
  }

  /**
   * Verify a complete KPack attestation
   */
  async verifyKPackAttestation(attestationData) {
    const results = {
      timestamp: new Date().toISOString(),
      overall: true,
      components: {}
    };

    // Verify the credential
    results.components.credential = await this.components.signingInfra.vcManager.verifyCredential(
      attestationData.credential
    );

    // Verify against trust policy
    results.components.policy = await this.components.policyEngine.evaluateAttestation(
      attestationData.credential
    );

    // Verify attestation chain
    results.components.chain = await this.components.chainValidator.validateAttestationChain([
      attestationData.credential
    ]);

    // Verify Rekor entry if present
    if (attestationData.rekorEntry) {
      results.components.rekor = await this.components.signingInfra.sigstoreManager.verifyRekorEntry(
        attestationData.rekorEntry.uuid
      );
    }

    // Determine overall verification result
    results.overall = results.components.credential.verified &&
                     results.components.policy.compliant &&
                     results.components.chain.valid &&
                     (results.components.rekor?.verified !== false);

    return results;
  }

  /**
   * Get trust infrastructure status
   */
  async getStatus() {
    const status = {
      initialized: true,
      timestamp: new Date().toISOString(),
      components: {}
    };

    // Identity manager status
    if (this.components.identityManager) {
      const identities = this.components.identityManager.listIdentities();
      const needsRotation = await this.components.identityManager.checkRotationNeeded();
      
      status.components.identityManager = {
        totalIdentities: identities.length,
        activeIdentities: identities.filter(i => i.status === 'active').length,
        identitiesNeedingRotation: needsRotation.length,
        hsmEnabled: this.hsmEnabled
      };
    }

    // Trust policy status
    if (this.components.policyEngine) {
      status.components.trustPolicy = this.components.policyEngine.getPolicySummary();
    }

    // Trust store status
    if (this.components.trustStore) {
      const trustedEntities = this.components.trustStore.listTrustedEntities();
      status.components.trustStore = {
        trustedEntities: trustedEntities.length,
        averageTrustScore: trustedEntities.length > 0 ?
          trustedEntities.reduce((sum, e) => sum + e.trustScore, 0) / trustedEntities.length :
          0
      };
    }

    return status;
  }

  /**
   * Perform key rotation for identities that need it
   */
  async performScheduledRotation() {
    if (!this.components.identityManager) {
      throw new Error('Identity manager not initialized');
    }

    return await this.components.identityManager.autoRotateKeys();
  }

  /**
   * Cleanup old keys and attestations
   */
  async cleanup(options = {}) {
    const maxAge = options.maxAge || 365 * 24 * 60 * 60 * 1000; // 1 year
    const results = {
      keysRemoved: 0,
      identitiesArchived: 0,
      attestationsArchived: 0
    };

    // Implementation would clean up old rotated keys, expired attestations, etc.
    // This is a placeholder for the cleanup logic
    
    return results;
  }
}
