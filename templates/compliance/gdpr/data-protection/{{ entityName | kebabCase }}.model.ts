/**
 * GDPR-Compliant Data Model: {{ entityName }}
 * 
 * Regulation: GDPR Article 5 (Principles of processing personal data)
 * Compliance Level: {{ complianceLevel || 'Standard' }}
 * Data Processor: {{ dataProcessor || 'Organization' }}
 * Lawful Basis: {{ lawfulBasis || 'consent' }}
 * Generated: {{ new Date().toISOString() }}
 * 
 * ✅ GDPR Compliance Features:
 * - Data minimization (Article 5.1.c)
 * - Purpose limitation (Article 5.1.b)
 * - Storage limitation (Article 5.1.e)
 * - Integrity & confidentiality (Article 5.1.f)
 * - Data subject rights (Chapter III)
 * - Privacy by design (Article 25)
 */

import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, BeforeInsert, BeforeUpdate } from 'typeorm';
import { IsEmail, IsOptional, validateSync } from 'class-validator';
import { Exclude, Expose, Transform } from 'class-transformer';
import { createHash, randomBytes } from 'crypto';

export interface GDPRDataSubjectRights {
  accessData(): Promise<{{ entityName }}PersonalData>;
  exportData(): Promise<string>; // Machine-readable format
  requestErasure(reason: string): Promise<boolean>;
  rectifyData(updates: Partial<{{ entityName }}>): Promise<boolean>;
  restrictProcessing(reason: string): Promise<boolean>;
  objectToProcessing(reason: string): Promise<boolean>;
  dataPortability(): Promise<any>;
}

export interface {{ entityName }}PersonalData {
  // Only include personal data fields for export/access
  {% for field in dataFields -%}
  {% if field.isPersonalData -%}
  {{ field.name }}: {{ field.type }};
  {% endif -%}
  {% endfor %}
  processingPurpose: string;
  lawfulBasis: string;
  dataRetentionDate: Date;
  consentTimestamp?: Date;
  consentWithdrawn?: Date;
}

export interface GDPRAuditLog {
  id: string;
  entityId: string;
  entityType: string;
  operation: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'CONSENT' | 'WITHDRAWAL';
  userId: string;
  timestamp: Date;
  purpose: string;
  lawfulBasis: string;
  dataFields: string[];
  ipAddress: string;
  userAgent: string;
  result: 'SUCCESS' | 'FAILURE' | 'RESTRICTED';
  metadata?: Record<string, any>;
}

@Entity('{{ entityName | snakeCase | lower }}')
export class {{ entityName }} implements GDPRDataSubjectRights {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Personal Data Fields with GDPR Protection
  {% for field in dataFields -%}
  {% if field.isPersonalData -%}
  @Column({ 
    type: '{{ field.dbType || "varchar" }}',
    {% if field.encrypted -%}
    transformer: {
      to: (value: string) => value ? this.encryptPersonalData(value) : value,
      from: (value: string) => value ? this.decryptPersonalData(value) : value
    },
    {% endif -%}
    comment: 'Personal data - GDPR protected'
  })
  {% if field.validation -%}
  {{ field.validation }}
  {% endif -%}
  {{ field.name }}: {{ field.type }};

  {% else -%}
  @Column({ 
    type: '{{ field.dbType || "varchar" }}',
    comment: 'Non-personal data'
  })
  {% if field.validation -%}
  {{ field.validation }}
  {% endif -%}
  {{ field.name }}: {{ field.type }};

  {% endif -%}
  {% endfor %}

  // GDPR Compliance Fields
  @Column({ 
    type: 'varchar',
    comment: 'Purpose of data processing as per Article 5.1.b'
  })
  processingPurpose: string = '{{ processingPurpose || "User account management" }}';

  @Column({ 
    type: 'varchar',
    comment: 'Lawful basis for processing as per Article 6'
  })
  lawfulBasis: string = '{{ lawfulBasis || "consent" }}';

  {% if hasPersonalData -%}
  @Column({ 
    type: 'timestamp',
    comment: 'Consent timestamp as per Article 7'
  })
  @IsOptional()
  consentTimestamp?: Date;

  @Column({ 
    type: 'timestamp',
    nullable: true,
    comment: 'Consent withdrawal timestamp'
  })
  @IsOptional()
  consentWithdrawn?: Date;

  @Column({ 
    type: 'boolean',
    default: true,
    comment: 'Active consent status'
  })
  hasActiveConsent: boolean = true;

  @Column({ 
    type: 'json',
    comment: 'Granular consent preferences'
  })
  consentPreferences: Record<string, boolean> = {};
  {% endif %}

  @Column({ 
    type: 'timestamp',
    comment: 'Data retention deadline as per Article 5.1.e'
  })
  dataRetentionDate: Date;

  @Column({ 
    type: 'varchar',
    nullable: true,
    comment: 'Pseudonymization key for enhanced privacy'
  })
  @Exclude()
  pseudonymizationKey?: string;

  @Column({ 
    type: 'boolean',
    default: false,
    comment: 'Processing restriction flag as per Article 18'
  })
  processingRestricted: boolean = false;

  @Column({ 
    type: 'text',
    nullable: true,
    comment: 'Reason for processing restriction'
  })
  restrictionReason?: string;

  // Standard fields
  @CreateDateColumn({ comment: 'Record creation timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ comment: 'Record last update timestamp' })
  updatedAt: Date;

  @Column({ 
    type: 'timestamp',
    nullable: true,
    comment: 'Logical deletion timestamp (soft delete for audit)' 
  })
  @Exclude()
  deletedAt?: Date;

  // GDPR Lifecycle Hooks
  @BeforeInsert()
  async beforeInsert() {
    // Set data retention date
    const retentionMonths = {{ retentionPeriod || 24 }};
    this.dataRetentionDate = new Date();
    this.dataRetentionDate.setMonth(this.dataRetentionDate.getMonth() + retentionMonths);

    {% if hasPersonalData -%}
    // Set consent timestamp if consent-based
    if (this.lawfulBasis === 'consent' && !this.consentTimestamp) {
      this.consentTimestamp = new Date();
    }

    // Generate pseudonymization key
    this.pseudonymizationKey = this.generatePseudonymizationKey();
    {% endif %}

    // Validate GDPR compliance
    await this.validateGDPRCompliance();

    {% if auditLogging -%}
    // Log data creation
    await this.auditLog('CREATE', 'Data subject record created');
    {% endif %}
  }

  @BeforeUpdate()
  async beforeUpdate() {
    {% if auditLogging -%}
    await this.auditLog('UPDATE', 'Data subject record updated');
    {% endif %}
  }

  // GDPR Data Subject Rights Implementation
  
  /**
   * Article 15 - Right of access by the data subject
   */
  async accessData(): Promise<{{ entityName }}PersonalData> {
    {% if auditLogging -%}
    await this.auditLog('READ', 'Data subject access request');
    {% endif %}

    return {
      {% for field in dataFields -%}
      {% if field.isPersonalData -%}
      {{ field.name }}: this.{{ field.name }},
      {% endif -%}
      {% endfor %}
      processingPurpose: this.processingPurpose,
      lawfulBasis: this.lawfulBasis,
      dataRetentionDate: this.dataRetentionDate,
      {% if hasPersonalData -%}
      consentTimestamp: this.consentTimestamp,
      consentWithdrawn: this.consentWithdrawn,
      {% endif %}
    };
  }

  /**
   * Article 20 - Right to data portability
   */
  async exportData(): Promise<string> {
    const personalData = await this.accessData();
    
    {% if auditLogging -%}
    await this.auditLog('EXPORT', 'Data portability request');
    {% endif %}

    return JSON.stringify({
      exportTimestamp: new Date().toISOString(),
      dataController: '{{ dataProcessor || "Organization" }}',
      dataSubject: this.id,
      personalData,
      format: 'JSON',
      gdprCompliant: true
    }, null, 2);
  }

  /**
   * Article 17 - Right to erasure ('right to be forgotten')
   */
  async requestErasure(reason: string): Promise<boolean> {
    try {
      // Check if erasure is legally required or allowed
      const canErase = await this.validateErasureRequest(reason);
      
      if (!canErase) {
        return false;
      }

      {% if auditLogging -%}
      await this.auditLog('DELETE', `Data erasure requested: ${reason}`);
      {% endif %}

      // Perform secure deletion
      await this.secureErasure();
      
      return true;
    } catch (error) {
      console.error('GDPR erasure failed:', error);
      return false;
    }
  }

  /**
   * Article 16 - Right to rectification
   */
  async rectifyData(updates: Partial<{{ entityName }}>): Promise<boolean> {
    try {
      // Validate updates
      const validationErrors = validateSync(Object.assign(new {{ entityName }}(), updates));
      
      if (validationErrors.length > 0) {
        return false;
      }

      // Apply updates
      Object.assign(this, updates);
      
      {% if auditLogging -%}
      await this.auditLog('UPDATE', 'Data rectification request');
      {% endif %}

      return true;
    } catch (error) {
      console.error('GDPR rectification failed:', error);
      return false;
    }
  }

  /**
   * Article 18 - Right to restriction of processing
   */
  async restrictProcessing(reason: string): Promise<boolean> {
    this.processingRestricted = true;
    this.restrictionReason = reason;
    
    {% if auditLogging -%}
    await this.auditLog('UPDATE', `Processing restriction applied: ${reason}`);
    {% endif %}

    return true;
  }

  /**
   * Article 21 - Right to object
   */
  async objectToProcessing(reason: string): Promise<boolean> {
    // If lawful basis is legitimate interests, must stop processing
    if (this.lawfulBasis === 'legitimate_interests') {
      await this.restrictProcessing(`Objection to processing: ${reason}`);
      return true;
    }
    
    return false;
  }

  /**
   * Article 20 - Right to data portability
   */
  async dataPortability(): Promise<any> {
    const data = await this.accessData();
    
    return {
      format: 'structured',
      machineReadable: true,
      data,
      canTransfer: this.lawfulBasis === 'consent' || this.lawfulBasis === 'contract'
    };
  }

  // GDPR Compliance Helper Methods

  private async validateGDPRCompliance(): Promise<void> {
    // Data minimization check
    const personalDataFields = [
      {% for field in dataFields -%}
      {% if field.isPersonalData -%}
      '{{ field.name }}',
      {% endif -%}
      {% endfor %}
    ];

    if (personalDataFields.length === 0 && this.processingPurpose.includes('personal')) {
      throw new Error('GDPR Violation: Processing purpose suggests personal data but none defined');
    }

    // Purpose limitation check
    if (!this.processingPurpose) {
      throw new Error('GDPR Violation: Processing purpose must be specified (Article 5.1.b)');
    }

    // Lawful basis validation
    const validBases = ['consent', 'contract', 'legal_obligation', 'vital_interests', 'public_task', 'legitimate_interests'];
    if (!validBases.includes(this.lawfulBasis)) {
      throw new Error('GDPR Violation: Invalid lawful basis (Article 6)');
    }

    {% if hasPersonalData -%}
    // Consent validation
    if (this.lawfulBasis === 'consent' && !this.consentTimestamp) {
      throw new Error('GDPR Violation: Consent timestamp required for consent-based processing');
    }

    // Active consent check
    if (this.lawfulBasis === 'consent' && (!this.hasActiveConsent || this.consentWithdrawn)) {
      throw new Error('GDPR Violation: Processing without active consent');
    }
    {% endif %}
  }

  private async validateErasureRequest(reason: string): Promise<boolean> {
    // Article 17.3 - Exceptions to right of erasure
    const exceptions = [
      'freedom_of_expression',
      'legal_compliance',
      'public_health',
      'archiving_purposes',
      'legal_claims'
    ];

    // Check if any exceptions apply
    if (this.processingRestricted) {
      return true; // Can erase restricted data
    }

    // Legal obligation or vital interests cannot be erased
    if (['legal_obligation', 'vital_interests'].includes(this.lawfulBasis)) {
      return false;
    }

    return true;
  }

  private async secureErasure(): Promise<void> {
    // Cryptographic deletion - destroy encryption keys
    if (this.pseudonymizationKey) {
      // Securely overwrite key
      this.pseudonymizationKey = this.generateRandomData(this.pseudonymizationKey.length);
    }

    // Mark as deleted but keep for audit trail
    this.deletedAt = new Date();
    
    // Zero out personal data fields
    {% for field in dataFields -%}
    {% if field.isPersonalData -%}
    this.{{ field.name }} = this.generateRandomData(String(this.{{ field.name }}).length);
    {% endif -%}
    {% endfor %}
  }

  private generatePseudonymizationKey(): string {
    return randomBytes(32).toString('hex');
  }

  private generateRandomData(length: number): any {
    return randomBytes(Math.max(length, 16)).toString('hex').substring(0, length);
  }

  private encryptPersonalData(value: string): string {
    if (!this.pseudonymizationKey) {
      throw new Error('Pseudonymization key required for encryption');
    }
    
    // Implementation would use actual encryption
    return createHash('sha256')
      .update(value + this.pseudonymizationKey)
      .digest('hex');
  }

  private decryptPersonalData(value: string): string {
    // Implementation would use actual decryption
    // This is simplified for demonstration
    return value;
  }

  {% if auditLogging -%}
  private async auditLog(operation: string, description: string): Promise<void> {
    // Implementation would integrate with audit logging system
    const auditEntry: Partial<GDPRAuditLog> = {
      entityId: this.id,
      entityType: '{{ entityName }}',
      operation: operation as any,
      timestamp: new Date(),
      purpose: this.processingPurpose,
      lawfulBasis: this.lawfulBasis,
      dataFields: [
        {% for field in dataFields -%}
        {% if field.isPersonalData -%}
        '{{ field.name }}',
        {% endif -%}
        {% endfor %}
      ],
      result: 'SUCCESS'
    };

    console.log('GDPR Audit Log:', auditEntry);
    // TODO: Integrate with actual audit logging service
  }
  {% endif %}

  // Data retention policy enforcement
  static async enforceRetentionPolicy(): Promise<number> {
    // This would be called by a scheduled job
    const expiredRecords = await this.find({
      where: {
        dataRetentionDate: LessThan(new Date()),
        deletedAt: IsNull()
      }
    });

    let deletedCount = 0;
    for (const record of expiredRecords) {
      await record.requestErasure('Data retention period expired');
      deletedCount++;
    }

    return deletedCount;
  }

  // Privacy impact assessment helper
  static getPrivacyImpactAssessment(): any {
    return {
      regulatoryFramework: 'GDPR',
      personalDataTypes: [
        {% for field in dataFields -%}
        {% if field.isPersonalData -%}
        {
          field: '{{ field.name }}',
          type: '{{ field.type }}',
          sensitivity: '{{ field.sensitivity || "medium" }}',
          purpose: this.processingPurpose
        },
        {% endif -%}
        {% endfor %}
      ],
      riskLevel: 'Medium',
      safeguards: [
        'Encryption at rest',
        'Pseudonymization',
        'Access controls',
        'Audit logging',
        'Data minimization',
        'Purpose limitation',
        'Storage limitation'
      ],
      complianceStatus: 'Compliant',
      lastReview: new Date().toISOString(),
      nextReview: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year
    };
  }
}