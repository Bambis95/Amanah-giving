import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { viteSourceLocator } from '@metagptx/vite-plugin-source-locator';
import { atoms } from '@metagptx/web-sdk/plugins';

// Link previews (WhatsApp, Facebook…) and search engines need absolute addresses: set VITE_SITE_URL
// (e.g. https://www.senjapo.sn) when building the site; without it those tags are left out.
// VITE_GOOGLE_SITE_VERIFICATION: the code Google Search Console gives to prove the site is yours.
function socialPreview(): Plugin {
  const site = (process.env.VITE_SITE_URL || '').trim().replace(/\/+$/, '');
  const googleCode = (process.env.VITE_GOOGLE_SITE_VERIFICATION || '').trim();
  return {
    name: 'social-preview',
    transformIndexHtml() {
      const tags = [];
      if (googleCode) tags.push({ tag: 'meta', attrs: { name: 'google-site-verification', content: googleCode }, injectTo: 'head' as const });
      if (!/^https?:\/\//.test(site)) return tags;
      const meta = (property: string, content: string) => ({ tag: 'meta', attrs: { property, content }, injectTo: 'head' as const });
      tags.push(meta('og:url', `${site}/`), meta('og:image', `${site}/og-image.jpg`));
      tags.push({ tag: 'link', attrs: { rel: 'canonical', href: `${site}/` }, injectTo: 'head' as const });
      // Who runs the site, for search engines (knowledge panel, logo in results)
      const organization = {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'NGO',
            '@id': `${site}/#organisation`,
            name: 'SENJAPO',
            alternateName: 'Plateforme Nationale de Collecte, de Solidarité et de Développement',
            url: `${site}/`,
            logo: `${site}/logo-senjapo.jpg`,
            image: `${site}/og-image.jpg`,
            description: 'Plateforme nationale de dons en ligne (Wave, Orange Money, carte) pour des projets solidaires vérifiés au Sénégal, et cahier numérique des tontines et mbootaay.',
            email: 'ccecce035@gmail.com',
            telephone: '+221785718281',
            areaServed: { '@type': 'Country', name: 'Sénégal' },
            address: { '@type': 'PostalAddress', addressLocality: 'Thiès', addressCountry: 'SN' },
            parentOrganization: { '@type': 'Organization', name: 'Club des Créateurs et Entrepreneurs du Sénégal (CCES)' },
          },
          {
            '@type': 'WebSite',
            '@id': `${site}/#site`,
            url: `${site}/`,
            name: 'SENJAPO',
            inLanguage: ['fr', 'wo', 'en', 'ar'],
            publisher: { '@id': `${site}/#organisation` },
          },
        ],
      };
      tags.push({ tag: 'script', attrs: { type: 'application/ld+json' }, children: JSON.stringify(organization), injectTo: 'head' as const });
      return tags;
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    socialPreview(),
    viteSourceLocator({
      prefix: 'mgx', // 前缀用于标识源代码位置，不能修改
    }),
    react(),
    atoms(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0', // 监听所有网络接口
    port: parseInt(process.env.VITE_PORT || '3000'),
    proxy: {
      // The site calls the API on its own origin (/api), so the httpOnly session cookie is first-party.
      // 127.0.0.1 rather than localhost: Node may resolve localhost to IPv6, where the backend doesn't listen.
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
    watch: { usePolling: true, interval: 600 },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom'],
          'router-vendor': ['react-router-dom'],
          'ui-vendor': [
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-aspect-ratio',
            '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-collapsible',
            '@radix-ui/react-context-menu',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-hover-card',
            '@radix-ui/react-label',
            '@radix-ui/react-menubar',
            '@radix-ui/react-navigation-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-progress',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-slider',
            '@radix-ui/react-slot',
            '@radix-ui/react-switch',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-toggle',
            '@radix-ui/react-toggle-group',
            '@radix-ui/react-tooltip',
          ],
          'form-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'utils-vendor': [
            'axios',
            'clsx',
            'tailwind-merge',
            'class-variance-authority',
            'date-fns',
            'lucide-react',
          ],
          'query-vendor': ['@tanstack/react-query'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
}));
