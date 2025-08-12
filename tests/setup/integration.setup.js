/**
 * Integration Test Setup
 * Configures the testing environment for API and service integration tests
 */

import '@testing-library/jest-dom';
import { beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { server } from '../mocks/server';

// Start server before all tests
beforeAll(() => {
  server.listen({
    onUnhandledRequest: 'error',
  });
});

// Reset handlers after each test
afterEach(() => {
  server.resetHandlers();
});

// Clean up after all tests
afterAll(() => {
  server.close();
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock fetch for tests that don't use MSW
global.fetch = jest.fn();

// Mock TextEncoder/TextDecoder for Node environment
if (typeof TextEncoder === 'undefined') {
  global.TextEncoder = require('util').TextEncoder;
}

if (typeof TextDecoder === 'undefined') {
  global.TextDecoder = require('util').TextDecoder;
}

// Mock FormData for Node environment
if (typeof FormData === 'undefined') {
  global.FormData = require('form-data');
}

// Mock File and Blob for file upload tests
if (typeof File === 'undefined') {
  global.File = class File {
    constructor(fileBits, fileName, options = {}) {
      this.name = fileName;
      this.size = fileBits.reduce((acc, bit) => acc + bit.length, 0);
      this.type = options.type || '';
      this.lastModified = Date.now();
    }
  };
}

if (typeof Blob === 'undefined') {
  global.Blob = class Blob {
    constructor(blobParts = [], options = {}) {
      this.size = blobParts.reduce((acc, part) => acc + part.length, 0);
      this.type = options.type || '';
    }
  };
}

// Mock crypto for Node environment
if (typeof crypto === 'undefined') {
  const { webcrypto } = require('crypto');
  global.crypto = webcrypto;
}

// Test database configuration
global.testConfig = {
  database: {
    url: process.env.SUPABASE_URL || 'http://localhost:54321',
    anonKey: process.env.SUPABASE_ANON_KEY || 'test-anon-key',
  },
  ai: {
    openRouterApiKey: 'test-openrouter-key',
    pineconeApiKey: 'test-pinecone-key',
  },
};

// Increase timeout for integration tests
jest.setTimeout(30000);