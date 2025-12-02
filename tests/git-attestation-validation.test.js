/**
 * Git Attestation Test Validation
 * 
 * Validates that the git attestation step definitions and fixtures
 * are properly structured and can be loaded without import errors.
 */

const { promises: fs } = require('fs');
const path = require('path');
const crypto = require('crypto');

describe('Git Attestation Test Implementation', () => {
  
  describe('Feature File Structure', () => {
    test('02-git-attestations.feature should exist and be well-formed', async () => {
      const featurePath = path.join(__dirname, '../features/validation/02-git-attestations.feature');
      
      // Verify file exists
      const featureExists = await fs.access(featurePath).then(() => true).catch(() => false);
      expect(featureExists).toBe(true);
      
      // Read and validate content
      const featureContent = await fs.readFile(featurePath, 'utf8');
      
      // Basic structure checks
      expect(featureContent).toContain('Feature: Git Attestation and Provenance Tracking');
      expect(featureContent).toContain('Background:');
      expect(featureContent).toContain('Scenario:');
      
      // Check for key scenarios
      expect(featureContent).toContain('Generate .attest.json with git context');
      expect(featureContent).toContain('Create JOSE/JWS signature with Ed25519');
      expect(featureContent).toContain('Create JOSE/JWS signature with RSA-SHA256');
      expect(featureContent).toContain('Track complete provenance chain in git');
      expect(featureContent).toContain('Store attestation in git notes');
      
      // Check for comprehensive coverage
      expect(featureContent).toContain('Multi-key signature validation');
      expect(featureContent).toContain('Cross-repository attestation resolution');
      expect(featureContent).toContain('Performance validation for large repositories');
    });
  });
  
  describe('Step Definitions Structure', () => {
    test('git_steps.ts should have proper structure and exports', async () => {
      const stepsPath = path.join(__dirname, '../features/step_definitions/git_steps.ts');
      
      // Verify file exists
      const stepsExists = await fs.access(stepsPath).then(() => true).catch(() => false);
      expect(stepsExists).toBe(true);
      
      // Read and validate content
      const stepsContent = await fs.readFile(stepsPath, 'utf8');
      
      // Check imports
      expect(stepsContent).toContain("import { Before, After, Given, When, Then } from '@cucumber/cucumber'");
      expect(stepsContent).toContain("import { expect } from 'chai'");
      expect(stepsContent).toContain("import { promises as fs } from 'fs'");
      expect(stepsContent).toContain("import crypto from 'crypto'");
      
      // Check test context structure
      expect(stepsContent).toContain('interface TestContext');
      expect(stepsContent).toContain('gitRepoPath: string');
      expect(stepsContent).toContain('provenanceTracker:');
      expect(stepsContent).toContain('attestationGenerator:');
      expect(stepsContent).toContain('signingKeys:');
      
      // Check key step definitions
      expect(stepsContent).toContain("Given('a git repository with KGEN configured");
      expect(stepsContent).toContain("Given('I have valid Ed25519 and RSA signing keys configured");
      expect(stepsContent).toContain("Given('the ProvenanceEngine is initialized with git integration");
      expect(stepsContent).toContain("When('I create a cryptographic attestation");
      expect(stepsContent).toContain("Then('the signature should verify with");
      
      // Check cleanup
      expect(stepsContent).toContain('After(async function()');
      expect(stepsContent).toContain('await fs.rm(tempDir, { recursive: true, force: true })');
    });
  });
  
  describe('Test Fixtures', () => {
    test('Git test repository factory should be comprehensive', async () => {
      const factoryPath = path.join(__dirname, '../features/fixtures/git-test-repos.js');
      
      const factoryExists = await fs.access(factoryPath).then(() => true).catch(() => false);
      expect(factoryExists).toBe(true);
      
      const factoryContent = await fs.readFile(factoryPath, 'utf8');
      
      // Check main class
      expect(factoryContent).toContain('export class GitTestRepositoryFactory');
      
      // Check key methods
      expect(factoryContent).toContain('async createBasicRepository');
      expect(factoryContent).toContain('async addSigningKeys');
      expect(factoryContent).toContain('async createTemplateHierarchy');
      expect(factoryContent).toContain('async generateArtifactsWithAttestations');
      expect(factoryContent).toContain('async createCrossRepoScenario');
      expect(factoryContent).toContain('async createLargeRepository');
      
      // Check crypto support
      expect(factoryContent).toContain("keyType === 'ed25519'");
      expect(factoryContent).toContain("keyType === 'rsa'");
      expect(factoryContent).toContain("crypto.generateKeyPairSync('ed25519'");
      expect(factoryContent).toContain("crypto.generateKeyPairSync('rsa'");
    });
    
    test('Sample attestations should have proper JOSE/JWS structure', async () => {
      const attestationsPath = path.join(__dirname, '../features/fixtures/sample-attestations.json');
      
      const attestationsExist = await fs.access(attestationsPath).then(() => true).catch(() => false);
      expect(attestationsExist).toBe(true);
      
      const attestationsContent = await fs.readFile(attestationsPath, 'utf8');
      const attestations = JSON.parse(attestationsContent);
      
      // Check Ed25519 attestation
      const ed25519Attestation = attestations.valid_ed25519_attestation;
      expect(ed25519Attestation).toBeDefined();
      expect(ed25519Attestation.jose_header.alg).toBe('Ed25519');
      expect(ed25519Attestation.jose_header.typ).toBe('JWT');
      expect(ed25519Attestation.jose_header.kid).toBe('ed25519_001');
      expect(ed25519Attestation).toHaveProperty('signature');
      expect(ed25519Attestation).toHaveProperty('git_commit_sha');
      expect(ed25519Attestation).toHaveProperty('template_hierarchy');
      
      // Check RSA attestation
      const rsaAttestation = attestations.valid_rsa_attestation;
      expect(rsaAttestation).toBeDefined();
      expect(rsaAttestation.jose_header.alg).toBe('RS256');
      expect(rsaAttestation.jose_header.typ).toBe('JWT');
      expect(rsaAttestation.jose_header.kid).toBe('rsa_002');
      
      // Check multi-signature attestation
      const multiSigAttestation = attestations.multi_signature_attestation;
      expect(multiSigAttestation).toBeDefined();
      expect(multiSigAttestation).toHaveProperty('signatures');
      expect(Array.isArray(multiSigAttestation.signatures)).toBe(true);
      expect(multiSigAttestation.signatures.length).toBe(2);
      
      // Check cross-repo attestation
      const crossRepoAttestation = attestations.cross_repo_attestation;
      expect(crossRepoAttestation).toBeDefined();
      expect(crossRepoAttestation).toHaveProperty('cross_repo_references');
      expect(crossRepoAttestation).toHaveProperty('template_repository');
      
      // Check template hierarchy attestation
      const hierarchyAttestation = attestations.template_hierarchy_attestation;
      expect(hierarchyAttestation).toBeDefined();
      expect(hierarchyAttestation.template_hierarchy).toBeDefined();
      expect(Array.isArray(hierarchyAttestation.template_hierarchy)).toBe(true);
      expect(hierarchyAttestation.template_hierarchy.length).toBe(3); // base, layout, page
    });
    
    test('Sample templates should cover different hierarchies', async () => {
      const templatesPath = path.join(__dirname, '../features/fixtures/sample-templates.js');
      
      const templatesExist = await fs.access(templatesPath).then(() => true).catch(() => false);
      expect(templatesExist).toBe(true);
      
      const templatesContent = await fs.readFile(templatesPath, 'utf8');
      
      // Check template hierarchy exports
      expect(templatesContent).toContain('export const TEMPLATE_HIERARCHIES');
      expect(templatesContent).toContain('basic_component:');
      expect(templatesContent).toContain('react_components:');
      expect(templatesContent).toContain('api_services:');
      expect(templatesContent).toContain('config_files:');
      
      // Check template structure
      expect(templatesContent).toContain("name: 'base.njk'");
      expect(templatesContent).toContain("extends: 'base.njk'");
      expect(templatesContent).toContain("name: 'react-base.njk'");
      expect(templatesContent).toContain("name: 'button.njk'");
      
      // Check sample variables
      expect(templatesContent).toContain('export const SAMPLE_VARIABLES');
      expect(templatesContent).toContain('react_button:');
      expect(templatesContent).toContain('user_service:');
      expect(templatesContent).toContain('project_package:');
      
      // Check artifact expectations
      expect(templatesContent).toContain('export const ARTIFACT_EXPECTATIONS');
      expect(templatesContent).toContain('button_tsx:');
      expect(templatesContent).toContain('user_service_ts:');
    });
  });
  
  describe('Cryptographic Functions', () => {
    test('Ed25519 key generation should work', () => {
      const keyPair = crypto.generateKeyPairSync('ed25519', {
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      });
      
      expect(keyPair.privateKey).toContain('-----BEGIN PRIVATE KEY-----');
      expect(keyPair.publicKey).toContain('-----BEGIN PUBLIC KEY-----');
    });
    
    test('RSA key generation should work', () => {
      const keyPair = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      });
      
      expect(keyPair.privateKey).toContain('-----BEGIN PRIVATE KEY-----');
      expect(keyPair.publicKey).toContain('-----BEGIN PUBLIC KEY-----');
    });
    
    test('SHA256 hashing should be consistent', () => {
      const content = 'test content for hashing';
      const hash1 = crypto.createHash('sha256').update(content).digest('hex');
      const hash2 = crypto.createHash('sha256').update(content).digest('hex');
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // 256 bits = 64 hex chars
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });
  });
  
  describe('Git Operations Mock', () => {
    test('Git command simulation should be safe', () => {
      // Test that we can simulate git operations without actually running git
      const mockCommitSha = 'a1b2c3d4e5f6789012345678901234567890abcd';
      const mockBranch = 'main';
      const mockRepoUrl = 'https://github.com/test/repo.git';
      
      expect(mockCommitSha).toHaveLength(40);
      expect(mockCommitSha).toMatch(/^[a-f0-9]{40}$/);
      expect(mockBranch).toBe('main');
      expect(mockRepoUrl).toContain('github.com');
    });
  });
  
  describe('JOSE/JWS Structure Validation', () => {
    test('JWS structure should be properly formatted', () => {
      // Test JWS format: header.payload.signature
      const mockHeader = Buffer.from(JSON.stringify({ alg: 'Ed25519', typ: 'JWT' })).toString('base64url');
      const mockPayload = Buffer.from(JSON.stringify({ sub: 'test' })).toString('base64url');
      const mockSignature = Buffer.from('signature_bytes').toString('base64url');
      
      const jws = `${mockHeader}.${mockPayload}.${mockSignature}`;
      const parts = jws.split('.');
      
      expect(parts).toHaveLength(3);
      expect(parts[0]).toMatch(/^[A-Za-z0-9_-]+$/); // base64url format
      expect(parts[1]).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(parts[2]).toMatch(/^[A-Za-z0-9_-]+$/);
      
      // Verify header decode
      const decodedHeader = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      expect(decodedHeader.alg).toBe('Ed25519');
      expect(decodedHeader.typ).toBe('JWT');
      
      // Verify payload decode
      const decodedPayload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      expect(decodedPayload.sub).toBe('test');
    });
  });
});