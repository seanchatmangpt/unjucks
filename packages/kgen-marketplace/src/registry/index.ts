/**
 * Registry module exports
 */

// Core interfaces and base classes
export {
  RegistryAdapter,
  RegistryAdapterFactory,
  RegistryPackage,
  SearchOptions,
  SearchResult,
  PublishOptions,
  RegistryConfig,
  DEFAULT_REGISTRY_CONFIG,
} from './adapter.js';

// Main client
export {
  RegistryClient,
  RegistryClientConfig,
  RegistryClientOptions,
} from './client.js';

// Registry implementations
export { NpmRegistryAdapter } from './npm.js';
export { OciRegistryAdapter } from './oci.js';
export { GitRegistryAdapter } from './git.js';

// Trust and verification
export {
  TrustVerifier,
  TrustPolicy,
  VerificationResult,
  TrustUtils,
} from './trust.js';

// Convenience factory function
import { RegistryClient, RegistryClientConfig } from './client.js';

export function createRegistryClient(config?: Partial<RegistryClientConfig>): RegistryClient {
  return new RegistryClient({ config });
}

// Default configurations for common registries
export const REGISTRY_PRESETS = {
  npm: {
    type: 'npm' as const,
    registry: 'https://registry.npmjs.org',
  },
  github: {
    type: 'oci' as const,
    registry: 'ghcr.io',
  },
  dockerHub: {
    type: 'oci' as const,
    registry: 'registry-1.docker.io',
  },
  gitHub: {
    type: 'git' as const,
    registry: 'https://github.com/your-org/registry.git',
  },
} as const;