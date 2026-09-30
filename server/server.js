const fs = require('fs');
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const RoomManager = require('./RoomManager');

// Automatically load root .env if present
const envFilePath = path.join(__dirname, '../.env');
if (fs.existsSync(envFilePath)) {
  try {
    const raw = fs.readFileSync(envFilePath, 'utf8');
    raw.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const k = trimmed.slice(0, eqIdx).trim();
          const v = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
          if (!process.env[k]) process.env[k] = v;
        }
      }
    });
  } catch (e) {
    console.warn('Could not read .env file:', e.message);
  }
}

const app = express();
const server = http.createServer(app);

// Production CORS Configuration
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : "*";

// Express CORS Middleware for REST Endpoints
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || allowedOrigins === '*' || (Array.isArray(allowedOrigins) && (allowedOrigins.includes(origin) || allowedOrigins.includes('*')))) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else if (Array.isArray(allowedOrigins) && origin) {
    if (allowedOrigins.some(o => origin === o || origin.startsWith(o))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
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

// Performance Profiler Metrics Endpoint
app.get('/metrics', (req, res) => {
  const roomsMetrics = {};
  if (roomManager.rooms) {
    for (const [id, room] of Object.entries(roomManager.rooms)) {
      roomsMetrics[id] = room.getPerfMetrics ? room.getPerfMetrics() : null;
    }
  }
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    connections: io.engine ? io.engine.clientsCount : 0,
    roomsCount: Object.keys(roomsMetrics).length,
    rooms: roomsMetrics
  });
});

// Public Configuration Endpoint (Supabase Browser-safe Publishable Key & URL only)
app.get('/api/config', (req, res) => {
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabasePublishableKey: publishableKey,
    // Provide backwards compatibility for existing clients
    supabaseAnonKey: publishableKey
  });
});

// Favicon Endpoint
app.get('/favicon.ico', (req, res) => res.status(204).end());

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
    roomManager.createRoom(socket, data.displayName, data.characterId);
  });

  // 2. Join Room
  socket.on('joinRoom', (data = {}) => {
    roomManager.joinRoom(socket, data.roomId, data.displayName, data.characterId);
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
const HOST = process.env.HOST || '0.0.0.0';
const runningServer = server.listen(PORT, HOST, () => {
  console.log(`🎮 Kart Brawl Server running on port ${PORT} (bind ${HOST}, env: ${process.env.NODE_ENV || 'development'})`);
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

