module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  // The billing SPA is tested with vitest (apps/billing/vitest.config.ts).
  testPathIgnorePatterns: ['/node_modules/', '/apps/billing/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
}
