// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    files: ['services/**/*.ts', 'lib/**/*.ts', 'features/**/*.ts', 'features/**/*.tsx', 'hooks/**/*.ts', 'ui/**/*.tsx'],
    ignores: ['**/__tests__/**'],
    rules: { '@typescript-eslint/no-explicit-any': 'error' },
  },
  {
    ignores: [
      '.expo/**',
      'android/**',
      'ios/**',
      '**/dist/**',
      'web-build/**',
    ],
  },
  {
    files: ['app/**/*.tsx', 'ui/**/*.tsx', 'features/**/*.tsx', 'hooks/**/*.ts', 'features/**/hooks/*.ts', 'features/care/use*.ts'],
    ignores: ['**/__tests__/**'],
    rules: {
      'no-restricted-imports': ['error', { paths: [
        { name: 'firebase/firestore', message: 'Keep database queries in a repository/service; import its typed API.' },
        { name: '@/services/firebase', message: 'Screens and hooks consume data services, not the database connection.' },
      ] }],
    },
  },
  {
    files: ['services/**/*.ts', 'lib/**/*.ts', 'features/**/api/*.ts'],
    ignores: ['**/__tests__/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: ['@/features/*/hooks/**', '@/features/*/screens/**', '@/features/*/components/**', '@/ui/**', '../hooks/**', '../screens/**', '../components/**'], message: 'Data modules must not depend on presentation modules. Shared models belong in the domain/data layer.' }] }],
    },
  },
  {
    files: ['lib/suggestions/wateringEngine.ts', 'lib/plants/plantRules.ts', 'features/plants/form/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { paths: ['react', 'react-native', 'firebase/firestore'], patterns: [{ group: ['@/services/**', '@/lib/weather/fetchWeather', '@/lib/weather/updateFirestore', '@/lib/logs/fetchLogsAndWeatherForRange'], message: 'Domain calculations and form conversion must stay independent of I/O.' }] }],
    },
  },
]);
