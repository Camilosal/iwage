import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
// Sitemap: generado dinámicamente en src/pages/sitemap.xml.ts (incluye
// contenido de Strapi); @astrojs/sitemap solo cubría rutas prerenderizadas.

// Carga .env en process.env para desarrollo local (en Docker, docker-compose provee las variables).
// No sobreescribe variables ya definidas en el entorno.
try { process.loadEnvFile('.env'); } catch { /* sin .env */ }

export default defineConfig({
  site: process.env.APP_URL || 'https://iwage.co',
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
  integrations: [
    react(),
  ],
  image: {
    remotePatterns: [
      { protocol: 'http', hostname: 'iwage_strapi', port: '1337' },
      { protocol: 'http', hostname: 'localhost', port: '1337' },
      { protocol: 'https', hostname: 'iwage.co' },
    ],
  },
  security: {
    checkOrigin: true,
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      host: true,
      allowedHosts: ['hub.iwage.co', 'iwage.co', 'www.iwage.co'],
      proxy: {
        // Proxy /admin to Strapi in development
        '/admin': {
          target: process.env.STRAPI_URL || 'http://localhost:1338',
          changeOrigin: true,
        },
        // Proxy /uploads to Strapi (media files)
        '/uploads': {
          target: process.env.STRAPI_URL || 'http://localhost:1338',
          changeOrigin: true,
        },
      },
    },
  },
});
