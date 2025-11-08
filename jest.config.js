module.exports = {
  // Use ts-jest for TypeScript
  preset: 'ts-jest',
  
  // Test environment
  testEnvironment: 'node',
  
  // Roots
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  
  // Test match patterns
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)'
  ],
  
  // Transform files with ts-jest
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  
  // Module paths (match tsconfig paths)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@connection/(.*)$': '<rootDir>/src/connection/$1',
    '^@simulator/(.*)$': '<rootDir>/src/simulator/$1',
    '^@game/(.*)$': '<rootDir>/src/game/$1',
    '^@api/(.*)$': '<rootDir>/src/api/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1'
  },
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}',
    '!src/types/**',
    '!src/index.ts'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // Coverage reporters
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov'
  ],
  
  // Coverage directory
  coverageDirectory: 'coverage',
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  
  // Global setup/teardown
  // globalSetup: '<rootDir>/tests/globalSetup.ts',
  // globalTeardown: '<rootDir>/tests/globalTeardown.ts',
  
  // Verbose output
  verbose: true,
  
  // Test timeout
  testTimeout: 10000,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks between tests
  restoreMocks: true,
  
  // Globals
  globals: {
    'ts-jest': {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }
  }
};