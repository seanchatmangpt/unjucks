/**
 * Drift Detection Test Fixtures - Baseline States
 * Provides deterministic before/after file states for testing drift detection
 */

const crypto = require('crypto');

class DriftTestFixtures {
  constructor() {
    this.fixtures = new Map();
    this.initializeFixtures();
  }

  initializeFixtures() {
    // TypeScript Service Interface - Baseline
    this.addFixture('user-service-baseline', {
      content: `interface UserService {
  getUserById(id: string): Promise<User>;
  createUser(user: CreateUserRequest): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  deleteUser(id: string): Promise<void>;
}

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
}`,
      type: 'typescript',
      category: 'interface',
      semanticElements: ['getUserById', 'createUser', 'updateUser', 'deleteUser']
    });

    // TypeScript Service Interface - Semantic Change (Breaking)
    this.addFixture('user-service-breaking', {
      content: `interface UserService {
  getUserById(id: number): Promise<User>; // Changed string to number
  createUser(user: CreateUserRequest): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  // deleteUser removed - breaking change
}

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
}`,
      type: 'typescript',
      category: 'interface',
      semanticElements: ['getUserById', 'createUser', 'updateUser'],
      changes: ['parameter_type_change', 'method_removal']
    });

    // TypeScript Service Interface - Cosmetic Change Only
    this.addFixture('user-service-cosmetic', {
      content: `interface UserService {
  getUserById( id: string ): Promise<User> ;
  createUser( user: CreateUserRequest ): Promise<User> ;
  updateUser( id: string, updates: Partial<User> ): Promise<User> ;
  deleteUser( id: string ): Promise<void> ;
}

export interface User {
  id : string ;
  name : string ;
  email : string ;
  createdAt : Date ;
  updatedAt : Date ;
}

export interface CreateUserRequest {
  name : string ;
  email : string ;
  password : string ;
}`,
      type: 'typescript',
      category: 'interface',
      semanticElements: ['getUserById', 'createUser', 'updateUser', 'deleteUser'],
      changes: ['whitespace_formatting']
    });

    // React Component - Baseline
    this.addFixture('user-component-baseline', {
      content: `import React, { useState, useEffect } from 'react';
import { getUserById } from '../services/userService';

interface UserProfileProps {
  userId: string;
  onUserUpdate?: (user: User) => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ userId, onUserUpdate }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUser();
  }, [userId]);

  const loadUser = async () => {
    try {
      setLoading(true);
      const userData = await getUserById(userId);
      setUser(userData);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!user) return <div>User not found</div>;

  return (
    <div className="user-profile">
      <h2>{user.name}</h2>
      <p>Email: {user.email}</p>
      <p>Created: {user.createdAt.toLocaleDateString()}</p>
    </div>
  );
};`,
      type: 'react',
      category: 'component',
      semanticElements: ['UserProfile', 'loadUser', 'useState', 'useEffect']
    });

    // React Component - Semantic Change (Props Change)
    this.addFixture('user-component-breaking', {
      content: `import React, { useState, useEffect } from 'react';
import { getUserById } from '../services/userService';

interface UserProfileProps {
  userId: number; // Changed from string to number - breaking
  showEmail?: boolean; // Added optional prop
  // onUserUpdate removed - breaking change
}

export const UserProfile: React.FC<UserProfileProps> = ({ userId, showEmail = true }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUser();
  }, [userId]);

  const loadUser = async () => {
    try {
      setLoading(true);
      const userData = await getUserById(userId.toString()); // Convert number to string
      setUser(userData);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!user) return <div>User not found</div>;

  return (
    <div className="user-profile">
      <h2>{user.name}</h2>
      {showEmail && <p>Email: {user.email}</p>}
      <p>Created: {user.createdAt.toLocaleDateString()}</p>
    </div>
  );
};`,
      type: 'react',
      category: 'component',
      semanticElements: ['UserProfile', 'loadUser', 'useState', 'useEffect'],
      changes: ['prop_type_change', 'prop_addition', 'prop_removal']
    });

    // API Routes - Baseline
    this.addFixture('api-routes-baseline', {
      content: `import { Router } from 'express';
import { getUserById, createUser, updateUser, deleteUser } from '../services/userService';
import { validateUser } from '../middleware/validation';

const router = Router();

router.get('/users/:id', async (req, res) => {
  try {
    const user = await getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/users', validateUser, async (req, res) => {
  try {
    const user = await createUser(req.body);
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/users/:id', validateUser, async (req, res) => {
  try {
    const user = await updateUser(req.params.id, req.body);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    await deleteUser(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;`,
      type: 'api',
      category: 'routes',
      semanticElements: ['GET /users/:id', 'POST /users', 'PUT /users/:id', 'DELETE /users/:id']
    });

    // API Routes - Breaking Change (Removed Endpoint)
    this.addFixture('api-routes-breaking', {
      content: `import { Router } from 'express';
import { getUserById, createUser, updateUser } from '../services/userService';
import { validateUser } from '../middleware/validation';

const router = Router();

router.get('/users/:id', async (req, res) => {
  try {
    const user = await getUserById(parseInt(req.params.id)); // Changed to parseInt
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/users', validateUser, async (req, res) => {
  try {
    const user = await createUser(req.body);
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/users/:id', validateUser, async (req, res) => {
  try {
    const user = await updateUser(parseInt(req.params.id), req.body); // Changed to parseInt
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE endpoint removed - breaking change

export default router;`,
      type: 'api',
      category: 'routes',
      semanticElements: ['GET /users/:id', 'POST /users', 'PUT /users/:id'],
      changes: ['endpoint_removal', 'parameter_type_change']
    });

    // Dependency Changes - Baseline
    this.addFixture('dependencies-baseline', {
      content: `import { get } from 'lodash/get';
import { set } from 'lodash/set';
import { debounce } from 'lodash/debounce';
import moment from 'moment';

export class DataProcessor {
  private cache = new Map();

  processData(input: any): ProcessedData {
    const id = get(input, 'id', 'unknown');
    const timestamp = moment(get(input, 'timestamp')).format('YYYY-MM-DD');
    
    const result = {
      id,
      timestamp,
      processed: true
    };
    
    set(result, 'meta.processedAt', new Date());
    this.cache.set(id, result);
    
    return result;
  }

  debouncedProcess = debounce(this.processData.bind(this), 300);
}`,
      type: 'typescript',
      category: 'service',
      dependencies: ['lodash/get', 'lodash/set', 'lodash/debounce', 'moment'],
      bundleSize: 950 // Estimated KB
    });

    // Dependency Changes - Bundle Impact
    this.addFixture('dependencies-bloated', {
      content: `import _ from 'lodash';
import moment from 'moment';
import 'moment/locale/en'; // Additional locale

export class DataProcessor {
  private cache = new Map();

  processData(input: any): ProcessedData {
    const id = _.get(input, 'id', 'unknown');
    const timestamp = moment(_.get(input, 'timestamp')).format('YYYY-MM-DD');
    
    const result = {
      id,
      timestamp,
      processed: true
    };
    
    _.set(result, 'meta.processedAt', new Date());
    this.cache.set(id, result);
    
    return result;
  }

  debouncedProcess = _.debounce(this.processData.bind(this), 300);
}`,
      type: 'typescript',
      category: 'service',
      dependencies: ['lodash', 'moment', 'moment/locale/en'],
      bundleSize: 25067, // Much larger due to full lodash
      changes: ['dependency_scope_increase', 'additional_locale_import']
    });

    // Multiple Files for Batch Testing
    this.generateBatchTestFiles();
  }

  generateBatchTestFiles() {
    const categories = ['model', 'service', 'controller', 'util', 'type'];
    
    for (let i = 0; i < 50; i++) {
      const category = categories[i % categories.length];
      const hasSemanticChange = i < 5; // First 5 have semantic changes
      
      // Baseline version
      const baselineContent = this.generateArtifactContent(category, i, false);
      this.addFixture(`batch-${category}-${i}-baseline`, {
        content: baselineContent,
        type: 'typescript',
        category: category,
        batchIndex: i,
        hasSemanticChange: false
      });

      // Modified version (semantic or cosmetic)
      const modifiedContent = this.generateArtifactContent(category, i, hasSemanticChange);
      this.addFixture(`batch-${category}-${i}-modified`, {
        content: modifiedContent,
        type: 'typescript',
        category: category,
        batchIndex: i,
        hasSemanticChange: hasSemanticChange,
        changes: hasSemanticChange ? ['method_signature_change'] : ['formatting_change']
      });
    }
  }

  generateArtifactContent(category, index, hasSemanticChange) {
    const baseContent = `// Generated ${category} ${index}
export interface ${this.toPascalCase(category)}${index} {
  id: string;
  name: string;
  type: '${category}';
  getValue(): ${hasSemanticChange ? 'boolean' : 'string'};
  getStatus(): 'active' | 'inactive';
}

export class ${this.toPascalCase(category)}${index}Service {
  private items: ${this.toPascalCase(category)}${index}[] = [];

  add(item: ${this.toPascalCase(category)}${index}): void {
    this.items.push(item);
  }

  findById(id: string): ${this.toPascalCase(category)}${index} | null {
    return this.items.find(item => item.id === id) || null;
  }

  ${hasSemanticChange ? 'remove' : 'delete'}(id: string): boolean {
    const index = this.items.findIndex(item => item.id === id);
    if (index > -1) {
      this.items.splice(index, 1);
      return true;
    }
    return false;
  }
}`;

    if (hasSemanticChange) {
      return baseContent;
    } else {
      // Apply cosmetic formatting changes
      return baseContent
        .replace(/;/g, ' ;')
        .replace(/{/g, ' {\n  ')
        .replace(/}/g, '\n}')
        .replace(/,/g, ', ');
    }
  }

  addFixture(name, fixture) {
    const hash = crypto.createHash('sha256').update(fixture.content).digest('hex');
    this.fixtures.set(name, {
      ...fixture,
      hash,
      size: fixture.content.length,
      timestamp: new Date('2024-01-01T00:00:00.000Z').toISOString()
    });
  }

  getFixture(name) {
    return this.fixtures.get(name);
  }

  getFixtureContent(name) {
    const fixture = this.fixtures.get(name);
    return fixture ? fixture.content : null;
  }

  getAllFixtures() {
    return Array.from(this.fixtures.entries());
  }

  getFixturesByCategory(category) {
    return Array.from(this.fixtures.entries())
      .filter(([name, fixture]) => fixture.category === category);
  }

  getFixturesByType(type) {
    return Array.from(this.fixtures.entries())
      .filter(([name, fixture]) => fixture.type === type);
  }

  getBatchFixtures() {
    return Array.from(this.fixtures.entries())
      .filter(([name, fixture]) => name.startsWith('batch-'));
  }

  // Helper methods
  toPascalCase(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  calculateDifference(baseline, current) {
    if (!baseline || !current) return null;

    return {
      baselineHash: baseline.hash,
      currentHash: current.hash,
      hashMatch: baseline.hash === current.hash,
      sizeChange: current.size - baseline.size,
      sizeDifferencePercent: ((current.size - baseline.size) / baseline.size) * 100,
      contentDifference: this.getContentDifference(baseline.content, current.content)
    };
  }

  getContentDifference(baseline, current) {
    const baselineLines = baseline.split('\n');
    const currentLines = current.split('\n');
    
    let added = 0;
    let removed = 0;
    let modified = 0;

    const maxLines = Math.max(baselineLines.length, currentLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      const baselineLine = baselineLines[i];
      const currentLine = currentLines[i];
      
      if (!baselineLine && currentLine) {
        added++;
      } else if (baselineLine && !currentLine) {
        removed++;
      } else if (baselineLine !== currentLine) {
        modified++;
      }
    }

    return {
      linesAdded: added,
      linesRemoved: removed,
      linesModified: modified,
      totalChanges: added + removed + modified
    };
  }
}

// Export singleton instance
const driftFixtures = new DriftTestFixtures();
module.exports = driftFixtures;