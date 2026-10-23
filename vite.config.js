import { defineConfig } from 'vite';

// En GitHub Pages el sitio vive en /<nombre-del-repo>/; en local, en la raíz.
const base = process.env.GITHUB_PAGES_BASE || '/';

export default defineConfig({
  base,
  build: { outDir: 'dist', target: 'es2020' },
  test: { environment: 'node', include: ['tests/**/*.test.js'] },
});
