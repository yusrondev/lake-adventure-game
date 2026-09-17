import { WebSocketServer } from 'ws';
import { RoomManager } from './RoomManager.js';

export function setupWebSocketServer(serverOrPort) {
  let wss;
  if (typeof serverOrPort === 'number') {
    wss = new WebSocketServer({ port: serverOrPort });
    console.log(`[Multiplayer] Standalone WebSocket server running on port ${serverOrPort}`);
  } else {
    wss = new WebSocketServer({ noServer: true });
    serverOrPort.on('upgrade', (request, socket, head) => {
      try {
        const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
        if (url.pathname === '/ws' || url.pathname.startsWith('/ws')) {
          wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
          });
        }
      } catch (err) {
        console.error('[Multiplayer] WebSocket upgrade error:', err);
      }
    });
    console.log(`[Multiplayer] WebSocket server attached to HTTP server on /ws (filtered upgrade)`);
  }

  const roomManager = new RoomManager();

  wss.on('connection', (ws) => {
    console.log('[Multiplayer] Client connected');

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        switch (data.type) {
          case 'CREATE_ROOM':
            roomManager.createRoom(ws, data.playerName);
            break;
          case 'JOIN_ROOM':
            roomManager.joinRoom(ws, data.roomCode, data.playerName);
            break;
          case 'LEAVE_ROOM':
            roomManager.leaveRoom(ws);
            break;
          case 'START_GAME':
            roomManager.startGame(ws);
            break;
          case 'PLAYER_MOVE':
            roomManager.handlePlayerMove(ws, data);
            break;
          case 'BOAT_SYNC':
            roomManager.handleBoatSync(ws, data);
            break;
          case 'ENV_SYNC':
            roomManager.handleEnvironmentSync(ws, data);
            break;
          case 'LANTERN_SYNC':
            roomManager.handleLanternSync(ws, data);
            break;
          case 'COLLISION_EVENT':
            roomManager.handleCollisionEvent(ws, data);
            break;
          case 'GAME_OVER':
            roomManager.handleGameOver(ws, data);
            break;
          default:
            console.warn('[Multiplayer] Unknown message type:', data.type);
        }
      } catch (err) {
        console.error('[Multiplayer] Failed to parse message:', err);
      }
    });

    ws.on('close', () => {
      roomManager.leaveRoom(ws);
    });

    ws.on('error', (err) => {
      console.error('[Multiplayer] Socket error:', err);
      roomManager.leaveRoom(ws);
    });
  });

  return { wss, roomManager };
}

// If executed directly from command line (node server/index.js)
if (process.argv[1] && process.argv[1].endsWith('index.js')) {
  const PORT = process.env.PORT || 3001;
  setupWebSocketServer(Number(PORT));
}
