import { defineConfig } from 'vite';
import { setupWebSocketServer } from './server/index.js';

function multiplayerPlugin() {
  return {
    name: 'multiplayer-ws-server',
    configureServer(server) {
      if (server.httpServer) {
        setupWebSocketServer(server.httpServer);
      }
    },
    configurePreviewServer(server) {
      if (server.httpServer) {
        setupWebSocketServer(server.httpServer);
      }
    }
  };
}

export default defineConfig({
  plugins: [multiplayerPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    allowedHosts: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': '*',
      'Access-Control-Allow-Headers': '*'
    }
  }
});
