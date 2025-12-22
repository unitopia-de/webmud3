module.exports = {
  roots: ["<rootDir>/src"],
  testMatch: [
    "**/__tests__/**/*.+(ts|tsx|js)",
    "**/?(*.)+(spec|test).+(ts|tsx|js)",
  ],
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        diagnostics: {
          ignoreCodes: [1343],
        },
        // We use jest in old-school CommonJS mode, so we need to tell ts-jest to
        // compile to CommonJS as well, otherwise we get errors about Jest not
        // being able to handle ES modules.
        tsconfig: "tsconfig.jest.json",
        astTransformers: {
          before: [
            {
              path: "ts-jest-mock-import-meta", // or, alternatively, 'ts-jest-mock-import-meta' directly, without node_modules.
              options: {
                metaObjectReplacement: () => ({
                  url: "https://www.dummy-url.com",
                }),
              },
            },
          ],
        },
      },
    ],
  },
  extensionsToTreatAsEsm: [".ts"],
  testEnvironment: "node",
  // Notwendig, damit die Dateiendung .js nicht an den Dateinamen angehängt wird
  moduleNameMapper: {
    "^(.+)\\.js$": "$1"
  },

};
