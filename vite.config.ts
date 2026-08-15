/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * GitHub Pages serves this project from /show-floor/, so built asset URLs need
 * that prefix.
 *
 * Applied in every mode rather than only for `build`: `vite preview` is a
 * "serve" command, so a build-only base makes the preview server 404 on its own
 * assets and you cannot check the artifact you are about to ship. The cost is
 * that dev also lives at /show-floor/.
 */
export default defineConfig({
  base: '/show-floor/',
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
