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
  // Auflösung von Importen, die vom Projektstamm aus geschrieben sind
  // (`src/...`). Seit dem Wegfall von `baseUrl` in der tsconfig (TypeScript 6
  // verwirft die Option) gibt es im Quellcode keinen solchen Import mehr;
  // der Eintrag bleibt als Netz für Alt-Importe in Specs.
  modulePaths: ['<rootDir>'],
};
