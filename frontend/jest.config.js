// jest.config.js
module.exports = {
  preset: 'jest-preset-angular',
  passWithNoTests: true,
  silent: true,
  // Mirror the `paths` mapping in tsconfig.json so specs can import via
  // the `@webmud3/frontend/...` alias just like production code does.
  moduleNameMapper: {
    '^@webmud3/frontend/(.*)$': '<rootDir>/src/app/$1',
  },
  // Match tsconfig's `baseUrl: "./"` so absolute-from-root imports like
  // `src/environments/environment` (used in transitively-loaded modules
  // such as ServerConfigService) resolve in tests too.
  modulePaths: ['<rootDir>'],
};
