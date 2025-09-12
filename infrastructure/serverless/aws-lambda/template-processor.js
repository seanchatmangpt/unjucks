/**
 * KGEN Serverless Template Processor
 * AWS Lambda Function for processing Nunjucks templates in a serverless environment
 * 
 * Features:
 * - Multi-tenant template processing with isolation
 * - Deterministic rendering with caching
 * - S3 integration for template and artifact storage
 * - CloudWatch logging and X-Ray tracing
 * - Dead letter queue for failed processing
 * - Auto-scaling based on demand
 */

import AWS from 'aws-sdk';
import nunjucks from 'nunjucks';
import crypto from 'crypto';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import AWSXRay from 'aws-xray-sdk-core';

// Configure AWS SDK with X-Ray tracing
const aws = AWSXRay.captureAWS(AWS);

// Initialize AWS services
const s3 = new aws.S3({
  apiVersion: '2006-03-01',
  region: process.env.AWS_REGION,
  maxRetries: 3,
  retryDelayOptions: {
    customBackoff: (retryCount) => Math.pow(2, retryCount) * 100
  }
});

const dynamodb = new aws.DynamoDB.DocumentClient({
  apiVersion: '2012-08-10',
  region: process.env.AWS_REGION
});

const sns = new aws.SNS({
  apiVersion: '2010-03-31',
  region: process.env.AWS_REGION
});

const kms = new aws.KMS({
  apiVersion: '2014-11-01',
  region: process.env.AWS_REGION
});

// Environment configuration
const TEMPLATES_BUCKET = process.env.TEMPLATES_BUCKET;
const ARTIFACTS_BUCKET = process.env.ARTIFACTS_BUCKET;
const TENANT_TABLE = process.env.TENANT_TABLE;
const CACHE_TABLE = process.env.CACHE_TABLE;
const NOTIFICATION_TOPIC = process.env.NOTIFICATION_TOPIC;
const KMS_KEY_ID = process.env.KMS_KEY_ID;

// Nunjucks environment configuration
const nunjucksEnv = new nunjucks.Environment(null, {
  autoescape: true,
  throwOnUndefined: false,
  trimBlocks: true,
  lstripBlocks: true
});

// Add custom filters for deterministic processing
nunjucksEnv.addFilter('deterministic_timestamp', () => {
  return process.env.STATIC_BUILD_TIME || '2024-01-01T00:00:00.000Z';
});

nunjucksEnv.addFilter('secure_hash', (input) => {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
});

nunjucksEnv.addFilter('uuid_deterministic', (seed) => {
  const hash = crypto.createHash('md5').update(String(seed)).digest('hex');
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '4' + hash.substring(13, 16),
    ((parseInt(hash.substring(16, 17), 16) & 3) | 8).toString(16) + hash.substring(17, 20),
    hash.substring(20, 32)
  ].join('-');
});

/**
 * Main Lambda handler function
 */
export const handler = async (event, context) => {
  // Initialize X-Ray segment
  const segment = AWSXRay.getSegment();
  const subsegment = segment.addNewSubsegment('template-processor');
  
  try {
    console.log('Processing template request:', JSON.stringify(event, null, 2));
    
    // Parse the event (could be from API Gateway, SQS, or direct invocation)
    const request = parseEvent(event);
    const { tenantId, templateId, context: templateContext, outputPath } = request;
    
    // Add tenant information to tracing
    subsegment.addAnnotation('tenantId', tenantId);
    subsegment.addAnnotation('templateId', templateId);
    
    // Validate tenant permissions and limits
    const tenant = await validateTenant(tenantId);
    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found or inactive`);
    }
    
    // Check tenant resource limits
    await checkResourceLimits(tenant, templateId);
    
    // Generate cache key for potential reuse
    const cacheKey = generateCacheKey(tenantId, templateId, templateContext);
    
    // Try to get cached result first
    const cachedResult = await getCachedResult(cacheKey);
    if (cachedResult) {
      console.log('Returning cached result for', cacheKey);
      subsegment.addMetadata('cache', 'hit');
      
      await recordUsage(tenantId, 'template_processing', { cached: true });
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          artifactUrl: cachedResult.artifactUrl,
          contentHash: cachedResult.contentHash,
          cached: true,
          processingTime: 0
        })
      };
    }
    
    subsegment.addMetadata('cache', 'miss');
    const startTime = this.getDeterministicTimestamp();
    
    // Load template from S3 with tenant isolation
    const template = await loadTemplate(tenantId, templateId);
    
    // Parse template frontmatter for metadata
    const { content: templateContent, metadata } = parseTemplate(template);
    
    // Validate template context against schema if available
    if (metadata.schema) {
      validateContext(templateContext, metadata.schema);
    }
    
    // Create deterministic context
    const deterministicContext = createDeterministicContext(templateContext, metadata);
    
    // Render template with deterministic settings
    const rendered = await renderTemplate(templateContent, deterministicContext);
    
    // Generate content hash for integrity verification
    const contentHash = crypto.createHash('sha256').update(rendered).digest('hex');
    
    // Store artifact in S3 with tenant isolation and encryption
    const artifactUrl = await storeArtifact(
      tenantId,
      templateId,
      rendered,
      contentHash,
      outputPath
    );
    
    // Generate provenance attestation
    const attestation = generateAttestation({
      tenantId,
      templateId,
      templateHash: crypto.createHash('sha256').update(template).digest('hex'),
      contextHash: crypto.createHash('sha256').update(JSON.stringify(deterministicContext)).digest('hex'),
      contentHash,
      artifactUrl,
      metadata,
      processingTime: this.getDeterministicTimestamp() - startTime
    });
    
    // Store attestation alongside artifact
    await storeAttestation(artifactUrl, attestation);
    
    // Cache the result for future use
    await cacheResult(cacheKey, {
      artifactUrl,
      contentHash,
      attestation,
      expiresAt: this.getDeterministicTimestamp() + (metadata.cacheTtl || 3600000) // Default 1 hour
    });
    
    // Record usage for billing
    await recordUsage(tenantId, 'template_processing', {
      templateId,
      processingTime: this.getDeterministicTimestamp() - startTime,
      artifactSize: Buffer.byteLength(rendered, 'utf8')
    });
    
    // Send completion notification if configured
    if (tenant.notifications?.templateProcessing) {
      await sendNotification(tenantId, 'template_processed', {
        templateId,
        artifactUrl,
        contentHash,
        processingTime: this.getDeterministicTimestamp() - startTime
      });
    }
    
    const response = {
      success: true,
      artifactUrl,
      contentHash,
      cached: false,
      processingTime: this.getDeterministicTimestamp() - startTime,
      attestationUrl: `${artifactUrl}.attest.json`
    };
    
    console.log('Template processing completed:', response);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Content-Hash': contentHash,
        'X-Processing-Time': `${this.getDeterministicTimestamp() - startTime}ms`
      },
      body: JSON.stringify(response)
    };
    
  } catch (error) {
    console.error('Template processing error:', error);
    subsegment.addError(error);
    
    // Send to dead letter queue for retry
    await sendToDeadLetterQueue(event, error);
    
    return {
      statusCode: error.statusCode || 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
        requestId: context.awsRequestId
      })
    };
  } finally {
    subsegment.close();
  }
};

/**
 * Parse incoming event from different sources
 */
function parseEvent(event) {
  // API Gateway event
  if (event.httpMethod) {
    const body = event.body ? JSON.parse(event.body) : {};
    return {
      tenantId: event.headers['X-Tenant-ID'] || event.pathParameters?.tenantId,
      templateId: event.pathParameters?.templateId || body.templateId,
      context: body.context || {},
      outputPath: body.outputPath
    };
  }
  
  // SQS event
  if (event.Records && event.Records[0].eventSource === 'aws:sqs') {
    const record = event.Records[0];
    return JSON.parse(record.body);
  }
  
  // Direct invocation
  return event;
}

/**
 * Validate tenant and return tenant configuration
 */
async function validateTenant(tenantId) {
  try {
    const result = await dynamodb.get({
      TableName: TENANT_TABLE,
      Key: { tenantId },
      ConsistentRead: true
    }).promise();
    
    if (!result.Item) {
      throw new Error(`Tenant ${tenantId} not found`);
    }
    
    const tenant = result.Item;
    
    if (!tenant.active) {
      throw new Error(`Tenant ${tenantId} is inactive`);
    }
    
    if (tenant.suspended) {
      throw new Error(`Tenant ${tenantId} is suspended`);
    }
    
    return tenant;
  } catch (error) {
    console.error('Tenant validation error:', error);
    throw error;
  }
}

/**
 * Check tenant resource limits
 */
async function checkResourceLimits(tenant, templateId) {
  const now = this.getDeterministicDate();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  // Get current usage for this month
  try {
    const result = await dynamodb.get({
      TableName: 'tenant-usage',
      Key: {
        tenantId: tenant.tenantId,
        period: currentMonth
      }
    }).promise();
    
    const usage = result.Item || { templateProcessingCount: 0, storageUsed: 0 };
    
    // Check template processing limit
    if (usage.templateProcessingCount >= tenant.limits.templatesPerMonth) {
      const error = new Error('Template processing limit exceeded');
      error.statusCode = 429;
      throw error;
    }
    
    // Check storage limit
    if (usage.storageUsed >= tenant.limits.storageBytes) {
      const error = new Error('Storage limit exceeded');
      error.statusCode = 429;
      throw error;
    }
    
  } catch (error) {
    if (error.statusCode) throw error;
    console.warn('Could not check resource limits:', error);
  }
}

/**
 * Generate deterministic cache key
 */
function generateCacheKey(tenantId, templateId, context) {
  const contextStr = JSON.stringify(context, Object.keys(context).sort());
  const hash = crypto.createHash('sha256')
    .update(`${tenantId}:${templateId}:${contextStr}`)
    .digest('hex');
  return `cache:${tenantId}:${hash}`;
}

/**
 * Get cached result from DynamoDB
 */
async function getCachedResult(cacheKey) {
  try {
    const result = await dynamodb.get({
      TableName: CACHE_TABLE,
      Key: { cacheKey }
    }).promise();
    
    if (!result.Item) return null;
    
    const item = result.Item;
    
    // Check expiration
    if (item.expiresAt < this.getDeterministicTimestamp()) {
      // Clean up expired cache entry
      await dynamodb.delete({
        TableName: CACHE_TABLE,
        Key: { cacheKey }
      }).promise();
      return null;
    }
    
    return item;
  } catch (error) {
    console.warn('Cache retrieval error:', error);
    return null;
  }
}

/**
 * Load template from S3 with tenant isolation
 */
async function loadTemplate(tenantId, templateId) {
  const key = `templates/${tenantId}/${templateId}`;
  
  try {
    const result = await s3.getObject({
      Bucket: TEMPLATES_BUCKET,
      Key: key,
      ResponseContentType: 'text/plain'
    }).promise();
    
    return result.Body.toString('utf-8');
  } catch (error) {
    if (error.code === 'NoSuchKey') {
      const notFoundError = new Error(`Template ${templateId} not found for tenant ${tenantId}`);
      notFoundError.statusCode = 404;
      throw notFoundError;
    }
    throw error;
  }
}

/**
 * Parse template to separate frontmatter and content
 */
function parseTemplate(template) {
  const frontmatterRegex = /^---\n(.*?)\n---\n(.*)/s;
  const match = template.match(frontmatterRegex);
  
  if (!match) {
    return {
      content: template,
      metadata: {}
    };
  }
  
  try {
    // Parse YAML frontmatter
    const yamlFrontmatter = match[1];
    const content = match[2];
    
    // Simple YAML parser for basic frontmatter
    const metadata = {};
    yamlFrontmatter.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        const value = valueParts.join(':').trim();
        metadata[key.trim()] = value.startsWith('"') && value.endsWith('"') 
          ? value.slice(1, -1) 
          : value;
      }
    });
    
    return { content, metadata };
  } catch (error) {
    console.warn('Failed to parse frontmatter:', error);
    return {
      content: template,
      metadata: {}
    };
  }
}

/**
 * Validate context against schema
 */
function validateContext(context, schema) {
  // Basic schema validation (in production, use a proper JSON schema validator)
  if (schema.required) {
    for (const field of schema.required) {
      if (!(field in context)) {
        throw new Error(`Required field '${field}' missing from context`);
      }
    }
  }
  
  if (schema.properties) {
    for (const [field, definition] of Object.entries(schema.properties)) {
      if (field in context) {
        const value = context[field];
        if (definition.type === 'string' && typeof value !== 'string') {
          throw new Error(`Field '${field}' must be a string`);
        }
        if (definition.type === 'number' && typeof value !== 'number') {
          throw new Error(`Field '${field}' must be a number`);
        }
      }
    }
  }
}

/**
 * Create deterministic context for reproducible rendering
 */
function createDeterministicContext(context, metadata) {
  const deterministicContext = { ...context };
  
  // Add deterministic system variables
  deterministicContext._system = {
    timestamp: process.env.STATIC_BUILD_TIME || '2024-01-01T00:00:00.000Z',
    version: '1.0.0',
    environment: 'production',
    renderer: 'lambda'
  };
  
  // Add metadata
  deterministicContext._metadata = metadata;
  
  // Sort object keys for consistent serialization
  return JSON.parse(JSON.stringify(deterministicContext, Object.keys(deterministicContext).sort()));
}

/**
 * Render template with Nunjucks
 */
async function renderTemplate(templateContent, context) {
  try {
    return new Promise((resolve, reject) => {
      nunjucksEnv.renderString(templateContent, context, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  } catch (error) {
    console.error('Template rendering error:', error);
    const renderError = new Error(`Template rendering failed: ${error.message}`);
    renderError.statusCode = 400;
    throw renderError;
  }
}

/**
 * Store rendered artifact in S3
 */
async function storeArtifact(tenantId, templateId, content, contentHash, outputPath) {
  const timestamp = this.getDeterministicDate().toISOString().replace(/[:.]/g, '-');
  const key = outputPath || `artifacts/${tenantId}/${templateId}/${timestamp}-${contentHash.substring(0, 8)}.generated`;
  
  try {
    await s3.putObject({
      Bucket: ARTIFACTS_BUCKET,
      Key: key,
      Body: content,
      ContentType: 'text/plain',
      ServerSideEncryption: 'aws:kms',
      SSEKMSKeyId: KMS_KEY_ID,
      Metadata: {
        'tenant-id': tenantId,
        'template-id': templateId,
        'content-hash': contentHash,
        'generated-at': this.getDeterministicDate().toISOString()
      },
      Tagging: `tenant-id=${tenantId}&template-id=${templateId}`
    }).promise();
    
    return `s3://${ARTIFACTS_BUCKET}/${key}`;
  } catch (error) {
    console.error('Artifact storage error:', error);
    throw new Error(`Failed to store artifact: ${error.message}`);
  }
}

/**
 * Generate cryptographic attestation
 */
function generateAttestation(data) {
  return {
    version: '1.0.0',
    subject: {
      tenantId: data.tenantId,
      templateId: data.templateId,
      artifactUrl: data.artifactUrl
    },
    predicate: {
      type: 'https://kgen.io/attestation/template-processing/v1',
      generator: {
        name: 'kgen-lambda-template-processor',
        version: '1.0.0',
        platform: 'aws-lambda'
      },
      materials: {
        templateHash: data.templateHash,
        contextHash: data.contextHash
      },
      invocation: {
        processingTime: data.processingTime,
        timestamp: this.getDeterministicDate().toISOString(),
        deterministic: true
      }
    },
    verification: {
      contentHash: data.contentHash,
      algorithm: 'sha256'
    },
    metadata: data.metadata || {}
  };
}

/**
 * Store attestation file
 */
async function storeAttestation(artifactUrl, attestation) {
  const key = artifactUrl.replace('s3://' + ARTIFACTS_BUCKET + '/', '') + '.attest.json';
  
  try {
    await s3.putObject({
      Bucket: ARTIFACTS_BUCKET,
      Key: key,
      Body: JSON.stringify(attestation, null, 2),
      ContentType: 'application/json',
      ServerSideEncryption: 'aws:kms',
      SSEKMSKeyId: KMS_KEY_ID,
      Metadata: {
        'attestation-type': 'template-processing',
        'tenant-id': attestation.subject.tenantId
      }
    }).promise();
  } catch (error) {
    console.error('Attestation storage error:', error);
    // Don't fail the main operation if attestation storage fails
  }
}

/**
 * Cache result in DynamoDB
 */
async function cacheResult(cacheKey, result) {
  try {
    await dynamodb.put({
      TableName: CACHE_TABLE,
      Item: {
        cacheKey,
        ...result,
        cachedAt: this.getDeterministicTimestamp()
      },
      ExpressionAttributeNames: {
        '#ttl': 'ttl'
      },
      ExpressionAttributeValues: {
        ':ttl': Math.floor(result.expiresAt / 1000)
      },
      UpdateExpression: 'SET #ttl = :ttl'
    }).promise();
  } catch (error) {
    console.warn('Cache storage error:', error);
  }
}

/**
 * Record usage for billing and analytics
 */
async function recordUsage(tenantId, operation, details = {}) {
  const now = this.getDeterministicDate();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  try {
    await dynamodb.update({
      TableName: 'tenant-usage',
      Key: {
        tenantId,
        period: currentMonth
      },
      UpdateExpression: 'ADD templateProcessingCount :inc SET lastUpdated = :now',
      ExpressionAttributeValues: {
        ':inc': 1,
        ':now': now.toISOString()
      }
    }).promise();
    
    // Also record detailed usage event
    await dynamodb.put({
      TableName: 'usage-events',
      Item: {
        tenantId,
        timestamp: now.toISOString(),
        operation,
        details,
        requestId: context.awsRequestId
      }
    }).promise();
  } catch (error) {
    console.warn('Usage recording error:', error);
  }
}

/**
 * Send notification via SNS
 */
async function sendNotification(tenantId, eventType, data) {
  try {
    await sns.publish({
      TopicArn: NOTIFICATION_TOPIC,
      Message: JSON.stringify({
        tenantId,
        eventType,
        data,
        timestamp: this.getDeterministicDate().toISOString()
      }),
      MessageAttributes: {
        tenantId: {
          DataType: 'String',
          StringValue: tenantId
        },
        eventType: {
          DataType: 'String',
          StringValue: eventType
        }
      }
    }).promise();
  } catch (error) {
    console.warn('Notification error:', error);
  }
}

/**
 * Send failed event to dead letter queue
 */
async function sendToDeadLetterQueue(originalEvent, error) {
  try {
    // This would typically be handled by Lambda's built-in DLQ configuration
    console.error('Sending to DLQ:', {
      event: originalEvent,
      error: error.message,
      timestamp: this.getDeterministicDate().toISOString()
    });
  } catch (dlqError) {
    console.error('DLQ error:', dlqError);
  }
}

// Warm-up handler to reduce cold start latency
export const warmup = async () => {
  console.log('Lambda warmup invocation');
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Warmed up' })
  };
};