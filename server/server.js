const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const RoomManager = require('./RoomManager');

const app = express();
const server = http.createServer(app);

// Production CORS Configuration
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : "*";

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const startTime = Date.now();
const roomManager = new RoomManager(io);

// Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    connections: io.engine ? io.engine.clientsCount : 0,
    rooms: roomManager.rooms ? Object.keys(roomManager.rooms).length : 0
  });
});

// Serve static client files from client directory
app.use(express.static(path.join(__dirname, '../client')));

// Socket.IO Connection Handler
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Send initial welcome payload
  socket.emit('welcome', {
    playerId: socket.id,
    message: 'Welcome to Kart Brawl Server! Use createRoom or joinRoom to play.'
  });

  // 1. Create Room
  socket.on('createRoom', (data = {}) => {
    roomManager.createRoom(socket, data.displayName);
  });

  // 2. Join Room
  socket.on('joinRoom', (data = {}) => {
    roomManager.joinRoom(socket, data.roomId, data.displayName);
  });

  // 3. Leave Room
  socket.on('leaveRoom', () => {
    roomManager.leaveRoom(socket);
  });

  // 4. Player Ready Toggle
  socket.on('playerReady', (data = {}) => {
    roomManager.setPlayerReady(socket, data.ready);
  });

  // 5. Player Controls Input
  socket.on('playerInput', (inputData) => {
    roomManager.handlePlayerInput(socket, inputData);
  });

  // 6. Fire Weapon Intent
  socket.on('fireWeapon', (payload = {}) => {
    roomManager.handleFireWeapon(socket, payload);
  });

  // 7. Start Match (Host Only)
  socket.on('startMatch', () => {
    roomManager.startMatch(socket);
  });

  // 8. Handle Disconnection
  socket.on('disconnect', (reason) => {
    console.log(`Socket disconnected: ${socket.id} (${reason})`);
    roomManager.leaveRoom(socket);
  });
});

// Start Server
const runningServer = server.listen(PORT, () => {
  console.log(`🎮 Kart Brawl Server running on http://localhost:${PORT}`);
});

// Graceful Shutdown Handler
function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  runningServer.close(() => {
    console.log('HTTP server closed.');
    io.close(() => {
      console.log('Socket.IO connections closed.');
      process.exit(0);
    });
  });

  // Fallback timeout if connections won't close
  setTimeout(() => {
    console.error('Forced shutdown due to timeout.');
    process.exit(1);
  }, 5000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

