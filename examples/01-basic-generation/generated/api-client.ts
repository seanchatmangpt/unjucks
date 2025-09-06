// @ts-nocheck
/**
 * Generated API Client
 * 
 * This file was generated from semantic data using Unjucks.
 * Do not modify directly - regenerate from the TTL schema.
 */

// API Configuration
export const API_CONFIG = {
  name: 'User Management API',
  version: '1.0.0',
  baseUrl: 'https://api.example.com/v1'
};

// Type Definitions
export interface User {
  /** Unique user identifier */
  id: string;
  /** User's full name */
  name: string;
  /** User's email address */
  email: string;
  /** When the user was created */
  createdAt: string;
  /** When the user was last updated */
  updatedAt: string;
}

export interface UserInput {
  /** User's full name */
  name: string;
  /** User's email address */
  email: string;
}

export interface UserList {
  /** Array of user objects */
  users: User[];
  /** Total number of users */
  total: number;
  /** Pagination information */
  pagination: PaginationInfo;
}

export interface DeleteResponse {
  /** Whether the operation succeeded */
  success: boolean;
  /** Operation result message */
  message?: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// API Client Class
export class UserManagementAPIClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(baseUrl?: string, headers: Record<string, string> = {}) {
    this.baseUrl = baseUrl || API_CONFIG.baseUrl;
    this.headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...headers
    };
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string | number>
  ): Promise<T> {
    const url = new URL(path, this.baseUrl);
    
    // Add query parameters
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    const response = await fetch(url.toString(), {
      method,
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Retrieve all users
   * GET /users
   */
  async getUsers(
    params?: {
      page?: number;
      limit?: number;
    }
  ): Promise<UserList> {
    return this.request<UserList>(
      'GET',
      '/users',
      undefined,
      params
    );
  }

  /**
   * Retrieve a specific user
   * GET /users/{id}
   */
  async getUser(
    id: string
  ): Promise<User> {
    let path = '/users/{id}';
    path = path.replace('{id}', id);

    return this.request<User>(
      'GET',
      path
    );
  }

  /**
   * Create a new user
   * POST /users
   */
  async createUser(
    data: UserInput
  ): Promise<User> {
    return this.request<User>(
      'POST',
      '/users',
      data
    );
  }

  /**
   * Update an existing user
   * PUT /users/{id}
   */
  async updateUser(
    id: string,
    data: UserInput
  ): Promise<User> {
    let path = '/users/{id}';
    path = path.replace('{id}', id);

    return this.request<User>(
      'PUT',
      path,
      data
    );
  }

  /**
   * Delete a user
   * DELETE /users/{id}
   */
  async deleteUser(
    id: string
  ): Promise<DeleteResponse> {
    let path = '/users/{id}';
    path = path.replace('{id}', id);

    return this.request<DeleteResponse>(
      'DELETE',
      path
    );
  }
}

// Export default instance
export const apiClient = new UserManagementAPIClient();

// Usage Examples:
/*
// Get all users
const users = await apiClient.getUsers({ page: 1, limit: 10 });

// Get specific user
const user = await apiClient.getUser('123');

// Create new user
const newUser = await apiClient.createUser({
  name: 'John Doe',
  email: 'john@example.com'
});

// Update user
const updatedUser = await apiClient.updateUser('123', {
  name: 'Jane Doe',
  email: 'jane@example.com'
});

// Delete user
const result = await apiClient.deleteUser('123');
*/