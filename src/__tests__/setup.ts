/**
 * Vitest setup file
 * Configure global test environment
 */

import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock environment variables for testing
process.env.OPENAI_API_KEY = 'test-key-123';
process.env.AI_MODEL = 'gpt-4-turbo';
process.env.NODE_ENV = 'test';
