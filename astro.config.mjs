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
  // Sin bloque `image`: con `strapiImage()` muerto (F1) no queda NINGUN consumidor de la
  // pipeline de imágenes de Astro. Medido sobre todo `src/**`: cero `astro:assets`, cero
  // `<Image`, cero `getImage()`. Los remotePatterns de aquí declaraban un allowlist de
  // hosts que nada pedía; los medios se pintan con la ruta relativa que devuelve
  // `mediaSrc()` y la resuelve nginx contra el mismo Strapi.
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
