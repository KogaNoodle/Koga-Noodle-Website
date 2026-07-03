import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  site: process.env.SITE,
  base: process.env.BASE,
  devToolbar: {
    enabled: false
  },
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
