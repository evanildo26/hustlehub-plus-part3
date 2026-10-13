/**
 * ESLint (flat config) for the API - static code analysis run locally
 * (`npm run lint`) and in the CI pipeline, where any error fails the build.
 *
 *  - @eslint/js recommended: real bugs (undefined variables, unreachable
 *    code, duplicate keys, ...).
 *  - eslint-plugin-security: Node.js security smells (eval, child_process,
 *    non-literal require/fs paths/RegExp, timing-unsafe comparisons,
 *    object injection, ...).
 *  - eslint-plugin-n: Node-specific mistakes (deprecated APIs, missing
 *    modules, process.exit in library code...).
 */
const js = require('@eslint/js');
const security = require('eslint-plugin-security');
const n = require('eslint-plugin-n');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/**', 'coverage/**', 'postman/**', 'certs/**', 'src/logs/**'] },
  js.configs.recommended,
  security.configs.recommended,
  n.configs['flat/recommended-script'],
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: { ...globals.node } },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_|^next$|^req$|^res$', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-console': 'off', // The logger and CLI scripts print to the console on purpose.
      eqeqeq: ['error', 'always'],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      // Every security rule is an error, so a finding fails the pipeline until it is fixed or explicitly justified.
      ...Object.fromEntries(Object.keys(security.rules).map((r) => [`security/${r}`, 'error'])),
      'n/no-process-exit': 'off', // server.js and the scripts exit deliberately (fail fast on bad config).
    },
  },
  {
    files: ['**/*.mjs'],
    languageOptions: { sourceType: 'module' },
  },
  {
    files: ['tests/**/*.js', 'vitest.config.mjs', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node, ...globals.vitest } },
    rules: { 'n/no-unpublished-require': 'off', 'n/no-unpublished-import': 'off' }, // Dev-only files may use devDependencies.
  },
  {
    files: ['scripts/**/*.js'],
    rules: { 'n/no-unpublished-require': 'off' }, // Scripts may use dev dependencies (newman, selfsigned).
  },
];
