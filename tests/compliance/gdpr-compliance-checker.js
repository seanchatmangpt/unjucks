"use strict";
/**
 * GDPR Compliance Checker
 * Automated GDPR (General Data Protection Regulation) compliance validation and data mapping
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GDPRComplianceChecker = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const fs_2 = require("fs");
const yaml = require("yaml");
class GDPRComplianceChecker {
    constructor(config) {
        this.dataElements = [];
        this.processingActivities = [];
        this.consentRecords = [];
        this.dataSubjectRequests = [];
        this.violations = [];
        this.config = config;
        this.ensureDirectories();
        this.loadDataInventory();
        this.loadConsentRecords();
        this.loadDataSubjectRequests();
    }
    ensureDirectories() {
        [
            this.config.outputDir,
            this.config.consentRecordsDir,
            this.config.privacyNoticesDir,
            (0, path_1.join)(this.config.outputDir, 'data-maps'),
            (0, path_1.join)(this.config.outputDir, 'pia-reports'),
            (0, path_1.join)(this.config.outputDir, 'breach-reports')
        ].forEach(dir => {
            try {
                (0, fs_2.mkdirSync)(dir, { recursive: true });
            }
            catch (error) {
                // Directory might already exist
            }
        });
    }
    loadDataInventory() {
        try {
            if ((0, fs_1.existsSync)(this.config.dataInventoryFile)) {
                const content = (0, fs_1.readFileSync)(this.config.dataInventoryFile, 'utf-8');
                const data = yaml.parse(content);
                this.dataElements = data.personalData || [];
                this.processingActivities = data.processingActivities || [];
            }
            else {
                this.dataElements = this.getDefaultDataElements();
                this.processingActivities = this.getDefaultProcessingActivities();
                this.saveDataInventory();
            }
        }
        catch (error) {
            console.error('Error loading data inventory:', error);
            this.dataElements = [];
            this.processingActivities = [];
        }
    }
    getDefaultDataElements() {
        return [
            {
                id: 'email_address',
                name: 'Email Address',
                category: 'identifying',
                description: 'User email addresses for communication and authentication',
                legalBasis: 'consent',
                purposes: ['communication', 'authentication', 'marketing'],
                retention: {
                    period: '3 years after last activity',
                    criteria: 'Account deletion or 3 years inactivity',
                    automatedDeletion: true
                },
                sources: ['user_registration', 'contact_forms', 'newsletter_signup'],
                recipients: ['internal_team', 'email_service_provider'],
                transfers: {
                    countries: ['US'],
                    safeguards: ['Standard Contractual Clauses']
                },
                subjects: ['customers', 'prospects', 'employees']
            },
            {
                id: 'user_name',
                name: 'Full Name',
                category: 'identifying',
                description: 'User full names for personalization and legal purposes',
                legalBasis: 'contract',
                purposes: ['service_provision', 'customer_support', 'legal_compliance'],
                retention: {
                    period: '7 years after contract termination',
                    criteria: 'Legal retention requirements',
                    automatedDeletion: false
                },
                sources: ['user_registration', 'kyc_process'],
                recipients: ['internal_team', 'compliance_team'],
                transfers: {
                    countries: [],
                    safeguards: []
                },
                subjects: ['customers', 'employees']
            }
        ];
    }
    getDefaultProcessingActivities() {
        return [
            {
                id: 'customer_management',
                name: 'Customer Account Management',
                controller: {
                    name: 'Company Name',
                    contact: 'privacy@company.com',
                    dpo: 'dpo@company.com'
                },
                processors: [
                    {
                        name: 'Cloud Provider',
                        contact: 'privacy@cloudprovider.com',
                        location: 'US',
                        adequacyDecision: false
                    }
                ],
                purposes: [
                    'Provide customer services',
                    'Maintain customer accounts',
                    'Customer support'
                ],
                legalBasis: ['contract', 'legitimate_interests'],
                categories: ['identifying_data', 'contact_information', 'transaction_data'],
                recipients: ['customer_service_team', 'technical_support'],
                retentionPeriods: ['3 years after contract termination'],
                securityMeasures: [
                    'Encryption at rest and in transit',
                    'Access controls and authentication',
                    'Regular security audits',
                    'Data breach response procedures'
                ],
                dataSubjectRights: [
                    'Right of access',
                    'Right to rectification',
                    'Right to erasure',
                    'Right to restrict processing',
                    'Right to data portability'
                ],
                riskLevel: 'medium',
                privacyImpactAssessment: false,
                lastReviewed: this.getDeterministicDate().toISOString()
            }
        ];
    }
    saveDataInventory() {
        const data = {
            personalData: this.dataElements,
            processingActivities: this.processingActivities
        };
        const content = yaml.stringify(data, { indent: 2 });
        (0, fs_1.writeFileSync)(this.config.dataInventoryFile, content, 'utf-8');
    }
    loadConsentRecords() {
        try {
            const consentFiles = (0, fs_1.readdirSync)(this.config.consentRecordsDir)
                .filter(file => file.endsWith('.json'));
            this.consentRecords = [];
            for (const file of consentFiles) {
                const filePath = (0, path_1.join)(this.config.consentRecordsDir, file);
                const content = (0, fs_1.readFileSync)(filePath, 'utf-8');
                const records = JSON.parse(content);
                this.consentRecords.push(...records);
            }
        }
        catch (error) {
            console.error('Error loading consent records:', error);
            this.consentRecords = [];
        }
    }
    loadDataSubjectRequests() {
        try {
            const requestFile = (0, path_1.join)(this.config.outputDir, 'data-subject-requests.json');
            if ((0, fs_1.existsSync)(requestFile)) {
                const content = (0, fs_1.readFileSync)(requestFile, 'utf-8');
                this.dataSubjectRequests = JSON.parse(content);
            }
        }
        catch (error) {
            console.error('Error loading data subject requests:', error);
            this.dataSubjectRequests = [];
        }
    }
    runGDPRComplianceCheck() {
        console.log('🔍 Starting GDPR compliance check...');
        const startTime = this.getDeterministicDate();
        this.violations = [];
        // Check data processing activities
        this.checkDataProcessingCompliance();
        // Check consent validity
        if (this.config.checkConsent) {
            this.checkConsentCompliance();
        }
        // Check data subject rights
        if (this.config.monitorRequests) {
            this.checkDataSubjectRights();
        }
        // Check retention periods
        this.checkRetentionCompliance();
        // Check security measures
        this.checkSecurityCompliance();
        // Check privacy notices
        const privacyNoticeStatus = this.checkPrivacyNotices();
        // Generate data protection impact assessments
        if (this.config.performPIA) {
            this.generatePIAReports();
        }
        // Generate data maps
        if (this.config.generateDataMap) {
            this.generateDataMaps();
        }
        // Create compliance report
        const report = {
            reportId: this.generateReportId(),
            generatedAt: this.getDeterministicDate().toISOString(),
            period: {
                startDate: new Date(this.getDeterministicTimestamp() - 90 * 24 * 60 * 60 * 1000).toISOString(),
                endDate: this.getDeterministicDate().toISOString()
            },
            dataProcessingActivities: {
                total: this.processingActivities.length,
                compliant: this.processingActivities.length - this.violations.filter(v => v.principle === 'lawfulness').length,
                nonCompliant: this.violations.filter(v => v.principle === 'lawfulness').length,
                requiresPIA: this.processingActivities.filter(a => a.riskLevel === 'high' || a.riskLevel === 'critical').length
            },
            dataSubjectRights: this.generateDataSubjectRightsStats(),
            consent: this.generateConsentStats(),
            violations: this.violations,
            recommendations: this.generateGDPRRecommendations(),
            privacyNoticeStatus,
            dataBreaches: {
                total: 0, // Would be populated from breach reporting system
                reportedToAuthority: 0,
                notifiedSubjects: 0
            }
        };
        // Save report
        this.saveGDPRReport(report);
        const duration = this.getDeterministicTimestamp() - startTime.getTime();
        console.log(`✅ GDPR compliance check completed in ${duration}ms`);
        console.log(`📊 Results: ${this.violations.length} violations found`);
        return report;
    }
    checkDataProcessingCompliance() {
        console.log('🔍 Checking data processing compliance...');
        for (const activity of this.processingActivities) {
            // Check legal basis
            if (!activity.legalBasis || activity.legalBasis.length === 0) {
                this.violations.push({
                    id: this.generateViolationId(),
                    principle: 'lawfulness',
                    article: 'Article 6',
                    severity: 'critical',
                    description: `Processing activity "${activity.name}" lacks legal basis`,
                    detectedAt: this.getDeterministicDate().toISOString(),
                    affectedSubjects: 1000, // Estimated
                    dataCategories: activity.categories,
                    potentialFine: {
                        amount: 20000000,
                        currency: 'EUR',
                        basis: 'Up to 4% of annual turnover or €20M'
                    },
                    remediation: [
                        'Identify and document appropriate legal basis',
                        'Review and update privacy notices',
                        'Implement necessary consent mechanisms if required'
                    ],
                    status: 'open',
                    reportedToAuthority: false
                });
            }
            // Check purpose limitation
            if (!activity.purposes || activity.purposes.length === 0) {
                this.violations.push({
                    id: this.generateViolationId(),
                    principle: 'purpose_limitation',
                    article: 'Article 5(1)(b)',
                    severity: 'high',
                    description: `Processing activity "${activity.name}" lacks clearly defined purposes`,
                    detectedAt: this.getDeterministicDate().toISOString(),
                    affectedSubjects: 500,
                    dataCategories: activity.categories,
                    potentialFine: {
                        amount: 10000000,
                        currency: 'EUR',
                        basis: 'Up to 2% of annual turnover or €10M'
                    },
                    remediation: [
                        'Define specific, explicit, and legitimate purposes',
                        'Update processing activity documentation',
                        'Review data collection practices'
                    ],
                    status: 'open',
                    reportedToAuthority: false
                });
            }
            // Check retention periods
            if (!activity.retentionPeriods || activity.retentionPeriods.length === 0) {
                this.violations.push({
                    id: this.generateViolationId(),
                    principle: 'storage_limitation',
                    article: 'Article 5(1)(e)',
                    severity: 'medium',
                    description: `Processing activity "${activity.name}" lacks defined retention periods`,
                    detectedAt: this.getDeterministicDate().toISOString(),
                    affectedSubjects: 300,
                    dataCategories: activity.categories,
                    potentialFine: {
                        amount: 10000000,
                        currency: 'EUR',
                        basis: 'Up to 2% of annual turnover or €10M'
                    },
                    remediation: [
                        'Define retention periods for all data categories',
                        'Implement automated deletion procedures',
                        'Create retention schedule documentation'
                    ],
                    status: 'open',
                    reportedToAuthority: false
                });
            }
            // Check security measures
            if (!activity.securityMeasures || activity.securityMeasures.length < 3) {
                this.violations.push({
                    id: this.generateViolationId(),
                    principle: 'security',
                    article: 'Article 32',
                    severity: 'high',
                    description: `Processing activity "${activity.name}" has insufficient security measures`,
                    detectedAt: this.getDeterministicDate().toISOString(),
                    affectedSubjects: 1000,
                    dataCategories: activity.categories,
                    potentialFine: {
                        amount: 10000000,
                        currency: 'EUR',
                        basis: 'Up to 2% of annual turnover or €10M'
                    },
                    remediation: [
                        'Implement comprehensive security measures',
                        'Conduct security risk assessment',
                        'Document security controls'
                    ],
                    status: 'open',
                    reportedToAuthority: false
                });
            }
        }
    }
    checkConsentCompliance() {
        console.log('🔍 Checking consent compliance...');
        const now = this.getDeterministicDate();
        for (const consent of this.consentRecords) {
            // Check if consent is still valid (not expired or withdrawn)
            if (consent.status === 'expired' || consent.status === 'withdrawn') {
                continue;
            }
            // Check if consent meets GDPR requirements
            if (!consent.granular || !consent.specific || !consent.informed || !consent.freelyGiven) {
                this.violations.push({
                    id: this.generateViolationId(),
                    principle: 'lawfulness',
                    article: 'Article 7',
                    severity: 'high',
                    description: `Invalid consent record ${consent.id} - does not meet GDPR requirements`,
                    detectedAt: this.getDeterministicDate().toISOString(),
                    affectedSubjects: 1,
                    dataCategories: ['personal_data'],
                    potentialFine: {
                        amount: 20000000,
                        currency: 'EUR',
                        basis: 'Up to 4% of annual turnover or €20M'
                    },
                    remediation: [
                        'Review consent collection mechanisms',
                        'Ensure consent is granular, specific, informed, and freely given',
                        'Update consent forms and processes'
                    ],
                    status: 'open',
                    reportedToAuthority: false
                });
            }
            // Check consent age (should be refreshed periodically)
            const consentDate = new Date(consent.timestamp);
            const monthsOld = (now.getTime() - consentDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
            if (monthsOld > 24) { // Consent older than 2 years
                this.violations.push({
                    id: this.generateViolationId(),
                    principle: 'accountability',
                    article: 'Article 7',
                    severity: 'medium',
                    description: `Consent record ${consent.id} is over 2 years old and should be refreshed`,
                    detectedAt: this.getDeterministicDate().toISOString(),
                    affectedSubjects: 1,
                    dataCategories: ['personal_data'],
                    potentialFine: {
                        amount: 10000000,
                        currency: 'EUR',
                        basis: 'Up to 2% of annual turnover or €10M'
                    },
                    remediation: [
                        'Implement consent refresh procedures',
                        'Contact data subjects for consent renewal',
                        'Update consent management system'
                    ],
                    status: 'open',
                    reportedToAuthority: false
                });
            }
        }
    }
    checkDataSubjectRights() {
        console.log('🔍 Checking data subject rights compliance...');
        const now = this.getDeterministicDate();
        for (const request of this.dataSubjectRequests) {
            const dueDate = new Date(request.dueDate);
            const isOverdue = now > dueDate && request.status !== 'completed';
            if (isOverdue) {
                this.violations.push({
                    id: this.generateViolationId(),
                    principle: 'accountability',
                    article: 'Articles 15-22',
                    severity: 'high',
                    description: `Data subject request ${request.id} is overdue`,
                    detectedAt: this.getDeterministicDate().toISOString(),
                    affectedSubjects: 1,
                    dataCategories: ['personal_data'],
                    potentialFine: {
                        amount: 20000000,
                        currency: 'EUR',
                        basis: 'Up to 4% of annual turnover or €20M'
                    },
                    remediation: [
                        'Complete overdue data subject request immediately',
                        'Review request processing procedures',
                        'Implement automated deadline tracking'
                    ],
                    status: 'open',
                    reportedToAuthority: false
                });
            }
            // Check if request has been pending too long
            const requestDate = new Date(request.requestDate);
            const daysPending = (now.getTime() - requestDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysPending > 30 && request.status === 'pending') {
                this.violations.push({
                    id: this.generateViolationId(),
                    principle: 'accountability',
                    article: 'Article 12',
                    severity: 'medium',
                    description: `Data subject request ${request.id} has been pending for over 30 days`,
                    detectedAt: this.getDeterministicDate().toISOString(),
                    affectedSubjects: 1,
                    dataCategories: ['personal_data'],
                    potentialFine: {
                        amount: 10000000,
                        currency: 'EUR',
                        basis: 'Up to 2% of annual turnover or €10M'
                    },
                    remediation: [
                        'Assign request to appropriate team member',
                        'Provide status update to data subject',
                        'Implement request workflow automation'
                    ],
                    status: 'open',
                    reportedToAuthority: false
                });
            }
        }
    }
    checkRetentionCompliance() {
        console.log('🔍 Checking retention compliance...');
        for (const element of this.dataElements) {
            if (!element.retention.automatedDeletion && element.retention.period !== 'indefinite') {
                this.violations.push({
                    id: this.generateViolationId(),
                    principle: 'storage_limitation',
                    article: 'Article 5(1)(e)',
                    severity: 'medium',
                    description: `Personal data element "${element.name}" lacks automated retention management`,
                    detectedAt: this.getDeterministicDate().toISOString(),
                    affectedSubjects: 1000,
                    dataCategories: [element.category],
                    potentialFine: {
                        amount: 10000000,
                        currency: 'EUR',
                        basis: 'Up to 2% of annual turnover or €10M'
                    },
                    remediation: [
                        'Implement automated data retention procedures',
                        'Create retention monitoring dashboard',
                        'Set up deletion workflows'
                    ],
                    status: 'open',
                    reportedToAuthority: false
                });
            }
        }
    }
    checkSecurityCompliance() {
        console.log('🔍 Checking security compliance...');
        // This would typically integrate with security scanning tools
        // For demonstration, we'll check basic security requirements
        const securityRequirements = [
            'encryption_at_rest',
            'encryption_in_transit',
            'access_controls',
            'audit_logging',
            'incident_response'
        ];
        // Simulate security check results
        const implementedMeasures = ['encryption_at_rest', 'access_controls'];
        const missingMeasures = securityRequirements.filter(req => !implementedMeasures.includes(req));
        if (missingMeasures.length > 0) {
            this.violations.push({
                id: this.generateViolationId(),
                principle: 'security',
                article: 'Article 32',
                severity: 'critical',
                description: `Missing security measures: ${missingMeasures.join(', ')}`,
                detectedAt: this.getDeterministicDate().toISOString(),
                affectedSubjects: 5000,
                dataCategories: ['all_personal_data'],
                potentialFine: {
                    amount: 10000000,
                    currency: 'EUR',
                    basis: 'Up to 2% of annual turnover or €10M'
                },
                remediation: [
                    'Implement missing security measures',
                    'Conduct comprehensive security audit',
                    'Update security policies and procedures'
                ],
                status: 'open',
                reportedToAuthority: false
            });
        }
    }
    checkPrivacyNotices() {
        console.log('🔍 Checking privacy notices...');
        try {
            const noticeFiles = (0, fs_1.readdirSync)(this.config.privacyNoticesDir)
                .filter(file => file.includes('privacy') && (file.endsWith('.html') || file.endsWith('.md')));
            const languages = noticeFiles.map(file => {
                const parts = file.split('.');
                return parts.length > 2 ? parts[parts.length - 2] : 'en';
            });
            // Check if notices have been reviewed recently
            let lastReviewed = '1970-01-01T00:00:00.000Z';
            for (const file of noticeFiles) {
                const filePath = (0, path_1.join)(this.config.privacyNoticesDir, file);
                const stats = (0, fs_1.statSync)(filePath);
                if (stats.mtime.toISOString() > lastReviewed) {
                    lastReviewed = stats.mtime.toISOString();
                }
            }
            const lastReviewDate = new Date(lastReviewed);
            const now = this.getDeterministicDate();
            const monthsSinceReview = (now.getTime() - lastReviewDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
            const upToDate = monthsSinceReview < 12; // Should be reviewed annually
            if (!upToDate) {
                this.violations.push({
                    id: this.generateViolationId(),
                    principle: 'transparency',
                    article: 'Articles 13-14',
                    severity: 'medium',
                    description: 'Privacy notices have not been reviewed in over 12 months',
                    detectedAt: this.getDeterministicDate().toISOString(),
                    affectedSubjects: 10000,
                    dataCategories: ['all_personal_data'],
                    potentialFine: {
                        amount: 10000000,
                        currency: 'EUR',
                        basis: 'Up to 2% of annual turnover or €10M'
                    },
                    remediation: [
                        'Review and update privacy notices',
                        'Ensure notices reflect current processing activities',
                        'Implement annual review process'
                    ],
                    status: 'open',
                    reportedToAuthority: false
                });
            }
            return {
                upToDate,
                lastReviewed,
                languages: [...new Set(languages)]
            };
        }
        catch (error) {
            console.error('Error checking privacy notices:', error);
            return {
                upToDate: false,
                lastReviewed: '1970-01-01T00:00:00.000Z',
                languages: []
            };
        }
    }
    generateDataSubjectRightsStats() {
        const now = this.getDeterministicDate();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const recentRequests = this.dataSubjectRequests.filter(req => new Date(req.requestDate) > thirtyDaysAgo);
        const completedOnTime = recentRequests.filter(req => req.status === 'completed' &&
            req.completedDate &&
            new Date(req.completedDate) <= new Date(req.dueDate));
        const overdue = recentRequests.filter(req => req.status !== 'completed' &&
            new Date(req.dueDate) < now);
        // Calculate average response time
        const completedRequests = recentRequests.filter(req => req.completedDate);
        const totalResponseTime = completedRequests.reduce((sum, req) => {
            const requestDate = new Date(req.requestDate);
            const completedDate = new Date(req.completedDate);
            return sum + (completedDate.getTime() - requestDate.getTime());
        }, 0);
        const averageResponseTime = completedRequests.length > 0
            ? totalResponseTime / completedRequests.length / (1000 * 60 * 60 * 24) // Convert to days
            : 0;
        return {
            totalRequests: recentRequests.length,
            completedOnTime: completedOnTime.length,
            overdue: overdue.length,
            averageResponseTime: Math.round(averageResponseTime * 10) / 10
        };
    }
    generateConsentStats() {
        const valid = this.consentRecords.filter(c => c.status === 'active').length;
        const expired = this.consentRecords.filter(c => c.status === 'expired').length;
        const withdrawn = this.consentRecords.filter(c => c.status === 'withdrawn').length;
        return {
            totalRecords: this.consentRecords.length,
            valid,
            expired,
            withdrawn
        };
    }
    generateGDPRRecommendations() {
        const recommendations = [];
        // Analyze violations for specific recommendations
        const criticalViolations = this.violations.filter(v => v.severity === 'critical');
        const highViolations = this.violations.filter(v => v.severity === 'high');
        if (criticalViolations.length > 0) {
            recommendations.push('Address critical GDPR violations immediately to avoid regulatory action');
            recommendations.push('Consider engaging external privacy counsel for remediation strategy');
        }
        if (highViolations.length > 0) {
            recommendations.push('Implement comprehensive privacy program improvements');
            recommendations.push('Conduct privacy impact assessments for high-risk processing');
        }
        // Principle-specific recommendations
        const principleViolations = this.violations.reduce((acc, v) => {
            acc[v.principle] = (acc[v.principle] || 0) + 1;
            return acc;
        }, {});
        if (principleViolations.lawfulness > 0) {
            recommendations.push('Review and document legal basis for all data processing activities');
        }
        if (principleViolations.transparency > 0) {
            recommendations.push('Update privacy notices to ensure transparency and completeness');
        }
        if (principleViolations.security > 0) {
            recommendations.push('Enhance technical and organizational security measures');
        }
        if (principleViolations.storage_limitation > 0) {
            recommendations.push('Implement automated data retention and deletion procedures');
        }
        // General recommendations
        recommendations.push('Conduct regular GDPR compliance assessments');
        recommendations.push('Provide GDPR training to all staff handling personal data');
        recommendations.push('Establish data protection impact assessment procedures');
        recommendations.push('Implement privacy by design in new systems and processes');
        return recommendations;
    }
    generatePIAReports() {
        console.log('📋 Generating Privacy Impact Assessment reports...');
        const highRiskActivities = this.processingActivities.filter(a => a.riskLevel === 'high' || a.riskLevel === 'critical');
        for (const activity of highRiskActivities) {
            const piaReport = this.generatePIAReport(activity);
            const reportPath = (0, path_1.join)(this.config.outputDir, 'pia-reports', `pia-${activity.id}-${this.getDeterministicTimestamp()}.md`);
            (0, fs_1.writeFileSync)(reportPath, piaReport, 'utf-8');
            console.log(`📝 Generated PIA report: ${reportPath}`);
        }
    }
    generatePIAReport(activity) {
        let content = `# Privacy Impact Assessment\n\n`;
        content += `**Processing Activity:** ${activity.name}\n`;
        content += `**Assessment Date:** ${this.getDeterministicDate().toLocaleDateString()}\n`;
        content += `**Risk Level:** ${activity.riskLevel.toUpperCase()}\n\n`;
        content += `## Processing Description\n\n`;
        content += `${activity.name} involves processing personal data for the following purposes:\n\n`;
        activity.purposes.forEach(purpose => {
            content += `- ${purpose}\n`;
        });
        content += `\n`;
        content += `## Legal Basis\n\n`;
        activity.legalBasis.forEach(basis => {
            content += `- ${basis.replace('_', ' ').toUpperCase()}\n`;
        });
        content += `\n`;
        content += `## Data Categories\n\n`;
        activity.categories.forEach(category => {
            content += `- ${category.replace('_', ' ')}\n`;
        });
        content += `\n`;
        content += `## Risk Assessment\n\n`;
        content += `### Identified Risks\n\n`;
        content += `1. **Unauthorized Access**: Risk of unauthorized access to personal data\n`;
        content += `2. **Data Breach**: Potential for data security incidents\n`;
        content += `3. **Non-compliance**: Risk of GDPR compliance violations\n`;
        content += `4. **Data Subject Rights**: Challenges in fulfilling data subject requests\n\n`;
        content += `### Risk Mitigation Measures\n\n`;
        activity.securityMeasures.forEach((measure, index) => {
            content += `${index + 1}. ${measure}\n`;
        });
        content += `\n`;
        content += `## Data Subject Rights\n\n`;
        content += `The following data subject rights are supported:\n\n`;
        activity.dataSubjectRights.forEach(right => {
            content += `- ${right}\n`;
        });
        content += `\n`;
        content += `## Conclusion\n\n`;
        if (activity.riskLevel === 'critical') {
            content += `This processing activity presents **CRITICAL** privacy risks that require immediate attention and enhanced safeguards.\n\n`;
        }
        else if (activity.riskLevel === 'high') {
            content += `This processing activity presents **HIGH** privacy risks that require additional safeguards and monitoring.\n\n`;
        }
        content += `## Recommendations\n\n`;
        content += `1. Implement additional security measures as identified\n`;
        content += `2. Conduct regular compliance reviews\n`;
        content += `3. Monitor for data protection incidents\n`;
        content += `4. Update privacy notices as necessary\n`;
        content += `5. Provide staff training on privacy requirements\n\n`;
        return content;
    }
    generateDataMaps() {
        console.log('🗺️  Generating data flow maps...');
        const dataMapPath = (0, path_1.join)(this.config.outputDir, 'data-maps', 'data-flow-map.md');
        let content = `# Personal Data Flow Map\n\n`;
        content += `**Generated:** ${this.getDeterministicDate().toLocaleDateString()}\n\n`;
        content += `## Data Elements\n\n`;
        content += `| Element | Category | Legal Basis | Sources | Recipients | Retention |\n`;
        content += `|---------|----------|-------------|---------|------------|----------|\n`;
        for (const element of this.dataElements) {
            content += `| ${element.name} | ${element.category} | ${element.legalBasis} | ${element.sources.join(', ')} | ${element.recipients.join(', ')} | ${element.retention.period} |\n`;
        }
        content += `\n## Data Flow Diagram\n\n`;
        content += `\`\`\`mermaid\n`;
        content += `graph LR\n`;
        // Generate Mermaid diagram
        const sources = new Set();
        const recipients = new Set();
        this.dataElements.forEach(element => {
            element.sources.forEach(source => sources.add(source));
            element.recipients.forEach(recipient => recipients.add(recipient));
        });
        // Add nodes
        sources.forEach(source => {
            content += `  ${source.replace(/\s/g, '_')}[${source}]\n`;
        });
        recipients.forEach(recipient => {
            content += `  ${recipient.replace(/\s/g, '_')}[${recipient}]\n`;
        });
        // Add flows
        this.dataElements.forEach(element => {
            element.sources.forEach(source => {
                element.recipients.forEach(recipient => {
                    content += `  ${source.replace(/\s/g, '_')} -->|${element.name}| ${recipient.replace(/\s/g, '_')}\n`;
                });
            });
        });
        content += `\`\`\`\n\n`;
        (0, fs_1.writeFileSync)(dataMapPath, content, 'utf-8');
        console.log(`📝 Generated data map: ${dataMapPath}`);
    }
    generateReportId() {
        const now = this.getDeterministicDate();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
        return `GDPR-${dateStr}-${timeStr}`;
    }
    generateViolationId() {
        return `GDPR-V-${this.getDeterministicTimestamp()}-${Math.random().toString(36).substr(2, 5)}`;
    }
    saveGDPRReport(report) {
        const reportPath = (0, path_1.join)(this.config.outputDir, `gdpr-compliance-report-${report.reportId}.json`);
        (0, fs_1.writeFileSync)(reportPath, JSON.stringify(report, null, 2), 'utf-8');
        console.log(`📝 GDPR compliance report saved: ${reportPath}`);
        // Generate executive summary
        this.generateGDPRExecutiveSummary(report);
        // Generate detailed report
        this.generateGDPRDetailedReport(report);
    }
    generateGDPRExecutiveSummary(report) {
        const summaryPath = (0, path_1.join)(this.config.outputDir, `gdpr-executive-summary-${report.reportId}.md`);
        let content = `# GDPR Compliance Executive Summary\n\n`;
        content += `**Report ID:** ${report.reportId}\n`;
        content += `**Generated:** ${new Date(report.generatedAt).toLocaleString()}\n`;
        content += `**Period:** ${new Date(report.period.startDate).toLocaleDateString()} - ${new Date(report.period.endDate).toLocaleDateString()}\n\n`;
        content += `## Overall Compliance Status\n\n`;
        const complianceRate = Math.round((report.dataProcessingActivities.compliant / report.dataProcessingActivities.total) * 100);
        content += `**Compliance Rate:** ${complianceRate}% (${report.dataProcessingActivities.compliant}/${report.dataProcessingActivities.total} activities)\n\n`;
        if (complianceRate >= 95) {
            content += `✅ **Status:** COMPLIANT - Strong privacy posture\n\n`;
        }
        else if (complianceRate >= 85) {
            content += `⚠️ **Status:** MOSTLY COMPLIANT - Some improvements needed\n\n`;
        }
        else {
            content += `❌ **Status:** NON-COMPLIANT - Significant risks present\n\n`;
        }
        content += `## Key Metrics\n\n`;
        content += `### Data Processing Activities\n`;
        content += `- **Total Activities:** ${report.dataProcessingActivities.total}\n`;
        content += `- **Compliant:** ${report.dataProcessingActivities.compliant}\n`;
        content += `- **Non-compliant:** ${report.dataProcessingActivities.nonCompliant}\n`;
        content += `- **Require PIA:** ${report.dataProcessingActivities.requiresPIA}\n\n`;
        content += `### Data Subject Rights\n`;
        content += `- **Total Requests:** ${report.dataSubjectRights.totalRequests}\n`;
        content += `- **Completed On Time:** ${report.dataSubjectRights.completedOnTime}\n`;
        content += `- **Overdue:** ${report.dataSubjectRights.overdue}\n`;
        content += `- **Average Response Time:** ${report.dataSubjectRights.averageResponseTime} days\n\n`;
        content += `### Consent Management\n`;
        content += `- **Total Consent Records:** ${report.consent.totalRecords}\n`;
        content += `- **Valid Consents:** ${report.consent.valid}\n`;
        content += `- **Withdrawn:** ${report.consent.withdrawn}\n`;
        content += `- **Expired:** ${report.consent.expired}\n\n`;
        content += `## Critical Issues\n\n`;
        const criticalViolations = report.violations.filter(v => v.severity === 'critical');
        if (criticalViolations.length > 0) {
            content += `🚨 **${criticalViolations.length} Critical Violations** requiring immediate attention:\n\n`;
            criticalViolations.forEach((violation, index) => {
                content += `${index + 1}. **${violation.article}**: ${violation.description}\n`;
            });
        }
        else {
            content += `✅ No critical violations identified\n`;
        }
        content += `\n## Immediate Actions Required\n\n`;
        if (criticalViolations.length > 0) {
            content += `1. **URGENT:** Address ${criticalViolations.length} critical GDPR violations\n`;
        }
        content += `2. Complete ${report.dataProcessingActivities.requiresPIA} pending Privacy Impact Assessments\n`;
        content += `3. Address ${report.dataSubjectRights.overdue} overdue data subject requests\n`;
        content += `4. Review and refresh ${report.consent.expired} expired consent records\n\n`;
        (0, fs_1.writeFileSync)(summaryPath, content, 'utf-8');
        console.log(`📝 GDPR executive summary saved: ${summaryPath}`);
    }
    generateGDPRDetailedReport(report) {
        const detailPath = (0, path_1.join)(this.config.outputDir, `gdpr-detailed-report-${report.reportId}.md`);
        let content = `# GDPR Compliance Detailed Report\n\n`;
        content += `**Report ID:** ${report.reportId}\n`;
        content += `**Generated:** ${new Date(report.generatedAt).toLocaleString()}\n\n`;
        // Processing activities section
        content += `## Data Processing Activities\n\n`;
        content += `| Activity | Risk Level | Legal Basis | Compliant | Last Reviewed |\n`;
        content += `|----------|------------|-------------|-----------|---------------|\n`;
        for (const activity of this.processingActivities) {
            const violations = this.violations.filter(v => v.description.includes(activity.name));
            const compliant = violations.length === 0 ? '✅' : '❌';
            content += `| ${activity.name} | ${activity.riskLevel.toUpperCase()} | ${activity.legalBasis.join(', ')} | ${compliant} | ${new Date(activity.lastReviewed).toLocaleDateString()} |\n`;
        }
        content += `\n`;
        // Violations section
        if (this.violations.length > 0) {
            content += `## GDPR Violations\n\n`;
            for (const violation of this.violations) {
                content += `### ${violation.id}\n\n`;
                content += `**Article:** ${violation.article}\n`;
                content += `**Principle:** ${violation.principle.replace('_', ' ')}\n`;
                content += `**Severity:** ${violation.severity.toUpperCase()}\n`;
                content += `**Affected Subjects:** ${violation.affectedSubjects.toLocaleString()}\n`;
                content += `**Potential Fine:** €${violation.potentialFine.amount.toLocaleString()}\n\n`;
                content += `**Description:** ${violation.description}\n\n`;
                content += `**Remediation Steps:**\n`;
                violation.remediation.forEach(step => {
                    content += `- ${step}\n`;
                });
                content += `\n`;
            }
        }
        // Recommendations section
        content += `## Recommendations\n\n`;
        report.recommendations.forEach((rec, index) => {
            content += `${index + 1}. ${rec}\n`;
        });
        (0, fs_1.writeFileSync)(detailPath, content, 'utf-8');
        console.log(`📝 GDPR detailed report saved: ${detailPath}`);
    }
}
exports.GDPRComplianceChecker = GDPRComplianceChecker;
// CLI interface
if (require.main === module) {
    const config = {
        outputDir: process.env.OUTPUT_DIR || 'docs/compliance/gdpr',
        dataInventoryFile: process.env.DATA_INVENTORY_FILE || 'config/compliance/gdpr-data-inventory.yml',
        consentRecordsDir: process.env.CONSENT_RECORDS_DIR || 'data/consent',
        privacyNoticesDir: process.env.PRIVACY_NOTICES_DIR || 'docs/privacy',
        generateDataMap: process.env.GENERATE_DATA_MAP !== 'false',
        performPIA: process.env.PERFORM_PIA === 'true',
        checkConsent: process.env.CHECK_CONSENT !== 'false',
        monitorRequests: process.env.MONITOR_REQUESTS !== 'false'
    };
    const checker = new GDPRComplianceChecker(config);
    const report = checker.runGDPRComplianceCheck();
    console.log(`\n📊 GDPR Compliance Summary:`);
    console.log(`   - Violations: ${report.violations.length}`);
    console.log(`   - Compliance Rate: ${Math.round((report.dataProcessingActivities.compliant / report.dataProcessingActivities.total) * 100)}%`);
    console.log(`   - Overdue Requests: ${report.dataSubjectRights.overdue}`);
}
