import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        proxy: {
            '/api/meter': {
                target: 'https://smartprepaidmeters.com',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/meter/, '/integration_api/v1/consumer'),
                secure: true,
            },
            '/api/neptune': {
                target: 'https://emsprepaidapi.neptuneenergia.com',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/neptune/, '/service.asmx'),
                secure: true,
            },
        },
    },
});
