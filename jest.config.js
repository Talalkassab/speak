const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  
  // Support for multiple test environments
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/__tests__/unit/**/*.(test|spec).(js|jsx|ts|tsx)'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.js'],
    },
    {
      displayName: 'integration', 
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/integration/**/*.(test|spec).(js|jsx|ts|tsx)'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/integration.setup.js'],
    },
    {
      displayName: 'security',
      testEnvironment: 'node', 
      testMatch: ['<rootDir>/__tests__/security/**/*.(test|spec).(js|jsx|ts|tsx)'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/security.setup.js'],
    }
  ],
  
  moduleNameMapping: {
    // Handle module aliases (if you use them in your tsconfig.json)
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/tests/(.*)$': '<rootDir>/tests/$1',
  },
  
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/tests/e2e/',
    '<rootDir>/tests/performance/',
  ],
  
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/app/**/layout.tsx',
    '!src/app/**/page.tsx',
    '!src/app/**/route.ts',
    '!src/**/index.ts',
    '!src/middleware.ts',
    '!src/scripts/**/*',
  ],
  
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    './src/components/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './src/libs/services/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageDirectory: 'coverage',
  
  testTimeout: 30000,
  
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  
  testMatch: [
    '<rootDir>/__tests__/**/*.(test|spec).(js|jsx|ts|tsx)',
    '<rootDir>/src/**/__tests__/**/*.(test|spec).(js|jsx|ts|tsx)',
    '<rootDir>/src/**/*.(test|spec).(js|jsx|ts|tsx)',
  ],
  
  // Handle Arabic text and RTL testing
  transformIgnorePatterns: [
    '/node_modules/(?!(tesseract.js|wavesurfer.js|recordrtc|@supabase|openai)/)',
  ],
  
  // Environment variables for testing
  setupFiles: ['<rootDir>/tests/setup/env.setup.js'],
  
  // Global test utilities
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
    },
    __DEV__: true,
    __TEST__: true,
  },

  // Mock specific modules
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/tests/(.*)$': '<rootDir>/tests/$1',
    '^next/navigation$': '<rootDir>/tests/mocks/next-navigation.js',
    '^next/router$': '<rootDir>/tests/mocks/next-router.js',
  },

  // Collect coverage from all relevant files
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/app/**/layout.tsx',
    '!src/app/**/page.tsx', 
    '!src/app/**/route.ts',
    '!src/**/index.ts',
    '!src/middleware.ts',
    '!src/scripts/**/*',
    '!**/*.stories.*',
    '!**/*.config.*',
  ],

  // Test result processors
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'test-results',
      outputName: 'jest-junit.xml',
      ancestorSeparator: ' › ',
      uniqueOutputName: 'false',
      suiteNameTemplate: '{filepath}',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}'
    }]
  ],

  // Snapshot serializers for better snapshot testing
  snapshotSerializers: ['@emotion/jest/serializer'],

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);