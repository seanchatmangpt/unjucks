// Test the Noble crypto APIs
import * as ed25519 from '@noble/ed25519';
import * as secp256k1 from '@noble/secp256k1';
import crypto from 'crypto';

console.log('Testing Noble Ed25519 API:');
console.log('ed25519 keys:', Object.keys(ed25519));
console.log('Has utils:', !!ed25519.utils);

console.log('\nTesting Noble secp256k1 API:');
console.log('secp256k1 keys:', Object.keys(secp256k1));
console.log('Has utils:', !!secp256k1.utils);

// Test direct key generation
try {
  console.log('\nTesting direct crypto.randomBytes for Ed25519:');
  const privateKey = crypto.randomBytes(32);
  console.log('Private key generated:', privateKey.length, 'bytes');
  
  const publicKey = ed25519.getPublicKey(privateKey);
  console.log('Public key generated:', publicKey.length, 'bytes');
  
  console.log('\nTesting secp256k1 direct:');
  const privateKeySecp = crypto.randomBytes(32);
  const publicKeySecp = secp256k1.getPublicKey(privateKeySecp);
  console.log('secp256k1 public key generated:', publicKeySecp.length, 'bytes');
  
} catch (error) {
  console.error('Error:', error.message);
}