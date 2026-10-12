import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://www.luxuryvillasbylacasaquecanta.com',
  output: 'static',
  adapter: vercel({ maxDuration: 60 }),
  trailingSlash: 'always',
});
