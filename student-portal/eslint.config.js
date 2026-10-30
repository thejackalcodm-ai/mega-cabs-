import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'src/types/database.ts'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Components must go through src/services; only the services layer may import the client.
      'no-restricted-imports': [
        'error',
        { paths: [{ name: '@/lib/supabase', message: 'Use a module in src/services instead.' }] },
      ],
    },
  },
  {
    files: ['src/services/**/*.ts', 'src/lib/supabase.ts', 'src/app/providers/**/*.tsx'],
    rules: { 'no-restricted-imports': 'off' },
  },
)
