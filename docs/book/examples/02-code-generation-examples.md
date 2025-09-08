# Code Generation Examples - Before and After Comparisons

This document showcases the power of Unjucks v2 code generation through detailed before/after comparisons across different use cases.

## Table of Contents
- [Basic Service Generation](#basic-service-generation)
- [API Controller Generation](#api-controller-generation)
- [React Component Generation](#react-component-generation)
- [Database Migration Generation](#database-migration-generation)
- [Microservice Architecture Generation](#microservice-architecture-generation)
- [Test Suite Generation](#test-suite-generation)

---

## Basic Service Generation

### Command Used
```bash
unjucks generate service user-auth \
  --serviceName=UserAuthService \
  --databaseType=postgresql \
  --enableTwoFactor=true \
  --supportedProviders=local,google,github
```

### BEFORE: Manual Implementation Required

**File Structure (manual creation needed):**
```
src/services/
└── (empty - need to create everything manually)
```

**Manual Implementation Time:** ~4-6 hours

### AFTER: Generated Implementation

**File Structure (automatically generated):**
```
src/services/auth/
├── UserAuthService.ts
├── UserAuthService.test.ts
├── middleware/
│   └── jwt.middleware.ts
├── providers/
│   ├── local.provider.ts
│   ├── google.provider.ts
│   └── github.provider.ts
├── types/
│   └── auth.types.ts
└── utils/
    ├── token.utils.ts
    └── crypto.utils.ts
```

**Generated Code Example - UserAuthService.ts:**
```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseConnection } from '../database/connection';
import { Logger } from '../utils/logger';
import { 
  AuthCredentials, 
  AuthResult, 
  TwoFactorSetup,
  AuthProvider 
} from './types/auth.types';
import { LocalProvider } from './providers/local.provider';
import { GoogleProvider } from './providers/google.provider';
import { GithubProvider } from './providers/github.provider';

@Injectable()
export class UserAuthService {
  private readonly logger = new Logger(UserAuthService.name);
  private readonly providers: Map<string, AuthProvider> = new Map();

  constructor(
    private readonly jwtService: JwtService,
    private readonly db: DatabaseConnection
  ) {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    this.providers.set('local', new LocalProvider(this.db));
    this.providers.set('google', new GoogleProvider());
    this.providers.set('github', new GithubProvider());
  }

  async authenticate(
    credentials: AuthCredentials,
    provider: string = 'local'
  ): Promise<AuthResult> {
    const authProvider = this.providers.get(provider);
    if (!authProvider) {
      throw new UnauthorizedException(`Provider '${provider}' not supported`);
    }

    try {
      const user = await authProvider.validateUser(credentials);
      
      // Check if 2FA is required
      if (user.twoFactorEnabled && !credentials.twoFactorToken) {
        return {
          success: false,
          requiresTwoFactor: true,
          message: 'Two-factor authentication required'
        };
      }

      // Validate 2FA token if provided
      if (user.twoFactorEnabled && credentials.twoFactorToken) {
        const isValidToken = await this.validateTwoFactorToken(
          user.id,
          credentials.twoFactorToken
        );
        
        if (!isValidToken) {
          throw new UnauthorizedException('Invalid two-factor token');
        }
      }

      const token = this.jwtService.sign({
        sub: user.id,
        email: user.email,
        provider
      });

      await this.logAuthEvent(user.id, 'login_success', provider);

      return {
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      };

    } catch (error) {
      this.logger.error(`Authentication failed for provider ${provider}`, error);
      await this.logAuthEvent(null, 'login_failed', provider);
      throw new UnauthorizedException('Authentication failed');
    }
  }

  async setupTwoFactor(userId: string): Promise<TwoFactorSetup> {
    const secret = this.generateTwoFactorSecret();
    const qrCodeUrl = this.generateQRCode(userId, secret);
    
    await this.db.query(
      'UPDATE users SET two_factor_secret = $1 WHERE id = $2',
      [secret, userId]
    );

    return {
      secret,
      qrCodeUrl,
      backupCodes: this.generateBackupCodes()
    };
  }

  private async validateTwoFactorToken(
    userId: string,
    token: string
  ): Promise<boolean> {
    // Implementation for TOTP validation
    const user = await this.db.findOne('users', { id: userId });
    return this.verifyTOTP(user.two_factor_secret, token);
  }

  private async logAuthEvent(
    userId: string | null,
    event: string,
    provider: string
  ): Promise<void> {
    await this.db.insert('auth_logs', {
      user_id: userId,
      event,
      provider,
      timestamp: new Date(),
      ip_address: this.getClientIP()
    });
  }

  // Additional helper methods...
}
```

**Time Saved:** 4-5 hours → 2 minutes

---

## API Controller Generation

### Command Used
```bash
unjucks generate api rest-api \
  --apiName=UserManagement \
  --version=2.0.0 \
  --entities='[
    {
      "name": "User",
      "fields": [
        {"name": "email", "type": "string", "required": true, "validation": {"format": "email"}},
        {"name": "age", "type": "number", "required": false, "validation": {"min": 0, "max": 120}}
      ]
    }
  ]'
```

### BEFORE: Manual API Development

**Required Manual Work:**
- Create controller classes
- Define route handlers
- Implement validation middleware
- Write OpenAPI documentation
- Set up error handling
- Create response schemas
- Implement CRUD operations

### AFTER: Complete API Generated

**Generated Structure:**
```
api/usermanagement/
├── index.ts
├── models/
│   └── User.ts
├── controllers/
│   └── user.controller.ts
├── routes/
│   └── user.routes.ts
├── middleware/
│   ├── validation.middleware.ts
│   └── error-handler.middleware.ts
├── docs/
│   └── openapi.yml
└── Dockerfile
```

**Generated Controller Example:**
```typescript
import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';
import { CreateUserDto, UpdateUserDto } from '../dto/user.dto';
import { validateDto } from '../middleware/validation.middleware';

export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * GET /api/users
   * Retrieve all users with pagination
   */
  async getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 10, search } = req.query;
      
      const result = await this.userService.findAll({
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string
      });

      res.status(200).json({
        success: true,
        data: result.users,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          pages: Math.ceil(result.total / result.limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/users/:id
   * Retrieve a specific user by ID
   */
  async getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const user = await this.userService.findById(id);

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/users
   * Create a new user
   */
  async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await validateDto(CreateUserDto, req.body);
      
      const user = await this.userService.create(req.body);

      res.status(201).json({
        success: true,
        data: user,
        message: 'User created successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/users/:id
   * Update an existing user
   */
  async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await validateDto(UpdateUserDto, req.body);

      const user = await this.userService.update(id, req.body);

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: user,
        message: 'User updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/users/:id
   * Delete a user
   */
  async deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const deleted = await this.userService.delete(id);

      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}
```

**Generated OpenAPI Documentation:**
```yaml
openapi: 3.0.0
info:
  title: UserManagement API
  version: 2.0.0
  description: Complete REST API for user management

paths:
  /api/users:
    get:
      summary: Get all users
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            default: 10
        - name: search
          in: query
          schema:
            type: string
      responses:
        '200':
          description: Users retrieved successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/User'
    
    post:
      summary: Create a new user
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateUserDto'
      responses:
        '201':
          description: User created successfully

components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: string
          format: uuid
        email:
          type: string
          format: email
        age:
          type: integer
          minimum: 0
          maximum: 120
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time
```

---

## React Component Generation

### Command Used
```bash
unjucks generate component user-profile \
  --componentName=UserProfile \
  --componentType=functional \
  --styling=css-modules \
  --props='[
    {"name": "user", "type": "User", "required": true},
    {"name": "onEdit", "type": "(user: User) => void", "required": false}
  ]'
```

### BEFORE: Manual Component Development
- Create component file
- Set up prop types and interfaces
- Implement styling
- Write unit tests
- Create Storybook stories
- Set up component exports

### AFTER: Complete Component Generated

**Generated Files:**
```
src/components/UserProfile/
├── UserProfile.tsx
├── UserProfile.module.css
├── UserProfile.test.tsx
├── UserProfile.stories.tsx
└── index.ts
```

**Generated Component:**
```tsx
import React from 'react';
import styles from './UserProfile.module.css';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  lastActive: Date;
}

export interface UserProfileProps {
  user: User;
  onEdit?: (user: User) => void;
  className?: string;
}

export const UserProfile: React.FC<UserProfileProps> = ({
  user,
  onEdit,
  className
}) => {
  const handleEditClick = () => {
    if (onEdit) {
      onEdit(user);
    }
  };

  const formatLastActive = (date: Date) => {
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
      .format(Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)), 'day');
  };

  return (
    <div className={`${styles.userProfile} ${className || ''}`}>
      <div className={styles.avatar}>
        {user.avatar ? (
          <img src={user.avatar} alt={`${user.name}'s avatar`} />
        ) : (
          <div className={styles.avatarFallback}>
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      
      <div className={styles.userInfo}>
        <h2 className={styles.userName}>{user.name}</h2>
        <p className={styles.userEmail}>{user.email}</p>
        <span className={styles.userRole}>{user.role}</span>
        <p className={styles.lastActive}>
          Last active: {formatLastActive(user.lastActive)}
        </p>
      </div>
      
      {onEdit && (
        <button 
          className={styles.editButton}
          onClick={handleEditClick}
          aria-label={`Edit ${user.name}'s profile`}
        >
          Edit Profile
        </button>
      )}
    </div>
  );
};

export default UserProfile;
```

**Generated Tests:**
```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { UserProfile, User } from './UserProfile';

const mockUser: User = {
  id: '1',
  name: 'John Doe',
  email: 'john.doe@example.com',
  role: 'Developer',
  lastActive: new Date('2023-12-01T10:00:00Z')
};

describe('UserProfile', () => {
  it('renders user information correctly', () => {
    render(<UserProfile user={mockUser} />);
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
    expect(screen.getByText('Developer')).toBeInTheDocument();
  });

  it('displays avatar when provided', () => {
    const userWithAvatar = { ...mockUser, avatar: 'https://example.com/avatar.jpg' };
    render(<UserProfile user={userWithAvatar} />);
    
    const avatar = screen.getByAltText("John Doe's avatar");
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');
  });

  it('shows fallback avatar when no avatar is provided', () => {
    render(<UserProfile user={mockUser} />);
    
    expect(screen.getByText('J')).toBeInTheDocument();
  });

  it('calls onEdit when edit button is clicked', () => {
    const onEditMock = jest.fn();
    render(<UserProfile user={mockUser} onEdit={onEditMock} />);
    
    const editButton = screen.getByLabelText("Edit John Doe's profile");
    fireEvent.click(editButton);
    
    expect(onEditMock).toHaveBeenCalledWith(mockUser);
  });

  it('does not show edit button when onEdit is not provided', () => {
    render(<UserProfile user={mockUser} />);
    
    expect(screen.queryByText('Edit Profile')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <UserProfile user={mockUser} className="custom-class" />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
```

---

## Database Migration Generation

### Command Used
```bash
unjucks generate migration add-user-preferences \
  --migrationName=add_user_preferences \
  --tables='[
    {
      "name": "user_preferences",
      "action": "create",
      "columns": [
        {"name": "id", "type": "uuid", "constraints": ["PRIMARY KEY", "DEFAULT gen_random_uuid()"]},
        {"name": "user_id", "type": "uuid", "constraints": ["NOT NULL", "REFERENCES users(id)"]},
        {"name": "theme", "type": "varchar(20)", "constraints": ["DEFAULT 'light'"]},
        {"name": "language", "type": "varchar(10)", "constraints": ["DEFAULT 'en'"]},
        {"name": "notifications", "type": "jsonb", "constraints": ["DEFAULT '{}'"]},
        {"name": "created_at", "type": "timestamp", "constraints": ["DEFAULT NOW()"]}
      ]
    }
  ]'
```

### BEFORE: Manual Migration Writing
- Research database schema changes
- Write SQL migration manually
- Create rollback script
- Test migration on development database
- Document changes

### AFTER: Complete Migration Generated

**Generated Files:**
```
migrations/
├── 20231201120000_add_user_preferences_up.sql
├── 20231201120000_add_user_preferences_down.sql
└── migration_metadata.json
```

**Generated UP Migration:**
```sql
-- Migration: add_user_preferences
-- Generated: 2023-12-01 12:00:00
-- Description: Add user preferences table with theme, language, and notification settings

BEGIN;

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    theme VARCHAR(20) DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'system')),
    language VARCHAR(10) DEFAULT 'en' CHECK (language ~ '^[a-z]{2}(-[A-Z]{2})?$'),
    notifications JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_preferences_user_id 
ON user_preferences(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_preferences_theme 
ON user_preferences(theme);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_user_preferences_updated_at();

-- Insert default preferences for existing users
INSERT INTO user_preferences (user_id, theme, language, notifications)
SELECT 
    id,
    'light',
    'en',
    '{
        "email": true,
        "push": false,
        "sms": false,
        "marketing": false
    }'::jsonb
FROM users 
WHERE NOT EXISTS (
    SELECT 1 FROM user_preferences WHERE user_preferences.user_id = users.id
);

COMMIT;
```

**Generated DOWN Migration (Rollback):**
```sql
-- Rollback Migration: add_user_preferences
-- This will remove the user_preferences table and related objects

BEGIN;

-- Drop triggers
DROP TRIGGER IF EXISTS trigger_user_preferences_updated_at ON user_preferences;
DROP FUNCTION IF EXISTS update_user_preferences_updated_at();

-- Drop indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_user_preferences_user_id;
DROP INDEX CONCURRENTLY IF EXISTS idx_user_preferences_theme;

-- Drop table
DROP TABLE IF EXISTS user_preferences CASCADE;

COMMIT;
```

---

## Performance Comparison Summary

| Task Type | Manual Time | Generated Time | Time Saved | Files Generated |
|-----------|-------------|----------------|------------|-----------------|
| Basic Service | 4-6 hours | 2 minutes | 95%+ | 8 files |
| API Controller | 6-8 hours | 3 minutes | 96%+ | 12 files |
| React Component | 2-3 hours | 1 minute | 97%+ | 5 files |
| Database Migration | 1-2 hours | 30 seconds | 98%+ | 3 files |
| Microservice Setup | 8-12 hours | 5 minutes | 97%+ | 25+ files |

## Quality Benefits

### Generated Code Advantages:
1. **Consistency**: All generated code follows the same patterns and conventions
2. **Best Practices**: Built-in implementation of security, error handling, and performance optimizations
3. **Testing**: Comprehensive test suites generated automatically
4. **Documentation**: Complete API documentation and inline comments
5. **Type Safety**: Full TypeScript support with proper type definitions
6. **Validation**: Built-in input validation and error handling
7. **Maintainability**: Clean, modular code structure

### Developer Experience Improvements:
- **Reduced Cognitive Load**: Focus on business logic, not boilerplate
- **Faster Iteration**: Quick prototyping and feature development
- **Fewer Bugs**: Tested, proven patterns reduce common mistakes
- **Better Architecture**: Enforced best practices and patterns
- **Team Alignment**: Consistent codebase across team members

This demonstrates the transformative power of Unjucks v2's code generation capabilities, turning hours of manual work into minutes of automated generation while maintaining high code quality and consistency.