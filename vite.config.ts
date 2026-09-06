import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const { KOTOBA_HTTPS_HOST } = loadEnv(mode, process.cwd(), 'KOTOBA_');
  const allowedHosts = KOTOBA_HTTPS_HOST ? [KOTOBA_HTTPS_HOST] : [];
  return {
    plugins: [react()],
    // 相対URLにしてGitHub Pagesのリポジトリ配下にも配置できるようにする。
    base: './',
    server: { host: '0.0.0.0', port: 5173, strictPort: true, allowedHosts },
    preview: { host: '0.0.0.0', port: 4173, strictPort: true, allowedHosts },
  };
});
