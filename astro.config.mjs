import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import tailwind from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://www.maxruchkin.org',
  output: 'server',
  adapter: vercel(),
  redirects: {
    '/ru/local_history/chebarkul-register-1760': '/ru/local_history/chebarkul-metrika-1760',
    '/ru/local_history/chebarkul-register-1771': '/ru/local_history/chebarkul-metrika-1771',
    '/ru/local_history/chebarkul-confession-1773': '/ru/local_history/chebarkul-ispoved-1773',
  },
  vite: {
    plugins: [tailwind()],
  },
  integrations: [
    sitemap()
  ],
});
