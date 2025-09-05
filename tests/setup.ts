import { beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { vi } from "vitest";

// Global test setup
beforeAll(() => {
  // Set up any global test environment
  console.log("Setting up test environment...");
});

afterAll(() => {
  // Clean up global test environment
  console.log("Cleaning up test environment...");
});

beforeEach(() => {
  // Reset mocks before each test
  vi.clearAllMocks();
});

afterEach(() => {
  // Clean up after each test
  vi.restoreAllMocks();
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to suppress console.log in tests
  // log: vi.fn(),
  // info: vi.fn(),
  // warn: vi.fn(),
  // error: vi.fn(),
};
