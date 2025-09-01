/**
 * Jest Test Setup
 * Global configuration and utilities for all tests
 */

const fs = require('fs');
const path = require('path');

// Set test environment
process.env.NODE_ENV = 'test';

// Configure test data directory
const testDataDir = path.join(__dirname, 'data');
if (!fs.existsSync(testDataDir)) {
  fs.mkdirSync(testDataDir, { recursive: true });
}

// Global test utilities
global.testUtils = {
  // Clean up test data files
  cleanupTestData: (filename) => {
    const filePath = path.join(testDataDir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  },
  
  // Create test data file
  createTestData: (filename, data) => {
    const filePath = path.join(testDataDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return filePath;
  },
  
  // Wait for async operations
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Generate test todo
  createTestTodo: (overrides = {}) => ({
    id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    description: 'Test todo',
    completed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  })
};

// Global test constants
global.testConstants = {
  TEST_DATA_DIR: testDataDir,
  DEFAULT_TIMEOUT: 5000,
  E2E_TIMEOUT: 30000
};

// Console override for cleaner test output
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: process.env.VERBOSE_TESTS ? originalConsole.log : () => {},
  info: process.env.VERBOSE_TESTS ? originalConsole.info : () => {},
  warn: originalConsole.warn,
  error: originalConsole.error
};

// Global cleanup
afterAll(() => {
  // Clean up any remaining test data files
  if (fs.existsSync(testDataDir)) {
    const files = fs.readdirSync(testDataDir);
    files.forEach(file => {
      if (file.includes('test')) {
        fs.unlinkSync(path.join(testDataDir, file));
      }
    });
  }
});

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection in test:', reason);
  throw reason;
});

// Increase timeout for slower operations
jest.setTimeout(30000);