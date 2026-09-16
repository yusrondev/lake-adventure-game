// Server-side Room and State Synchronization Manager for Lake Adventure

const PLAYER_COLORS = [
  '#38bdf8', // Cyan Sky
  '#f59e0b', // Golden Amber
  '#10b981', // Emerald Green
  '#ec4899', // Vivid Pink
  '#8b5cf6', // Violet
  '#f97316', // Orange
  '#06b6d4', // Aqua
  '#eab308'  // Yellow
];

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous chars like I, O, 0, 1
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomCode -> Room
    this.playerToRoom = new Map(); // ws (or playerId) -> roomCode
  }

  createRoom(ws, playerName) {
    let roomCode = generateRoomCode();
    while (this.rooms.has(roomCode)) {
      roomCode = generateRoomCode();
    }

    const playerId = 'p_' + Math.random().toString(36).substring(2, 9);
    const playerColor = PLAYER_COLORS[0];

    const hostPlayer = {
      id: playerId,
      name: playerName || 'Player 1',
      color: playerColor,
      isHost: true,
      localPos: { x: 0, y: 0 },
      heading: 0,
      ws: ws
    };

    const room = {
      code: roomCode,
      hostId: playerId,
      players: new Map([[playerId, hostPlayer]]),
      gameState: 'LOBBY',
      worldSeed: Math.floor(Math.random() * 1000000) + 1,
      timeOfDay: 15.2,
      weatherState: 'CLEAR',
      boatState: {
        x: 0, y: 0, z: 0,
        speed: 0,
        heading: 0,
        roll: 0,
        pitch: 0,
        health: 100
      },
      lanternState: {
        isLanternOn: false,
        spotlightAngle: 0
      }
    };

    this.rooms.set(roomCode, room);
    this.playerToRoom.set(ws, roomCode);
    ws.playerId = playerId;
    ws.roomCode = roomCode;

    this.send(ws, {
      type: 'ROOM_CREATED',
      roomCode: roomCode,
      playerId: playerId,
      player: {
        id: playerId,
        name: hostPlayer.name,
        color: playerColor,
        isHost: true
      },
      players: this.getPlayerList(room)
    });

    console.log(`[RoomManager] Room created: ${roomCode} by ${hostPlayer.name} (${playerId})`);
    return room;
  }

  joinRoom(ws, roomCode, playerName) {
    const formattedCode = (roomCode || '').trim().toUpperCase();
    const room = this.rooms.get(formattedCode);

    if (!room) {
      this.send(ws, {
        type: 'ERROR',
        message: `Ruangan dengan kode "${formattedCode}" tidak ditemukan.`
      });
      return null;
    }

    if (room.gameState !== 'LOBBY') {
      this.send(ws, {
        type: 'ERROR',
        message: 'Permainan dalam ruangan ini sudah dimulai.'
      });
      return null;
    }

    if (room.players.size >= 8) {
      this.send(ws, {
        type: 'ERROR',
        message: 'Ruangan sudah penuh (maksimal 8 pemain).'
      });
      return null;
    }

    const playerId = 'p_' + Math.random().toString(36).substring(2, 9);
    const colorIndex = room.players.size % PLAYER_COLORS.length;
    const playerColor = PLAYER_COLORS[colorIndex];

    const newPlayer = {
      id: playerId,
      name: playerName || `Player ${room.players.size + 1}`,
      color: playerColor,
      isHost: false,
      localPos: { x: (Math.random() - 0.5) * 1.5, y: (Math.random() - 0.5) * 2.0 },
      heading: 0,
      ws: ws
    };

    room.players.set(playerId, newPlayer);
    this.playerToRoom.set(ws, formattedCode);
    ws.playerId = playerId;
    ws.roomCode = formattedCode;

    // Send success to the joining player
    this.send(ws, {
      type: 'ROOM_JOINED',
      roomCode: formattedCode,
      playerId: playerId,
      player: {
        id: playerId,
        name: newPlayer.name,
        color: playerColor,
        isHost: false
      },
      players: this.getPlayerList(room),
      worldSeed: room.worldSeed
    });

    // Broadcast new player to others in room
    this.broadcastToRoom(room, {
      type: 'PLAYER_JOINED',
      player: {
        id: playerId,
        name: newPlayer.name,
        color: playerColor,
        isHost: false
      },
      players: this.getPlayerList(room)
    }, playerId);

    console.log(`[RoomManager] ${newPlayer.name} (${playerId}) joined room: ${formattedCode}`);
    return room;
  }

  leaveRoom(ws) {
    const roomCode = ws.roomCode || this.playerToRoom.get(ws);
    if (!roomCode) return;

    const room = this.rooms.get(roomCode);
    if (!room) {
      this.playerToRoom.delete(ws);
      return;
    }

    const playerId = ws.playerId;
    const player = room.players.get(playerId);
    const playerName = player ? player.name : 'Unknown';

    room.players.delete(playerId);
    this.playerToRoom.delete(ws);

    console.log(`[RoomManager] ${playerName} (${playerId}) left room: ${roomCode}`);

    if (room.players.size === 0) {
      // Close empty room
      this.rooms.delete(roomCode);
      console.log(`[RoomManager] Room ${roomCode} deleted (no players left)`);
      return;
    }

    // If host left, migrate host to next player
    if (room.hostId === playerId) {
      const nextHost = room.players.values().next().value;
      if (nextHost) {
        nextHost.isHost = true;
        room.hostId = nextHost.id;
        console.log(`[RoomManager] Host migrated to ${nextHost.name} in room ${roomCode}`);
      }
    }

    // Broadcast player left
    this.broadcastToRoom(room, {
      type: 'PLAYER_LEFT',
      playerId: playerId,
      players: this.getPlayerList(room),
      newHostId: room.hostId
    });
  }

  startGame(ws) {
    const roomCode = ws.roomCode;
    const room = this.rooms.get(roomCode);
    if (!room) return;

    if (room.hostId !== ws.playerId) {
      this.send(ws, {
        type: 'ERROR',
        message: 'Hanya Host yang memiliki hak untuk memulai permainan.'
      });
      return;
    }

    room.gameState = 'PLAYING';

    this.broadcastToRoom(room, {
      type: 'GAME_START',
      worldSeed: room.worldSeed,
      timeOfDay: room.timeOfDay,
      weatherState: room.weatherState,
      boatState: room.boatState,
      players: this.getPlayerList(room)
    });

    console.log(`[RoomManager] Game started in room: ${roomCode} with seed ${room.worldSeed}`);
  }

  handlePlayerMove(ws, data) {
    const room = this.rooms.get(ws.roomCode);
    if (!room || room.gameState !== 'PLAYING') return;

    const player = room.players.get(ws.playerId);
    if (!player) return;

    player.localPos = data.localPos || player.localPos;
    player.heading = data.heading !== undefined ? data.heading : player.heading;

    // Broadcast to other players in room
    this.broadcastToRoom(room, {
      type: 'PLAYER_MOVED',
      playerId: ws.playerId,
      localPos: player.localPos,
      heading: player.heading
    }, ws.playerId);
  }

  handleBoatSync(ws, data) {
    const room = this.rooms.get(ws.roomCode);
    if (!room || room.gameState !== 'PLAYING') return;

    // Update server cached boat state
    if (data.boatState) {
      room.boatState = { ...room.boatState, ...data.boatState };
    }

    // Broadcast snapshot to all other players in room
    this.broadcastToRoom(room, {
      type: 'BOAT_SYNC',
      boatState: room.boatState,
      senderId: ws.playerId
    }, ws.playerId);
  }

  handleEnvironmentSync(ws, data) {
    const room = this.rooms.get(ws.roomCode);
    if (!room || room.gameState !== 'PLAYING') return;

    if (data.timeOfDay !== undefined) room.timeOfDay = data.timeOfDay;
    if (data.weatherState !== undefined) room.weatherState = data.weatherState;

    this.broadcastToRoom(room, {
      type: 'ENV_SYNC',
      timeOfDay: room.timeOfDay,
      weatherState: room.weatherState,
      weatherData: data.weatherData || null
    }, ws.playerId);
  }

  handleLanternSync(ws, data) {
    const room = this.rooms.get(ws.roomCode);
    if (!room) return;

    if (data.lanternState) {
      room.lanternState = { ...room.lanternState, ...data.lanternState };
    }

    this.broadcastToRoom(room, {
      type: 'LANTERN_SYNC',
      lanternState: room.lanternState,
      senderId: ws.playerId
    }, ws.playerId);
  }

  handleCollisionEvent(ws, data) {
    const room = this.rooms.get(ws.roomCode);
    if (!room) return;

    if (data.health !== undefined) {
      room.boatState.health = data.health;
    }

    this.broadcastToRoom(room, {
      type: 'COLLISION_EVENT',
      damage: data.damage || 0,
      health: room.boatState.health,
      bounceDir: data.bounceDir || 0,
      penetration: data.penetration || 0,
      impactSpeed: data.impactSpeed || 0
    });
  }

  handleGameOver(ws, data) {
    const room = this.rooms.get(ws.roomCode);
    if (!room) return;

    room.gameState = 'GAMEOVER';

    this.broadcastToRoom(room, {
      type: 'GAME_OVER',
      reason: data.reason || 'Perahu hancur.',
      distanceTraveled: data.distanceTraveled || 0
    });
  }

  getPlayerList(room) {
    const list = [];
    for (const p of room.players.values()) {
      list.push({
        id: p.id,
        name: p.name,
        color: p.color,
        isHost: p.isHost
      });
    }
    return list;
  }

  send(ws, message) {
    if (ws && ws.readyState === 1) { // OPEN
      ws.send(JSON.stringify(message));
    }
  }

  broadcastToRoom(room, message, excludePlayerId = null) {
    const payload = JSON.stringify(message);
    for (const [id, player] of room.players.entries()) {
      if (excludePlayerId && id === excludePlayerId) continue;
      if (player.ws && player.ws.readyState === 1) {
        player.ws.send(payload);
      }
    }
  }
}
