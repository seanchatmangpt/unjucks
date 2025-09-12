/**
 * Message Queue Implementation for Distributed KGEN
 * 
 * Provides reliable inter-node communication with support for multiple backends
 * including Redis, RabbitMQ, and Kafka for different scaling requirements.
 */

import EventEmitter from 'events';
import crypto from 'crypto';

export class MessageQueue extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.type = options.type || 'redis'; // redis, rabbitmq, kafka, memory
    this.connection = options.connection || {};
    this.nodeId = options.nodeId || crypto.randomUUID();
    this.debug = options.debug || false;
    
    this.config = {
      requestTimeout: options.requestTimeout || 60000, // 1 minute
      maxRetries: options.maxRetries || 3,
      backoffMultiplier: options.backoffMultiplier || 2,
      maxConcurrency: options.maxConcurrency || 100,
      heartbeatInterval: options.heartbeatInterval || 30000, // 30 seconds
      ...options.config
    };
    
    // Internal state
    this.client = null;
    this.subscriptions = new Map(); // channel -> callback
    this.pendingRequests = new Map(); // requestId -> { resolve, reject, timeout }
    this.messageHandlers = new Map(); // messageType -> handler
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    
    this.statistics = {
      messagesSent: 0,
      messagesReceived: 0,
      requestsSent: 0,
      responsesReceived: 0,
      errors: 0,
      reconnections: 0,
      averageLatency: 0,
      totalLatency: 0
    };
  }
  
  /**
   * Initialize the message queue connection
   */
  async initialize() {
    try {
      if (this.debug) {
        console.log(`[MessageQueue] Initializing ${this.type} message queue`);
      }
      
      switch (this.type) {
        case 'redis':
          await this.initializeRedis();
          break;
        case 'rabbitmq':
          await this.initializeRabbitMQ();
          break;
        case 'kafka':
          await this.initializeKafka();
          break;
        case 'memory':
          await this.initializeMemory();
          break;
        default:
          throw new Error(`Unsupported message queue type: ${this.type}`);
      }
      
      // Set up response handling
      await this.subscribe(`node:${this.nodeId}:responses`, (message) => {
        this.handleResponse(message);
      });
      
      // Set up work queue handling
      await this.subscribe(`node:${this.nodeId}:work`, (message) => {
        this.handleWorkMessage(message);
      });
      
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      if (this.debug) {
        console.log(`[MessageQueue] Successfully initialized ${this.type} message queue`);
      }
      
      this.emit('connected');
      return { success: true };
      
    } catch (error) {
      console.error(`[MessageQueue] Initialization failed:`, error);
      this.emit('error', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Initialize Redis-based message queue
   */
  async initializeRedis() {
    // In a real implementation, you would use redis client
    // For now, we'll simulate with a memory-based approach
    if (this.debug) {
      console.log(`[MessageQueue] Redis client would be initialized here`);
      console.log(`[MessageQueue] Connection:`, this.connection);
    }
    
    // Simulated Redis client
    this.client = {
      type: 'redis',
      channels: new Map(),
      
      publish: async (channel, message) => {
        const messageStr = JSON.stringify(message);
        if (this.debug) {
          console.log(`[MessageQueue] Redis PUBLISH ${channel}: ${messageStr.substring(0, 100)}...`);
        }
        
        // Simulate publishing to subscribers
        const subscribers = this.client.channels.get(channel) || [];
        setTimeout(() => {
          subscribers.forEach(callback => {
            try {
              callback(message);
            } catch (error) {
              console.error(`[MessageQueue] Subscriber error:`, error);
            }
          });
        }, 10); // Simulate async delivery
        
        return 1; // Number of subscribers
      },
      
      subscribe: async (channel, callback) => {
        if (!this.client.channels.has(channel)) {
          this.client.channels.set(channel, []);
        }
        this.client.channels.get(channel).push(callback);
        
        if (this.debug) {
          console.log(`[MessageQueue] Redis SUBSCRIBE ${channel}`);
        }
      },
      
      unsubscribe: async (channel) => {
        this.client.channels.delete(channel);
        if (this.debug) {
          console.log(`[MessageQueue] Redis UNSUBSCRIBE ${channel}`);
        }
      }
    };
  }
  
  /**
   * Initialize RabbitMQ-based message queue
   */
  async initializeRabbitMQ() {
    if (this.debug) {
      console.log(`[MessageQueue] RabbitMQ client would be initialized here`);
    }
    
    // Simulated RabbitMQ client
    this.client = {
      type: 'rabbitmq',
      exchanges: new Map(),
      queues: new Map(),
      
      publish: async (exchange, routingKey, message) => {
        // Simulate RabbitMQ publishing
        const fullKey = `${exchange}:${routingKey}`;
        return this.simulatePublish(fullKey, message);
      },
      
      consume: async (queue, callback) => {
        // Simulate RabbitMQ consumption
        return this.simulateSubscribe(queue, callback);
      }
    };
  }
  
  /**
   * Initialize Kafka-based message queue
   */
  async initializeKafka() {
    if (this.debug) {
      console.log(`[MessageQueue] Kafka client would be initialized here`);
    }
    
    // Simulated Kafka client
    this.client = {
      type: 'kafka',
      topics: new Map(),
      
      produce: async (topic, message, partition = null) => {
        return this.simulatePublish(topic, message);
      },
      
      consume: async (topic, callback) => {
        return this.simulateSubscribe(topic, callback);
      }
    };
  }
  
  /**
   * Initialize memory-based message queue (for testing)
   */
  async initializeMemory() {
    this.client = {
      type: 'memory',
      channels: new Map(),
      
      publish: async (channel, message) => {
        return this.simulatePublish(channel, message);
      },
      
      subscribe: async (channel, callback) => {
        return this.simulateSubscribe(channel, callback);
      }
    };
  }
  
  /**
   * Simulate message publishing for testing
   */
  simulatePublish(channel, message) {
    const subscribers = this.subscriptions.get(channel) || [];
    
    if (this.debug) {
      console.log(`[MessageQueue] Publishing to ${channel}: ${JSON.stringify(message).substring(0, 100)}...`);
    }
    
    // Simulate async delivery
    setTimeout(() => {
      subscribers.forEach(callback => {
        try {
          callback(message);
        } catch (error) {
          console.error(`[MessageQueue] Subscriber error:`, error);
        }
      });
    }, Math.random() * 20 + 5); // 5-25ms delay
    
    this.statistics.messagesSent++;
    return subscribers.length;
  }
  
  /**
   * Simulate message subscription for testing
   */
  simulateSubscribe(channel, callback) {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, []);
    }
    
    this.subscriptions.get(channel).push(callback);
    
    if (this.debug) {
      console.log(`[MessageQueue] Subscribed to ${channel}`);
    }
  }
  
  /**
   * Send a message to a channel
   */
  async sendMessage(channel, message, options = {}) {
    if (!this.isConnected) {
      throw new Error('Message queue not connected');
    }
    
    const enrichedMessage = {
      ...message,
      messageId: crypto.randomUUID(),
      timestamp: Date.now(),
      sender: this.nodeId,
      channel
    };
    
    try {
      let result;
      
      switch (this.client.type) {
        case 'redis':
          result = await this.client.publish(channel, enrichedMessage);
          break;
          
        case 'rabbitmq':
          const [exchange, routingKey] = channel.split(':');
          result = await this.client.publish(exchange, routingKey, enrichedMessage);
          break;
          
        case 'kafka':
          result = await this.client.produce(channel, enrichedMessage, options.partition);
          break;
          
        case 'memory':
          result = await this.client.publish(channel, enrichedMessage);
          break;
          
        default:
          throw new Error(`Unsupported client type: ${this.client.type}`);
      }
      
      this.statistics.messagesSent++;
      
      if (this.debug) {
        console.log(`[MessageQueue] Sent message to ${channel}: ${enrichedMessage.messageId}`);
      }
      
      return {
        success: true,
        messageId: enrichedMessage.messageId,
        subscribers: result
      };
      
    } catch (error) {
      this.statistics.errors++;
      console.error(`[MessageQueue] Failed to send message to ${channel}:`, error);
      throw error;
    }
  }
  
  /**
   * Send a request and wait for response
   */
  async sendRequest(channel, message, options = {}) {
    const requestId = crypto.randomUUID();
    const timeout = options.timeout || this.config.requestTimeout;
    const responseChannel = `node:${this.nodeId}:responses`;
    
    const requestMessage = {
      ...message,
      requestId,
      responseChannel,
      type: 'request'
    };
    
    // Set up response handler
    const responsePromise = new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);
      
      this.pendingRequests.set(requestId, {
        resolve: (response) => {
          clearTimeout(timeoutHandle);
          resolve(response);
        },
        reject: (error) => {
          clearTimeout(timeoutHandle);
          reject(error);
        },
        timeout: timeoutHandle,
        startTime: Date.now()
      });
    });
    
    // Send the request
    await this.sendMessage(channel, requestMessage);
    this.statistics.requestsSent++;
    
    if (this.debug) {
      console.log(`[MessageQueue] Sent request ${requestId} to ${channel}`);
    }
    
    // Wait for response
    try {
      const response = await responsePromise;
      this.statistics.responsesReceived++;
      return response;
    } catch (error) {
      this.statistics.errors++;
      throw error;
    }
  }
  
  /**
   * Subscribe to a channel
   */
  async subscribe(channel, callback) {
    if (!this.isConnected) {
      throw new Error('Message queue not connected');
    }
    
    const wrappedCallback = (message) => {
      this.statistics.messagesReceived++;
      
      if (this.debug) {
        console.log(`[MessageQueue] Received message on ${channel}: ${message.messageId || 'unknown'}`);
      }
      
      try {
        callback(message);
      } catch (error) {
        console.error(`[MessageQueue] Message handler error:`, error);
        this.statistics.errors++;
      }
    };
    
    switch (this.client.type) {
      case 'redis':
        await this.client.subscribe(channel, wrappedCallback);
        break;
        
      case 'rabbitmq':
        await this.client.consume(channel, wrappedCallback);
        break;
        
      case 'kafka':
        await this.client.consume(channel, wrappedCallback);
        break;
        
      case 'memory':
        await this.client.subscribe(channel, wrappedCallback);
        break;
        
      default:
        throw new Error(`Unsupported client type: ${this.client.type}`);
    }
    
    if (this.debug) {
      console.log(`[MessageQueue] Subscribed to ${channel}`);
    }
  }
  
  /**
   * Unsubscribe from a channel
   */
  async unsubscribe(channel) {
    if (this.client && this.client.unsubscribe) {
      await this.client.unsubscribe(channel);
    }
    
    // Clean up internal subscriptions
    this.subscriptions.delete(channel);
    
    if (this.debug) {
      console.log(`[MessageQueue] Unsubscribed from ${channel}`);
    }
  }
  
  /**
   * Handle response messages
   */
  handleResponse(message) {
    const { requestId, response, error } = message;
    
    if (!requestId) {
      if (this.debug) {
        console.log(`[MessageQueue] Received response without requestId`);
      }
      return;
    }
    
    const pendingRequest = this.pendingRequests.get(requestId);
    if (!pendingRequest) {
      if (this.debug) {
        console.log(`[MessageQueue] Received response for unknown request ${requestId}`);
      }
      return;
    }
    
    this.pendingRequests.delete(requestId);
    
    // Calculate latency
    const latency = Date.now() - pendingRequest.startTime;
    this.updateLatencyStats(latency);
    
    if (error) {
      pendingRequest.reject(new Error(error));
    } else {
      pendingRequest.resolve(response);
    }
  }
  
  /**
   * Handle work messages (for distributed processing)
   */
  async handleWorkMessage(message) {
    const { jobId, partitionId, partition, operation, parameters, requestId, responseChannel } = message;
    
    if (this.debug) {
      console.log(`[MessageQueue] Received work message: ${jobId}/${partitionId}`);
    }
    
    try {
      // Process the work (this would be implemented by the specific node type)
      const startTime = Date.now();
      
      // Emit work event for handlers to process
      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Work processing timeout'));
        }, parameters.timeout || 300000);
        
        this.emit('work', {
          jobId,
          partitionId,
          partition,
          operation,
          parameters,
          resolve: (result) => {
            clearTimeout(timeout);
            resolve(result);
          },
          reject: (error) => {
            clearTimeout(timeout);
            reject(error);
          }
        });
      });
      
      const processingTime = Date.now() - startTime;
      
      // Send response back
      if (requestId && responseChannel) {
        await this.sendMessage(responseChannel, {
          requestId,
          response: {
            success: true,
            result,
            processingTime
          },
          type: 'response'
        });
      }
      
    } catch (error) {
      console.error(`[MessageQueue] Work processing failed:`, error);
      
      // Send error response
      if (requestId && responseChannel) {
        await this.sendMessage(responseChannel, {
          requestId,
          error: error.message,
          type: 'response'
        });
      }
    }
  }
  
  /**
   * Broadcast a message to multiple channels
   */
  async broadcast(channels, message, options = {}) {
    const results = [];
    
    for (const channel of channels) {
      try {
        const result = await this.sendMessage(channel, message, options);
        results.push({ channel, success: true, result });
      } catch (error) {
        results.push({ channel, success: false, error: error.message });
      }
    }
    
    return results;
  }
  
  /**
   * Get message queue statistics
   */
  getStatistics() {
    return {
      ...this.statistics,
      isConnected: this.isConnected,
      pendingRequests: this.pendingRequests.size,
      subscriptions: this.subscriptions.size,
      queueType: this.type,
      nodeId: this.nodeId
    };
  }
  
  /**
   * Update latency statistics
   */
  updateLatencyStats(latency) {
    this.statistics.totalLatency += latency;
    const responseCount = this.statistics.responsesReceived || 1;
    this.statistics.averageLatency = this.statistics.totalLatency / responseCount;
  }
  
  /**
   * Health check for the message queue
   */
  async healthCheck() {
    try {
      // Send a ping message to ourselves
      const testChannel = `node:${this.nodeId}:health`;
      const testMessage = { type: 'ping', timestamp: Date.now() };
      
      // Set up temporary subscription for health check
      let received = false;
      const healthPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Health check timeout'));
        }, 5000);
        
        const callback = (message) => {
          if (message.type === 'ping') {
            clearTimeout(timeout);
            received = true;
            resolve(true);
          }
        };
        
        this.subscribe(testChannel, callback).then(() => {
          this.sendMessage(testChannel, testMessage);
        });
      });
      
      await healthPromise;
      await this.unsubscribe(testChannel);
      
      return {
        healthy: true,
        latency: Date.now() - testMessage.timestamp,
        statistics: this.getStatistics()
      };
      
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        statistics: this.getStatistics()
      };
    }
  }
  
  /**
   * Shutdown the message queue gracefully
   */
  async shutdown() {
    if (this.debug) {
      console.log(`[MessageQueue] Shutting down message queue`);
    }
    
    // Clear pending requests
    for (const [requestId, request] of this.pendingRequests) {
      clearTimeout(request.timeout);
      request.reject(new Error('Message queue shutting down'));
    }
    this.pendingRequests.clear();
    
    // Clear subscriptions
    this.subscriptions.clear();
    
    // Close client connection
    if (this.client && this.client.close) {
      await this.client.close();
    }
    
    this.isConnected = false;
    this.emit('disconnected');
    
    if (this.debug) {
      console.log(`[MessageQueue] Message queue shut down successfully`);
    }
  }
}

export default MessageQueue;
