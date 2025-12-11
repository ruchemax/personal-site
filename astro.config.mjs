import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import tailwind from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://www.maxruchkin.org',
  output: 'server',
  adapter: vercel(),
  vite: {
    plugins: [tailwind()],
  },
  integrations: [
    sitemap()
  ],
});
