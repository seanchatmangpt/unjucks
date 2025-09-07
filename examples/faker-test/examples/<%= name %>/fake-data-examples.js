/**
 * Faker.js Integration Demo
 * Generated with Unjucks faker filters
 * Seed: <%= fakeSeed(12345) %>
 * Locale: <%= fakeLocale('en') %>
 */

// Basic fake data generation
export const basicData = {
  // Personal Information
  fullName: '<%= fakeName() %>',
  firstName: '<%= fakeName().split(' ')[0] %>',
  email: '<%= fakeEmail() %>',
  phone: '<%= fakePhone() %>',
  
  // Location
  address: '<%= fakeAddress() %>',
  city: '<%= fakeCity() %>',
  
  // Business
  company: '<%= fakeCompany() %>',
  
  // Identifiers
  uuid: '<%= fakeUuid() %>',
  userId: <%= fakeNumber(1000, 9999) %>,
  
  // Content
  bio: '<%= fakeText(2) %>',
  description: '<%= fakeParagraph() %>',
  
  // Dates and Booleans
  birthDate: '<%= fakeDate('1950-01-01', '2005-12-31').toISOString() %>',
  isActive: <%= fakeBoolean() %>,
  isVerified: <%= fakeBoolean() %>,
  
  // Arrays and selections
  favoriteColor: '<%= fakeArrayElement(['red', 'blue', 'green', 'purple', 'orange']) %>',
  skills: [
    '<%= fakeArrayElement(['JavaScript', 'Python', 'Java', 'C++', 'Go']) %>',
    '<%= fakeArrayElement(['React', 'Vue', 'Angular', 'Svelte']) %>',
    '<%= fakeArrayElement(['Node.js', 'Django', 'Spring', 'Express']) %>'
  ]
};

// Complex schema-based generation
export const userProfile = <%= fakeSchema({
  personal: {
    name: 'name',
    email: 'email',
    age: {type: 'number', min: 18, max: 65},
    phone: 'phone'
  },
  professional: {
    company: 'company',
    title: ['Developer', 'Designer', 'Manager', 'Analyst'],
    experience: {type: 'number', min: 1, max: 20},
    skills: ['JavaScript', 'Python', 'Java', 'C++', 'Go', 'Rust']
  },
  preferences: {
    theme: ['light', 'dark'],
    notifications: 'boolean',
    newsletter: 'boolean'
  },
  metadata: {
    id: 'uuid',
    createdAt: 'date',
    lastLogin: {type: 'date', from: '2024-01-01', to: '2024-12-31'}
  }
}) | dump %>;

// Test data arrays with deterministic generation
<%= fakeSeed(54321) %>
export const testUsers = [
<% for i in range(1, 6) %>
  {
    id: <%= fakeNumber(1000, 9999) %>,
    name: '<%= fakeName() %>',
    email: '<%= fakeEmail() %>',
    role: '<%= fakeArrayElement(['admin', 'user', 'moderator', 'guest']) %>',
    isActive: <%= fakeBoolean() %>,
    joinDate: '<%= fakeDate('2020-01-01', '2024-12-31').toISOString().split('T')[0] %>',
    profile: {
      bio: '<%= fakeText(1) %>',
      avatar: 'https://i.pravatar.cc/150?u=<%= fakeUuid() %>',
      location: '<%= fakeCity() %>',
      company: '<%= fakeCompany() %>'
    }
  }<%= ',' if i < 5 else '' %>
<% endfor %>
];

// Mock API responses
export const mockApiResponses = {
  // User listing endpoint
  '/api/users': {
    data: [
<% for i in range(1, 11) %>
      {
        id: <%= fakeNumber(1, 1000) %>,
        name: '<%= fakeName() %>',
        email: '<%= fakeEmail() %>',
        avatar: 'https://i.pravatar.cc/64?u=<%= fakeUuid() %>',
        status: '<%= fakeArrayElement(['online', 'offline', 'away', 'busy']) %>',
        lastSeen: '<%= fakeDate('2024-11-01', '2024-12-31').toISOString() %>'
      }<%= ',' if i < 10 else '' %>
<% endfor %>
    ],
    pagination: {
      total: <%= fakeNumber(100, 1000) %>,
      page: 1,
      perPage: 10,
      hasNext: <%= fakeBoolean() %>
    }
  },

  // Product catalog endpoint
  '/api/products': {
    products: [
<% for i in range(1, 6) %>
      {
        id: '<%= fakeUuid() %>',
        name: '<%= fakeArrayElement(['Laptop', 'Mouse', 'Keyboard', 'Monitor', 'Headphones']) %> <%= fakeArrayElement(['Pro', 'Max', 'Ultra', 'Plus']) %>',
        price: <%= fakeNumber(50, 2000) %>,
        description: '<%= fakeText(3) %>',
        category: '<%= fakeArrayElement(['Electronics', 'Accessories', 'Computing', 'Gaming']) %>',
        inStock: <%= fakeBoolean() %>,
        rating: <%= fakeNumber(1, 5) %>.0,
        reviews: <%= fakeNumber(0, 500) %>,
        seller: '<%= fakeCompany() %>'
      }<%= ',' if i < 5 else '' %>
<% endfor %>
    ]
  },

  // Analytics dashboard data
  '/api/analytics': {
    overview: {
      totalUsers: <%= fakeNumber(1000, 50000) %>,
      activeUsers: <%= fakeNumber(500, 10000) %>,
      revenue: <%= fakeNumber(10000, 500000) %>,
      growth: <%= fakeNumber(-10, 25) %>
    },
    metrics: [
<% for i in range(1, 8) %>
      {
        date: '<%= fakeDate('2024-11-01', '2024-12-07').toISOString().split('T')[0] %>',
        users: <%= fakeNumber(100, 1000) %>,
        sessions: <%= fakeNumber(200, 2000) %>,
        pageViews: <%= fakeNumber(500, 5000) %>,
        revenue: <%= fakeNumber(1000, 10000) %>
      }<%= ',' if i < 7 else '' %>
<% endfor %>
    ]
  }
};

// Configuration examples
export const configurations = {
  // Database seeding configuration
  database: {
    users: {
      count: <%= fakeNumber(10, 100) %>,
      schema: <%= fakeSchema({
        tableName: 'users',
        columns: {
          id: 'uuid',
          name: 'name', 
          email: 'email',
          created_at: 'date',
          is_active: 'boolean'
        },
        indexes: ['email', 'created_at'],
        constraints: ['UNIQUE(email)']
      }) | dump %>
    }
  },

  // Test environment setup
  testing: {
    seed: 12345,
    locale: 'en',
    generateUsers: <%= fakeNumber(50, 200) %>,
    generatePosts: <%= fakeNumber(100, 500) %>,
    generateComments: <%= fakeNumber(200, 1000) %>
  },

  // Feature flags with random states
  features: {
    enableNotifications: <%= fakeBoolean() %>,
    enableDarkMode: <%= fakeBoolean() %>,
    enableAnalytics: <%= fakeBoolean() %>,
    enableBetaFeatures: <%= fakeBoolean() %>,
    maintenanceMode: false
  }
};

// Export all generated data
export default {
  basicData,
  userProfile,
  testUsers,
  mockApiResponses,
  configurations,
  
  // Utility functions for runtime generation
  generateUser: () => ({
    name: '<%= fakeName() %>',
    email: '<%= fakeEmail() %>',
    id: '<%= fakeUuid() %>',
    timestamp: Date.now()
  }),
  
  // Schema for dynamic generation
  userSchema: <%= fakeSchema({
    name: 'name',
    email: 'email',
    phone: 'phone',
    address: 'address',
    company: 'company'
  }) | dump %>
};