module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/index.js'
  ],
  coverageThreshold: {
    global: {
      branches: 5,
      functions: 5,
      lines: 10,
      statements: 10
    },
    './src/crypto/': {
      branches: 50,
      functions: 50,
      lines: 70,
      statements: 70
    }
  },
  coverageReporters: ['text', 'lcov', 'html', 'cobertura'],
  coverageDirectory: 'coverage',
  verbose: true,
  testTimeout: 10000,
  setupFilesAfterEnv: ['<rootDir>/__tests__/helpers/setup.js'],
  reporters: ['default'],
  // CI-specific configuration
  ...(process.env.CI && {
    ci: true,
    maxWorkers: 2,
    bail: 1
  })
};
