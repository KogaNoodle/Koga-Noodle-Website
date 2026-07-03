import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  site: process.env.SITE,
  base: process.env.BASE,
  prefetch: {
    prefetchAll: true,
  },
  compressHTML: true,
  vite: {
    server: {
      host: true,
    },
    build: {
      cssMinify: 'esbuild',
    },
  },
});
