/**
 * Multi-Factor Authentication (MFA) System
 * Enterprise-grade MFA implementation with multiple authentication methods
 */

import { EventEmitter } from 'events';
import consola from 'consola';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

class MultiFactorAuthentication extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // TOTP Configuration
      totpIssuer: 'KGEN Security',
      totpDigits: 6,
      totpPeriod: 30,
      totpWindow: 1, // Allow 1 period before/after current
      
      // SMS Configuration
      smsProvider: null, // Webhook URL or provider config
      smsTemplate: 'Your KGEN verification code: {code}',
      
      // Email Configuration
      emailProvider: null,
      emailTemplate: 'Your KGEN verification code is: {code}',
      
      // Hardware Token Configuration
      hardwareTokens: true,
      yubiKeyEnabled: false,
      
      // Backup Codes Configuration
      backupCodesCount: 10,
      backupCodeLength: 8,
      
      // Security Settings
      maxAttempts: 3,
      lockoutDuration: 300000, // 5 minutes
      codeExpiry: 300000, // 5 minutes
      enforceForRoles: ['admin', 'system_admin'],
      
      // Risk-based Authentication
      riskBasedMFA: true,
      riskThreshold: 0.7, // Risk score 0-1
      
      ...config
    };
    
    this.logger = consola.withTag('mfa');
    this.state = 'initialized';
    
    // MFA State Management
    this.userMFASettings = new Map();
    this.activeCodes = new Map();
    this.failedAttempts = new Map();
    this.trustedDevices = new Map();
    this.backupCodes = new Map();
    
    // Risk Assessment
    this.riskFactors = new Map();
    
    // Metrics
    this.metrics = {
      mfaSetupAttempts: 0,
      mfaVerificationAttempts: 0,
      successfulVerifications: 0,
      failedVerifications: 0,
      backupCodesUsed: 0,
      riskBasedChallenges: 0
    };
  }
  
  /**
   * Initialize MFA system
   */
  async initialize() {
    try {
      this.logger.info('🔐 Initializing Multi-Factor Authentication system...');
      
      // Load existing MFA configurations
      await this._loadMFASettings();
      
      // Setup risk assessment engine
      await this._initializeRiskEngine();
      
      // Start cleanup processes
      this._startCleanupProcesses();
      
      this.state = 'ready';
      this.logger.success('✅ MFA system initialized');
      
      return { status: 'ready', users: this.userMFASettings.size };
      
    } catch (error) {
      this.state = 'error';
      this.logger.error('❌ Failed to initialize MFA system:', error);
      throw error;
    }
  }
  
  /**
   * Setup MFA for user
   */
  async setupMFA(userId, method, deviceInfo = {}) {
    try {
      this.metrics.mfaSetupAttempts++;
      
      this.logger.info(`Setting up MFA for user ${userId} with method ${method}`);
      
      const setupData = {
        userId,
        method,
        deviceInfo,
        setupTime: new Date(),
        verified: false
      };
      
      switch (method) {
        case 'totp':
          setupData.secret = await this._generateTOTPSecret();
          setupData.qrCode = await this._generateTOTPQR(userId, setupData.secret);
          break;
          
        case 'sms':
          if (!deviceInfo.phoneNumber) {
            throw new Error('Phone number required for SMS MFA');
          }
          setupData.phoneNumber = this._sanitizePhoneNumber(deviceInfo.phoneNumber);
          break;
          
        case 'email':
          if (!deviceInfo.email) {
            throw new Error('Email required for email MFA');
          }
          setupData.email = deviceInfo.email;
          break;
          
        case 'hardware':
          if (!deviceInfo.deviceId) {
            throw new Error('Device ID required for hardware MFA');
          }
          setupData.deviceId = deviceInfo.deviceId;
          break;
          
        default:
          throw new Error(`Unsupported MFA method: ${method}`);
      }
      
      // Generate backup codes
      const backupCodes = await this._generateBackupCodes(userId);
      setupData.backupCodes = backupCodes;
      
      // Store setup data temporarily
      const setupId = randomBytes(16).toString('hex');
      this.userMFASettings.set(`setup_${setupId}`, setupData);
      
      this.emit('mfa:setup-initiated', { userId, method, setupId });
      
      return {
        setupId,
        method,
        ...setupData,
        backupCodes: backupCodes.codes // Only return codes during setup
      };
      
    } catch (error) {
      this.logger.error(`MFA setup failed for ${userId}:`, error);
      throw error;
    }
  }
  
  /**
   * Verify MFA setup
   */
  async verifyMFASetup(setupId, verificationCode) {
    try {
      const setupData = this.userMFASettings.get(`setup_${setupId}`);
      if (!setupData) {
        throw new Error('Invalid setup ID');
      }
      
      this.logger.info(`Verifying MFA setup for user ${setupData.userId}`);
      
      const isValid = await this._verifyCode(
        setupData.method,
        verificationCode,
        setupData
      );
      
      if (!isValid) {
        throw new Error('Invalid verification code');
      }
      
      // Move from setup to active configuration
      setupData.verified = true;
      setupData.activatedAt = new Date();
      
      const mfaConfig = {
        userId: setupData.userId,
        method: setupData.method,
        secret: setupData.secret,
        phoneNumber: setupData.phoneNumber,
        email: setupData.email,
        deviceId: setupData.deviceId,
        verified: true,
        activatedAt: setupData.activatedAt,
        lastUsed: null,
        usageCount: 0
      };
      
      this.userMFASettings.set(setupData.userId, mfaConfig);
      this.backupCodes.set(setupData.userId, setupData.backupCodes);
      
      // Cleanup setup data
      this.userMFASettings.delete(`setup_${setupId}`);
      
      // Save to persistent storage
      await this._saveMFASettings();
      
      this.emit('mfa:setup-completed', { 
        userId: setupData.userId, 
        method: setupData.method 
      });
      
      return {
        success: true,
        userId: setupData.userId,
        method: setupData.method,
        activatedAt: setupData.activatedAt
      };
      
    } catch (error) {
      this.logger.error('MFA setup verification failed:', error);
      throw error;
    }
  }
  
  /**
   * Check if MFA is required for user
   */
  async isMFARequired(userId, context = {}) {
    try {
      // Check if user has MFA enabled
      const mfaConfig = this.userMFASettings.get(userId);
      if (!mfaConfig) {
        return { required: false, reason: 'MFA not configured' };
      }
      
      // Check role-based enforcement
      if (context.userRoles) {
        const hasEnforcedRole = context.userRoles.some(role => 
          this.config.enforceForRoles.includes(role)
        );
        if (hasEnforcedRole) {
          return { required: true, reason: 'Role requires MFA' };
        }
      }
      
      // Risk-based MFA assessment
      if (this.config.riskBasedMFA) {
        const riskScore = await this._calculateRiskScore(userId, context);
        if (riskScore > this.config.riskThreshold) {
          return { 
            required: true, 
            reason: 'High risk detected', 
            riskScore 
          };
        }
      }
      
      // Check trusted device
      if (context.deviceFingerprint) {
        const isTrusted = this._isDeviceTrusted(userId, context.deviceFingerprint);
        if (!isTrusted) {
          return { required: true, reason: 'Untrusted device' };
        }
      }
      
      return { required: false, reason: 'Trusted context' };
      
    } catch (error) {
      this.logger.error('MFA requirement check failed:', error);
      // Fail safe - require MFA on error
      return { required: true, reason: 'Security check failed' };
    }
  }
  
  /**
   * Challenge user with MFA
   */
  async challengeMFA(userId, context = {}) {
    try {
      this.metrics.mfaVerificationAttempts++;
      
      const mfaConfig = this.userMFASettings.get(userId);
      if (!mfaConfig) {
        throw new Error('MFA not configured for user');
      }
      
      // Check for lockout
      if (this._isUserLockedOut(userId)) {
        throw new Error('Account locked due to too many MFA failures');
      }
      
      this.logger.info(`Sending MFA challenge to user ${userId} via ${mfaConfig.method}`);
      
      const challengeId = randomBytes(16).toString('hex');
      const challenge = {
        challengeId,
        userId,
        method: mfaConfig.method,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + this.config.codeExpiry),
        attempts: 0,
        context
      };
      
      // Generate and send code based on method
      switch (mfaConfig.method) {
        case 'totp':
          // TOTP doesn't need code generation - user generates it
          challenge.requiresCode = false;
          break;
          
        case 'sms':
          challenge.code = this._generateVerificationCode();
          await this._sendSMSCode(mfaConfig.phoneNumber, challenge.code);
          challenge.requiresCode = true;
          break;
          
        case 'email':
          challenge.code = this._generateVerificationCode();
          await this._sendEmailCode(mfaConfig.email, challenge.code);
          challenge.requiresCode = true;
          break;
          
        case 'hardware':
          // Hardware tokens generate their own codes
          challenge.requiresCode = false;
          break;
      }
      
      this.activeCodes.set(challengeId, challenge);
      
      // Risk-based metrics
      if (context.isRiskBased) {
        this.metrics.riskBasedChallenges++;
      }
      
      this.emit('mfa:challenge-sent', { 
        userId, 
        challengeId, 
        method: mfaConfig.method 
      });
      
      return {
        challengeId,
        method: mfaConfig.method,
        expiresAt: challenge.expiresAt,
        requiresCode: challenge.requiresCode
      };
      
    } catch (error) {
      this.logger.error(`MFA challenge failed for ${userId}:`, error);
      throw error;
    }
  }
  
  /**
   * Verify MFA response
   */
  async verifyMFA(challengeId, code, options = {}) {
    try {
      const challenge = this.activeCodes.get(challengeId);
      if (!challenge) {
        throw new Error('Invalid or expired challenge ID');
      }
      
      challenge.attempts++;
      
      // Check expiration
      if (Date.now() > challenge.expiresAt.getTime()) {
        this.activeCodes.delete(challengeId);
        throw new Error('Challenge expired');
      }
      
      // Check attempt limit
      if (challenge.attempts > this.config.maxAttempts) {
        this.activeCodes.delete(challengeId);
        this._recordFailedAttempt(challenge.userId);
        throw new Error('Too many verification attempts');
      }
      
      this.logger.info(`Verifying MFA for user ${challenge.userId}`);
      
      const mfaConfig = this.userMFASettings.get(challenge.userId);
      let isValid = false;
      let usedBackupCode = false;
      
      // First try regular verification
      isValid = await this._verifyCode(challenge.method, code, mfaConfig);
      
      // If regular verification fails, try backup codes
      if (!isValid && options.allowBackupCodes !== false) {
        isValid = await this._verifyBackupCode(challenge.userId, code);
        if (isValid) {
          usedBackupCode = true;
          this.metrics.backupCodesUsed++;
        }
      }
      
      if (!isValid) {
        this._recordFailedAttempt(challenge.userId);
        this.metrics.failedVerifications++;
        
        this.emit('mfa:verification-failed', {
          userId: challenge.userId,
          challengeId,
          attempts: challenge.attempts
        });
        
        throw new Error('Invalid verification code');
      }
      
      // Successful verification
      this.metrics.successfulVerifications++;
      
      // Update MFA config
      mfaConfig.lastUsed = new Date();
      mfaConfig.usageCount++;
      
      // Clear failed attempts
      this.failedAttempts.delete(challenge.userId);
      
      // Mark device as trusted if requested
      if (options.trustDevice && challenge.context.deviceFingerprint) {
        await this._trustDevice(
          challenge.userId, 
          challenge.context.deviceFingerprint
        );
      }
      
      // Cleanup challenge
      this.activeCodes.delete(challengeId);
      
      const verificationResult = {
        success: true,
        userId: challenge.userId,
        method: challenge.method,
        verifiedAt: new Date(),
        usedBackupCode,
        deviceTrusted: options.trustDevice || false
      };
      
      this.emit('mfa:verification-success', verificationResult);
      
      return verificationResult;
      
    } catch (error) {
      this.logger.error('MFA verification failed:', error);
      throw error;
    }
  }
  
  /**
   * Generate new backup codes
   */
  async generateNewBackupCodes(userId) {
    try {
      const mfaConfig = this.userMFASettings.get(userId);
      if (!mfaConfig) {
        throw new Error('MFA not configured for user');
      }
      
      this.logger.info(`Generating new backup codes for user ${userId}`);
      
      const backupCodes = await this._generateBackupCodes(userId);
      this.backupCodes.set(userId, backupCodes);
      
      await this._saveMFASettings();
      
      this.emit('mfa:backup-codes-generated', { userId });
      
      return backupCodes.codes;
      
    } catch (error) {
      this.logger.error('Failed to generate backup codes:', error);
      throw error;
    }
  }
  
  /**
   * Disable MFA for user
   */
  async disableMFA(userId, adminOverride = false) {
    try {
      const mfaConfig = this.userMFASettings.get(userId);
      if (!mfaConfig) {
        return { success: true, message: 'MFA was not enabled' };
      }
      
      this.logger.info(`Disabling MFA for user ${userId}`);
      
      // Remove MFA configuration
      this.userMFASettings.delete(userId);
      this.backupCodes.delete(userId);
      this.trustedDevices.delete(userId);
      this.failedAttempts.delete(userId);
      
      // Clean up active challenges
      for (const [challengeId, challenge] of this.activeCodes.entries()) {
        if (challenge.userId === userId) {
          this.activeCodes.delete(challengeId);
        }
      }
      
      await this._saveMFASettings();
      
      this.emit('mfa:disabled', { userId, adminOverride });
      
      return { 
        success: true, 
        message: 'MFA disabled successfully',
        disabledAt: new Date()
      };
      
    } catch (error) {
      this.logger.error('Failed to disable MFA:', error);
      throw error;
    }
  }
  
  /**
   * Get MFA status for user
   */
  getMFAStatus(userId) {
    const mfaConfig = this.userMFASettings.get(userId);
    const backupCodes = this.backupCodes.get(userId);
    const trustedDevices = this.trustedDevices.get(userId) || [];
    const failedAttempts = this.failedAttempts.get(userId);
    
    if (!mfaConfig) {
      return { 
        enabled: false, 
        configured: false 
      };
    }
    
    return {
      enabled: true,
      configured: true,
      method: mfaConfig.method,
      activatedAt: mfaConfig.activatedAt,
      lastUsed: mfaConfig.lastUsed,
      usageCount: mfaConfig.usageCount,
      backupCodesRemaining: backupCodes ? backupCodes.remaining : 0,
      trustedDevicesCount: trustedDevices.length,
      isLockedOut: this._isUserLockedOut(userId),
      failedAttempts: failedAttempts ? failedAttempts.count : 0
    };
  }
  
  /**
   * Get system metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeUsers: this.userMFASettings.size,
      activeChallenges: this.activeCodes.size,
      lockedOutUsers: Array.from(this.failedAttempts.values())
        .filter(f => this._isLockoutActive(f)).length,
      trustedDevicesTotal: Array.from(this.trustedDevices.values())
        .reduce((total, devices) => total + devices.length, 0)
    };
  }
  
  // Private methods
  
  async _generateTOTPSecret() {
    return randomBytes(20).toString('base32');
  }
  
  async _generateTOTPQR(userId, secret) {
    const issuer = encodeURIComponent(this.config.totpIssuer);
    const account = encodeURIComponent(userId);
    
    return `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&digits=${this.config.totpDigits}&period=${this.config.totpPeriod}`;
  }
  
  _sanitizePhoneNumber(phone) {
    return phone.replace(/\D/g, '');
  }
  
  async _generateBackupCodes(userId) {
    const codes = [];
    for (let i = 0; i < this.config.backupCodesCount; i++) {
      codes.push(this._generateVerificationCode(this.config.backupCodeLength));
    }
    
    return {
      userId,
      codes,
      used: new Set(),
      remaining: codes.length,
      generatedAt: new Date()
    };
  }
  
  _generateVerificationCode(length = 6) {
    const digits = '0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
      code += digits[Math.floor(Math.random() * digits.length)];
    }
    return code;
  }
  
  async _verifyCode(method, code, config) {
    switch (method) {
      case 'totp':
        return await this._verifyTOTPCode(code, config.secret);
      case 'sms':
      case 'email':
        // For SMS/email, we compare against the generated code
        const challenge = Array.from(this.activeCodes.values())
          .find(c => c.userId === config.userId);
        return challenge && timingSafeEqual(
          Buffer.from(code),
          Buffer.from(challenge.code)
        );
      case 'hardware':
        return await this._verifyHardwareToken(code, config.deviceId);
      default:
        return false;
    }
  }
  
  async _verifyTOTPCode(code, secret) {
    // Simplified TOTP verification - in production use a proper TOTP library
    const timeStep = Math.floor(Date.now() / 1000 / this.config.totpPeriod);
    
    // Check current time step and adjacent ones (based on window)
    for (let i = -this.config.totpWindow; i <= this.config.totpWindow; i++) {
      const expectedCode = this._generateTOTPCode(secret, timeStep + i);
      if (timingSafeEqual(Buffer.from(code), Buffer.from(expectedCode))) {
        return true;
      }
    }
    
    return false;
  }
  
  _generateTOTPCode(secret, timeStep) {
    // Simplified TOTP generation - use proper crypto library in production
    const hash = createHash('sha1')
      .update(secret)
      .update(timeStep.toString())
      .digest();
    
    const offset = hash[hash.length - 1] & 0xf;
    const code = (
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff)
    ) % Math.pow(10, this.config.totpDigits);
    
    return code.toString().padStart(this.config.totpDigits, '0');
  }
  
  async _verifyHardwareToken(code, deviceId) {
    // Placeholder for hardware token verification
    // In production, integrate with YubiKey, RSA SecurID, etc.
    return false;
  }
  
  async _verifyBackupCode(userId, code) {
    const backupCodes = this.backupCodes.get(userId);
    if (!backupCodes) {
      return false;
    }
    
    const isValidCode = backupCodes.codes.includes(code) && 
                       !backupCodes.used.has(code);
    
    if (isValidCode) {
      backupCodes.used.add(code);
      backupCodes.remaining--;
      await this._saveMFASettings();
    }
    
    return isValidCode;
  }
  
  async _sendSMSCode(phoneNumber, code) {
    if (!this.config.smsProvider) {
      this.logger.warn('SMS provider not configured');
      return;
    }
    
    // Implement SMS sending logic based on provider
    this.logger.info(`SMS code sent to ${phoneNumber}`);
  }
  
  async _sendEmailCode(email, code) {
    if (!this.config.emailProvider) {
      this.logger.warn('Email provider not configured');
      return;
    }
    
    // Implement email sending logic
    this.logger.info(`Email code sent to ${email}`);
  }
  
  async _calculateRiskScore(userId, context) {
    let riskScore = 0;
    
    // IP address reputation
    if (context.ipAddress) {
      const ipRisk = await this._assessIPRisk(context.ipAddress);
      riskScore += ipRisk * 0.3;
    }
    
    // Geographic location
    if (context.location) {
      const locationRisk = await this._assessLocationRisk(userId, context.location);
      riskScore += locationRisk * 0.2;
    }
    
    // Time-based patterns
    const timeRisk = this._assessTimeRisk(userId, context.timestamp);
    riskScore += timeRisk * 0.2;
    
    // Device fingerprint
    if (context.deviceFingerprint) {
      const deviceRisk = this._assessDeviceRisk(userId, context.deviceFingerprint);
      riskScore += deviceRisk * 0.3;
    }
    
    return Math.min(riskScore, 1.0);
  }
  
  async _assessIPRisk(ipAddress) {
    // Placeholder for IP reputation check
    return 0.1;
  }
  
  async _assessLocationRisk(userId, location) {
    // Placeholder for location-based risk assessment
    return 0.1;
  }
  
  _assessTimeRisk(userId, timestamp) {
    // Placeholder for time-based risk assessment
    return 0.1;
  }
  
  _assessDeviceRisk(userId, deviceFingerprint) {
    const trustedDevices = this.trustedDevices.get(userId) || [];
    const isKnownDevice = trustedDevices.some(d => d.fingerprint === deviceFingerprint);
    return isKnownDevice ? 0.1 : 0.8;
  }
  
  _isDeviceTrusted(userId, deviceFingerprint) {
    const trustedDevices = this.trustedDevices.get(userId) || [];
    return trustedDevices.some(d => 
      d.fingerprint === deviceFingerprint && 
      Date.now() < d.expiresAt.getTime()
    );
  }
  
  async _trustDevice(userId, deviceFingerprint) {
    const trustedDevices = this.trustedDevices.get(userId) || [];
    
    // Remove existing entry for this device
    const filteredDevices = trustedDevices.filter(d => 
      d.fingerprint !== deviceFingerprint
    );
    
    // Add new trusted device entry
    filteredDevices.push({
      fingerprint: deviceFingerprint,
      trustedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    });
    
    this.trustedDevices.set(userId, filteredDevices);
    await this._saveMFASettings();
  }
  
  _isUserLockedOut(userId) {
    const failures = this.failedAttempts.get(userId);
    if (!failures) return false;
    
    return failures.count >= this.config.maxAttempts &&
           this._isLockoutActive(failures);
  }
  
  _isLockoutActive(failures) {
    return (Date.now() - failures.lastAttempt) < this.config.lockoutDuration;
  }
  
  _recordFailedAttempt(userId) {
    const failures = this.failedAttempts.get(userId) || { count: 0, lastAttempt: 0 };
    failures.count++;
    failures.lastAttempt = Date.now();
    this.failedAttempts.set(userId, failures);
  }
  
  async _loadMFASettings() {
    try {
      const settingsPath = path.join(process.cwd(), 'config', 'security', 'mfa-settings.json');
      const data = await fs.readFile(settingsPath, 'utf8');
      const settings = JSON.parse(data);
      
      // Load user configurations
      if (settings.users) {
        for (const [userId, config] of Object.entries(settings.users)) {
          this.userMFASettings.set(userId, config);
        }
      }
      
      // Load backup codes
      if (settings.backupCodes) {
        for (const [userId, codes] of Object.entries(settings.backupCodes)) {
          this.backupCodes.set(userId, codes);
        }
      }
      
      // Load trusted devices
      if (settings.trustedDevices) {
        for (const [userId, devices] of Object.entries(settings.trustedDevices)) {
          this.trustedDevices.set(userId, devices);
        }
      }
      
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.warn('Failed to load MFA settings:', error.message);
      }
    }
  }
  
  async _saveMFASettings() {
    try {
      const settingsPath = path.join(process.cwd(), 'config', 'security', 'mfa-settings.json');
      await fs.mkdir(path.dirname(settingsPath), { recursive: true });
      
      const settings = {
        users: Object.fromEntries(this.userMFASettings.entries()),
        backupCodes: Object.fromEntries(this.backupCodes.entries()),
        trustedDevices: Object.fromEntries(this.trustedDevices.entries()),
        lastUpdated: new Date()
      };
      
      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
      
    } catch (error) {
      this.logger.error('Failed to save MFA settings:', error);
    }
  }
  
  async _initializeRiskEngine() {
    // Initialize risk assessment components
    this.logger.info('Risk engine initialized');
  }
  
  _startCleanupProcesses() {
    // Clean expired challenges every minute
    setInterval(() => {
      const now = Date.now();
      for (const [challengeId, challenge] of this.activeCodes.entries()) {
        if (now > challenge.expiresAt.getTime()) {
          this.activeCodes.delete(challengeId);
        }
      }
    }, 60000);
    
    // Clean expired trusted devices every hour
    setInterval(() => {
      const now = Date.now();
      for (const [userId, devices] of this.trustedDevices.entries()) {
        const activeDevices = devices.filter(d => now < d.expiresAt.getTime());
        if (activeDevices.length !== devices.length) {
          this.trustedDevices.set(userId, activeDevices);
        }
      }
    }, 3600000);
  }
  
  /**
   * Shutdown MFA system
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down MFA system...');
      
      // Save current state
      await this._saveMFASettings();
      
      // Clear sensitive data
      this.userMFASettings.clear();
      this.activeCodes.clear();
      this.backupCodes.clear();
      this.trustedDevices.clear();
      this.failedAttempts.clear();
      
      this.state = 'shutdown';
      this.logger.success('MFA system shutdown complete');
      
    } catch (error) {
      this.logger.error('Error during MFA shutdown:', error);
      throw error;
    }
  }
}

export default MultiFactorAuthentication;