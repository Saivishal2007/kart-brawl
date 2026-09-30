const GameRoom = require('./GameRoom');

class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = {}; // roomId => GameRoom
    this.playerRoomMap = {}; // socketId => roomId
  }

  generateRoomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code;
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.rooms[code]);
    return code;
  }

  createRoom(socket, displayName, characterId) {
    // Leave current room if already in one
    this.leaveRoom(socket);

    const roomId = this.generateRoomId();
    const room = new GameRoom(roomId, this.io);
    this.rooms[roomId] = room;

    const result = room.addPlayer(socket, displayName, characterId);
    if (result.success) {
      this.playerRoomMap[socket.id] = roomId;
      socket.emit('roomCreated', {
        roomId: roomId,
        hostId: room.hostId,
        spawn: result.spawn
      });
      console.log(`[RoomManager] Created Room ${roomId} by host ${socket.id} (char: ${characterId || 'racer'})`);
    }
    return room;
  }

  joinRoom(socket, roomId, displayName, characterId) {
    if (!roomId) {
      socket.emit('roomNotFound', { message: 'Room ID is required.' });
      return null;
    }

    const cleanRoomId = String(roomId).trim().toUpperCase();
    const room = this.rooms[cleanRoomId];

    if (!room) {
      console.log(`[RoomManager] Join failed for ${socket.id}: Room ${cleanRoomId} not found.`);
      socket.emit('roomNotFound', { message: `Room '${cleanRoomId}' does not exist.` });
      return null;
    }

    if (room.status !== 'WAITING') {
      console.log(`[RoomManager] Join failed for ${socket.id}: Match in Room ${cleanRoomId} already started.`);
      socket.emit('gameAlreadyStarted', { message: `Match in room '${cleanRoomId}' has already started.` });
      return null;
    }

    if (Object.keys(room.players).length >= room.maximumPlayers) {
      console.log(`[RoomManager] Join failed for ${socket.id}: Room ${cleanRoomId} is full.`);
      socket.emit('roomFull', { message: `Room '${cleanRoomId}' is full (Max 6 human players).` });
      return null;
    }

    // Leave current room if in one
    this.leaveRoom(socket);

    const result = room.addPlayer(socket, displayName, characterId);
    if (result.success) {
      this.playerRoomMap[socket.id] = cleanRoomId;
      socket.emit('roomJoined', {
        roomId: cleanRoomId,
        hostId: room.hostId,
        spawn: result.spawn
      });
      console.log(`[RoomManager] Player ${socket.id} joined Room ${cleanRoomId} (char: ${characterId || 'racer'})`);
    }
    return room;
  }

  leaveRoom(socket) {
    const roomId = this.playerRoomMap[socket.id];
    if (!roomId) return;

    const room = this.rooms[roomId];
    if (room) {
      room.removePlayer(socket.id, socket);
      socket.emit('roomLeft', { roomId });

      if (Object.keys(room.players).length === 0) {
        room.stopTickLoop();
        delete this.rooms[roomId];
        console.log(`[RoomManager] Room ${roomId} destroyed (Empty).`);
      }
    }
    delete this.playerRoomMap[socket.id];
  }

  setPlayerReady(socket, ready) {
    const roomId = this.playerRoomMap[socket.id];
    if (!roomId) return;
    const room = this.rooms[roomId];
    if (room) {
      room.setPlayerReady(socket.id, ready);
    }
  }

  handlePlayerInput(socket, inputData) {
    const roomId = this.playerRoomMap[socket.id];
    if (!roomId) return;
    const room = this.rooms[roomId];
    if (room) {
      room.handlePlayerInput(socket.id, inputData);
    }
  }

  handleFireWeapon(socket, payload) {
    const roomId = this.playerRoomMap[socket.id];
    if (!roomId) return;
    const room = this.rooms[roomId];
    if (room) {
      room.handleFireWeapon(socket.id, payload);
    }
  }

  startMatch(socket) {
    const roomId = this.playerRoomMap[socket.id];
    if (!roomId) {
      socket.emit('startMatchFailed', { reason: 'You are not currently in a room.' });
      return false;
    }
    const room = this.rooms[roomId];
    if (room) {
      const success = room.startMatch(socket.id);
      if (!success) {
        let reason = 'Unable to start match.';
        const playerList = Object.values(room.players);
        if (socket.id !== room.hostId) {
          reason = 'Only the room host can start the match.';
        } else if (playerList.length < 2) {
          reason = 'At least 2 connected players are required to start a match.';
        } else if (!playerList.every(p => p.ready)) {
          reason = 'All players must be READY before starting the match.';
        }
        socket.emit('startMatchFailed', { reason });
      }
      return success;
    }
    return false;
  }

  getRoom(roomId) {
    return this.rooms[roomId ? String(roomId).trim().toUpperCase() : ''];
  }
}

module.exports = RoomManager;
