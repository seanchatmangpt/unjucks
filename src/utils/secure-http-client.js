/**
 * Secure HTTP Client
 * Replaces axios with secure native Node.js HTTP implementation
 * Provides protection against the vulnerable axios dependency
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

class SecureHttpClient {
  constructor(options = {}) {
    this.timeout = options.timeout || 30000;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.defaultHeaders = options.headers || {
      'User-Agent': 'SecureHttpClient/1.0.0'
    };
  }

  /**
   * Make HTTP request with retry logic and timeout
   */
  async request(url, options = {}) {
    const {
      method = 'GET',
      headers = {},
      data = null,
      timeout = this.timeout,
      validateStatus = (status) => status >= 200 && status < 300
    } = options;

    let lastError;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this._makeRequest(url, {
          method,
          headers: { ...this.defaultHeaders, ...headers },
          data,
          timeout,
          validateStatus
        });
        return response;
      } catch (error) {
        lastError = error;
        if (attempt < this.maxRetries) {
          await this._delay(this.retryDelay * (attempt + 1));
        }
      }
    }
    throw lastError;
  }

  /**
   * GET request
   */
  async get(url, options = {}) {
    return this.request(url, { ...options, method: 'GET' });
  }

  /**
   * POST request
   */
  async post(url, data = null, options = {}) {
    return this.request(url, { ...options, method: 'POST', data });
  }

  /**
   * PUT request
   */
  async put(url, data = null, options = {}) {
    return this.request(url, { ...options, method: 'PUT', data });
  }

  /**
   * DELETE request
   */
  async delete(url, options = {}) {
    return this.request(url, { ...options, method: 'DELETE' });
  }

  /**
   * Internal method to make actual HTTP request
   */
  _makeRequest(url, options) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;
      const postData = options.data ? (
        typeof options.data === 'string' ? options.data : JSON.stringify(options.data)
      ) : null;

      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: options.method,
        headers: options.headers,
        timeout: options.timeout
      };

      // Set content-length for POST/PUT requests
      if (postData && ['POST', 'PUT', 'PATCH'].includes(options.method)) {
        requestOptions.headers['Content-Length'] = Buffer.byteLength(postData);
        if (!requestOptions.headers['Content-Type']) {
          requestOptions.headers['Content-Type'] = 'application/json';
        }
      }

      const req = client.request(requestOptions, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          const response = {
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: res.headers,
            data: responseData
          };

          // Try to parse JSON response
          try {
            if (res.headers['content-type']?.includes('application/json')) {
              response.data = JSON.parse(responseData);
            }
          } catch (e) {
            // Keep as string if not valid JSON
          }

          // Validate status code
          if (options.validateStatus(res.statusCode)) {
            resolve(response);
          } else {
            const error = new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`);
            error.response = response;
            error.status = res.statusCode;
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timeout after ${options.timeout}ms`));
      });

      // Write request body for POST/PUT requests
      if (postData) {
        req.write(postData);
      }

      req.end();
    });
  }

  /**
   * Utility method for delays
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance and class
const secureHttpClient = new SecureHttpClient();
module.exports = { SecureHttpClient, secureHttpClient };