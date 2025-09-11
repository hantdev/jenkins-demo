/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.js'],
  reporters: [
    'default',
    [ 'jest-junit', { outputDirectory: '.', outputName: 'junit.xml' } ]
  ],
  collectCoverageFrom: ['src/**/*.js']
};


