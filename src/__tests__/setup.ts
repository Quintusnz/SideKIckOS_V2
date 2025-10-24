/**
 * Vitest setup file
 * Configure global test environment
 */

import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock environment variables for testing
Object.assign(process.env, {
  OPENAI_API_KEY: 'test-key-123',
  AI_MODEL: 'gpt-4-turbo',
  NODE_ENV: 'test',
});
