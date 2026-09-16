// Client-side Network Manager for Lake Adventure Multiplayer

export class NetworkManager {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.roomCode = null;
    this.playerId = null;
    this.isHost = false;
    this.playerName = 'Player';
    this.playerColor = '#38bdf8';
    this.players = [];

    this.listeners = new Map();

    // Auto-detect WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.serverUrl = `${protocol}//${window.location.host}/ws`;
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const list = this.listeners.get(event).filter(cb => cb !== callback);
    this.listeners.set(event, list);
  }

  emit(event, data) {
    const list = this.listeners.get(event);
    if (list) {
      list.forEach(cb => {
        try {
          cb(data);
        } catch (e) {
          console.error(`[NetworkManager] Error in listener for ${event}:`, e);
        }
      });
    }
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.serverUrl);

        this.ws.onopen = () => {
          this.isConnected = true;
          console.log('[NetworkManager] Connected to multiplayer server:', this.serverUrl);
          this.emit('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (err) {
            console.error('[NetworkManager] Failed to parse incoming message:', err);
          }
        };

        this.ws.onclose = () => {
          this.isConnected = false;
          console.log('[NetworkManager] Disconnected from server');
          this.emit('disconnected');
        };

        this.ws.onerror = (err) => {
          console.warn('[NetworkManager] WebSocket error, trying fallback to port 3001...');
          // If connection to /ws fails, attempt fallback to localhost:3001
          if (!this.isConnected && !this.serverUrl.includes(':3001')) {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const fallbackUrl = `${protocol}//${window.location.hostname}:3001`;
            this.serverUrl = fallbackUrl;
            this.ws = new WebSocket(fallbackUrl);
            this.ws.onopen = () => {
              this.isConnected = true;
              console.log('[NetworkManager] Connected via fallback port 3001');
              this.emit('connected');
              resolve();
            };
            this.ws.onmessage = (ev) => {
              try {
                const data = JSON.parse(ev.data);
                this.handleMessage(data);
              } catch (e) { console.error(e); }
            };
            this.ws.onclose = () => {
              this.isConnected = false;
              this.emit('disconnected');
            };
            this.ws.onerror = (fErr) => {
              this.emit('error', 'Koneksi ke server gagal.');
              reject(fErr);
            };
            return;
          }
          this.emit('error', 'Koneksi ke server terputus.');
          reject(err);
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  handleMessage(data) {
    switch (data.type) {
      case 'ROOM_CREATED':
        this.roomCode = data.roomCode;
        this.playerId = data.playerId;
        this.isHost = true;
        this.playerColor = data.player.color;
        this.players = data.players || [];
        this.emit('room_created', data);
        break;

      case 'ROOM_JOINED':
        this.roomCode = data.roomCode;
        this.playerId = data.playerId;
        this.isHost = false;
        this.playerColor = data.player.color;
        this.players = data.players || [];
        this.emit('room_joined', data);
        break;

      case 'PLAYER_JOINED':
        this.players = data.players || this.players;
        this.emit('player_joined', data);
        break;

      case 'PLAYER_LEFT':
        this.players = data.players || this.players;
        if (data.newHostId && data.newHostId === this.playerId) {
          this.isHost = true;
        }
        this.emit('player_left', data);
        break;

      case 'GAME_START':
        this.players = data.players || this.players;
        this.emit('game_start', data);
        break;

      case 'PLAYER_MOVED':
        this.emit('player_moved', data);
        break;

      case 'BOAT_SYNC':
        this.emit('boat_sync', data);
        break;

      case 'ENV_SYNC':
        this.emit('env_sync', data);
        break;

      case 'LANTERN_SYNC':
        this.emit('lantern_sync', data);
        break;

      case 'COLLISION_EVENT':
        this.emit('collision_event', data);
        break;

      case 'GAME_OVER':
        this.emit('game_over', data);
        break;

      case 'ERROR':
        this.emit('error', data.message);
        break;

      default:
        this.emit('message', data);
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  createRoom(playerName) {
    this.playerName = playerName || 'Player 1';
    return this.connect().then(() => {
      this.send({
        type: 'CREATE_ROOM',
        playerName: this.playerName
      });
    });
  }

  joinRoom(roomCode, playerName) {
    this.playerName = playerName || 'Guest';
    return this.connect().then(() => {
      this.send({
        type: 'JOIN_ROOM',
        roomCode: roomCode,
        playerName: this.playerName
      });
    });
  }

  leaveRoom() {
    if (this.isConnected) {
      this.send({ type: 'LEAVE_ROOM' });
    }
    this.roomCode = null;
    this.playerId = null;
    this.isHost = false;
    this.players = [];
  }

  startGame() {
    if (this.isHost) {
      this.send({ type: 'START_GAME' });
    }
  }

  sendPlayerMove(localPos, heading) {
    this.send({
      type: 'PLAYER_MOVE',
      localPos: localPos,
      heading: heading
    });
  }

  sendBoatSync(boatState) {
    this.send({
      type: 'BOAT_SYNC',
      boatState: boatState
    });
  }

  sendEnvSync(timeOfDay, weatherState, weatherData = null) {
    this.send({
      type: 'ENV_SYNC',
      timeOfDay: timeOfDay,
      weatherState: weatherState,
      weatherData: weatherData
    });
  }

  sendLanternSync(isLanternOn, spotlightAngle) {
    this.send({
      type: 'LANTERN_SYNC',
      lanternState: {
        isLanternOn: isLanternOn,
        spotlightAngle: spotlightAngle
      }
    });
  }

  sendCollision(damage, health, bounceDir, penetration, impactSpeed) {
    this.send({
      type: 'COLLISION_EVENT',
      damage: damage,
      health: health,
      bounceDir: bounceDir,
      penetration: penetration,
      impactSpeed: impactSpeed
    });
  }

  sendGameOver(reason, distanceTraveled) {
    this.send({
      type: 'GAME_OVER',
      reason: reason,
      distanceTraveled: distanceTraveled
    });
  }
}
