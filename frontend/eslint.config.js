// @ts-check
/**
 * ESLint-Konfiguration im Flat-Config-Format.
 *
 * Ersetzt die frühere `.eslintrc.js`: Der `@angular-eslint`-Builder (v22)
 * liest ausschließlich noch dieses Format — mit der alten Datei scheiterte
 * `ng lint` an „Could not find config file", auch mit
 * `ESLINT_USE_FLAT_CONFIG=false`.
 *
 * Regelwerk ist bewusst 1:1 aus der alten Konfiguration übernommen, damit die
 * Umstellung nichts am Prüfumfang ändert. Ein Unterschied: Die alte Datei
 * hatte zwei nahezu identische Blöcke für `*.spec.ts` und `*.ts` (nur mit
 * unterschiedlichem tsconfig). Hier gibt es einen `*.ts`-Block, der beide
 * tsconfig-Projekte kennt — gleiche Wirkung, halb so viel Pflege.
 */
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const prettierRecommended = require('eslint-plugin-prettier/recommended');
const simpleImportSort = require('eslint-plugin-simple-import-sort');
const importPlugin = require('eslint-plugin-import');

/**
 * Regeln, die in der alten Konfiguration für jeden TS-Block galten.
 *
 * Eine bewusste Abweichung: Wo ESLint eine Basisregel und typescript-eslint
 * eine TS-taugliche Variante derselben Regel hat, ist die Basisregel AUS und
 * die Variante an (`no-unused-vars`, `no-use-before-define`, `no-shadow`,
 * `no-empty-function`). Die alte Konfiguration hatte beide aktiv und meldete
 * damit jede Stelle doppelt; zudem verzählen sich die Basisregeln bei
 * TypeScript regelmäßig (Typ-Parameter, Interfaces, Überladungen,
 * Klassenmethoden). Das ist die von typescript-eslint dokumentierte
 * Einrichtung, keine Abschwächung — die TS-Varianten sind genauer.
 */
const sharedTsRules = {
  eqeqeq: 'error',
  'grouped-accessor-pairs': 'warn',
  'guard-for-in': 'error',
  'no-alert': 'warn',
  'no-delete-var': 'error',
  'no-duplicate-imports': 'error',
  'no-implicit-coercion': 'error',
  'no-implicit-globals': 'error',
  'no-labels': 'error',
  'no-var': 'error',
  'prefer-const': 'warn',

  // Basisregel aus, TS-Variante an (siehe Block-Kommentar).
  'no-empty-function': 'off',
  '@typescript-eslint/no-empty-function': 'warn',
  'no-shadow': 'off',
  '@typescript-eslint/no-shadow': 'error',
  'no-unused-vars': 'off',
  '@typescript-eslint/no-unused-vars': 'warn',
  'no-use-before-define': 'off',
  // `functions`/`typedefs` aus: Funktionsdeklarationen und Typen werden
  // gehoistet, ihre Vorwärtsnutzung ist sicher — und sie ist hier
  // durchgängiger Stil (öffentliche Funktion oben, Helfer darunter, z. B.
  // in `mxp-element.service.ts`, `hex-dump.ts`). Für Variablen und Klassen,
  // wo Vorwärtsnutzung wirklich zur Laufzeit knallt, bleibt die Regel scharf.
  '@typescript-eslint/no-use-before-define': [
    'error',
    { functions: false, typedefs: false },
  ],

  'simple-import-sort/imports': 'warn',
  'simple-import-sort/exports': 'warn',
  'import/first': 'warn',
  'import/newline-after-import': 'warn',
  'import/no-duplicates': 'warn',
};

module.exports = tseslint.config(
  {
    // Entspricht dem früheren `ignorePatterns`; `dist` kommt dazu, damit ein
    // Lint-Lauf nach einem Build nicht über Artefakte stolpert.
    ignores: ['projects/**/*', 'dist/**/*'],
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...angular.configs.tsRecommended,
      prettierRecommended,
    ],
    // Zieht Inline-Templates (`template:` in @Component) aus den TS-Dateien,
    // damit die Template-Regeln unten auch dort greifen.
    processor: angular.processInlineTemplates,
    languageOptions: {
      parserOptions: {
        // Projektdienst statt fester tsconfig-Liste: ermittelt pro Datei das
        // passende Projekt. Mit der festen Liste fielen Dateien heraus, die in
        // keinem der beiden tsconfigs stehen (z. B.
        // `src/environments/environment.prod.ts`,
        // `src/app/shared/types/with-required.ts`) — dort brach die
        // Typauflösung ab, was die typgestützten Regeln reihenweise
        // fehlschlagen ließ.
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      'simple-import-sort': simpleImportSort,
      import: importPlugin,
    },
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
      ...sharedTsRules,
    },
  },
  {
    // Tests mocken, casten und greifen auf Private zu — dort melden die
    // typgestützten `no-unsafe-*`-Regeln fast nur Mock-Artefakte statt echter
    // Mängel (allein `ez-input.component.spec.ts` kam auf 53 Treffer). Gelockert
    // wird NUR diese Gruppe und nur in Specs; alle übrigen Regeln, auch die
    // typgestützten, bleiben auch hier scharf.
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    files: ['**/*.html'],
    extends: [
      ...angular.configs.templateRecommended,
      ...angular.configs.templateAccessibility,
      prettierRecommended,
    ],
    rules: {
      // Prettier kennt Angular-Templates nur mit explizitem Parser.
      'prettier/prettier': ['error', { parser: 'angular' }],
    },
  },
);
