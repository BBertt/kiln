import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vue from '@astrojs/vue';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: process.env.KILN_SITE || 'http://localhost:4321',
  base: process.env.KILN_BASE || '/',
  output: 'static',
  trailingSlash: 'always',
  integrations: [react(), vue(), svelte()],
  devToolbar: { enabled: false },
  vite: { plugins: [tailwindcss()] },
});
