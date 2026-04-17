import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
	plugins: [react()],
	resolve: {
		extensions: ['.mts', '.ts', '.tsx', '.mjs', '.js', '.jsx', '.json'],
		alias: {
			'@shared': path.resolve(__dirname, '../shared'),
		},
	},
	server: {
		proxy: {
			'/api': {
				target: 'http://localhost:8080',
				changeOrigin: true,
			},
		},
	},
	test: {
		globals: true,
		environment: 'jsdom',
		setupFiles: ['./src/test-setup.ts'],
	},
});
