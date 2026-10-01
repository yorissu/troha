
/**
 * Building the page (npm run build -> dist/) and trying it out (npm run dev).
 *
 * While developing, `npm run dev` serves the page with live reload and passes
 * /api on to troha-server (on port 8000 unless TROHA_SERVER says otherwise), as
 * Caddy does in production. TROHA_POLL=1 looks for changed files every moment
 * instead of waiting to be told (needed in Docker; see compose.dev.yml).
 */

import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
	plugins: [svelte()],
	build: {
		assetsDir: 'build', // the built scripts and styles (public/assets keeps the icons and fonts)
	},
	server: {
		port: 5173,
		watch: process.env.TROHA_POLL ? { usePolling: true, interval: 300 } : undefined,
		proxy: {
			// Keeps the Host header (as Caddy does): the server checks that changes come from the page's own site.
			'/api': { target: process.env.TROHA_SERVER ?? 'http://127.0.0.1:8000', changeOrigin: false },
		},
	},
});
