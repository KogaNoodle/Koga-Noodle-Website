import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  output: 'static',
  site: process.env.SITE ?? 'https://koga.gay',
  base: process.env.BASE,
  integrations: [sitemap()],
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
