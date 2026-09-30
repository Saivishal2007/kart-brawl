# KART BRAWL: Smash Karts Mega Arena

A high-octane 3D WebGL kart-brawler built with **Three.js**, **Express**, and **Socket.IO**.

- **GitHub Repository**: [https://github.com/Saivishal2007/kart-brawl](https://github.com/Saivishal2007/kart-brawl)
- **Live Public URL**: [https://d45e68b276b389.lhr.life](https://d45e68b276b389.lhr.life)
- **Public Health Endpoint**: [https://d45e68b276b389.lhr.life/health](https://d45e68b276b389.lhr.life/health)
- **Release Notes**: [RELEASE_NOTES.md](file:///C:/Users/msaiv/.gemini/antigravity/scratch/kart-brawl/RELEASE_NOTES.md)

---

## 🚀 Quick Start Instructions

### 1. Install Dependencies
Make sure Node.js (v16+) is installed, then run:
```bash
npm install
```

### 2. Start the Server
Start the Node.js + Socket.IO server locally:
```bash
npm start
# OR
node server/server.js
```

### 3. Open the Client & Play
Open your browser and navigate to:
```
http://localhost:3000
```
Open Developer Console (`F12`) to use room testing commands:
```javascript
// Create a new match room
createRoom("SpeedRacer");

// Join an existing match room
joinRoom("WCMFMY", "RivalKart");

// Toggle ready state
setReady(true);

// Host Start Match
startMatch();

// Leave room
leaveRoom();
```

---

## 🌐 Production Deployment Guide

KART BRAWL is fully prepared for zero-downtime, production container/PaaS cloud deployment.

### ⚙️ Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | Port for Express HTTP & Socket.IO server. Auto-detected on PaaS providers like Render, Railway, Heroku. |
| `NODE_ENV` | `development` | Set to `production` in live environments for optimized performance. |
| `CORS_ORIGIN` | `*` | Comma-separated list of allowed web domains (e.g. `https://kartbrawl.com,https://www.kartbrawl.com`). |

### 🩺 Health Check & Monitoring Endpoint

The server exposes a lightweight health check endpoint at `/health` for load balancers and uptime checkers (Render, AWS ALB, Cloud Run, UptimeRobot):

- **Endpoint**: `GET /health`
- **Response HTTP Code**: `200 OK`
- **Payload Example**:
```json
{
  "status": "ok",
  "timestamp": "2026-09-17T22:15:00.000Z",
  "uptime": 1420,
  "connections": 4,
  "rooms": 1
}
```

### 🛡️ Production Security & Signal Handling

- **Security Headers**: Includes `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, and `X-XSS-Protection: 1; mode=block`.
- **Graceful Shutdown**: Listens for `SIGTERM` and `SIGINT` signals, safely closing open sockets and stopping the HTTP server within a 5-second window before exiting.
- **WebSocket Transport**: Supports standard HTTP/HTTPS initial connection with automatic WebSocket (`wss://`) upgrade.

---

## ☁️ Cloud Deployment Platforms

### Option 1: Render (Recommended — Free & Easiest)
1. Fork or push your project repository to GitHub.
2. Log into [Render](https://render.com) and click **New +** -> **Web Service**.
3. Connect your repository and choose:
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Under **Environment Variables**, set:
   - `NODE_ENV`: `production`
5. Click **Create Web Service**. Your game will be live at `https://your-app-name.onrender.com`.

### Option 2: Railway
1. Log into [Railway](https://railway.app) and select **New Project** -> **Deploy from GitHub repo**.
2. Select `kart-brawl`. Railway automatically detects `package.json` and runs `npm start`.
3. Add domain under **Settings** -> **Networking** -> **Generate Domain**.

### Option 3: Fly.io
1. Install `flyctl` CLI and run `fly launch`.
2. Set Port to `3000` or let Fly use `$PORT`.
3. Run `fly deploy` to launch across global edge locations.

### Option 4: Google Cloud Run (Containerized)
1. Create a `Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8080
ENV PORT=8080
CMD ["npm", "start"]
```
2. Build & deploy to GCP:
```bash
gcloud run deploy kart-brawl --source . --region us-central1 --allow-unauthenticated
```

---

## 🏗️ Project Architecture

```
kart-brawl/
├── client/
│   └── index.html       # Three.js WebGL client, Socket.IO input sender, powerup & storm renderer & 60 FPS interpolator
├── server/
│   ├── server.js        # Express HTTP server, GET /health, security headers & Socket.IO router
│   ├── RoomManager.js   # Global room code generator, room registry & routing
│   └── GameRoom.js      # Authoritative 3D physics, combat, storm, powerups & events engine (30Hz tick simulation)
├── package.json         # Project manifest & dependencies
└── README.md            # Setup & architecture documentation
```

---

## 🏎️ Completed Features

- [x] **Step 1 — Core Socket Foundation**: Restructured repository into `client/` and `server/`, initialized Express & Socket.IO server on port 3000.
- [x] **Step 2 — Player Synchronization**: Added server state tracking, 6 predefined safe spawn locations, client input streaming, and 60 FPS remote kart interpolation.
- [x] **Step 3 — Room System & Isolation**: Created `RoomManager.js` and `GameRoom.js`, short 6-character room codes (`WCMFMY`), Socket.IO channel isolation (`io.to(roomId)`), capacity caps (6 players), and automatic host transfer.
- [x] **Step 4 — Authoritative 3D Physics Simulation**: Server authoritatively calculates player coordinates `(x, y, z)`, heading `yaw`, horizontal `speed`, vertical jump velocity `verticalVelocity`, gravity (`32 m/s²`), landing detection (`grounded`), nitro speed boost (`45 m/s`), and platform boundary constraints (`radius 72m`).
- [x] **Step 5 — Authoritative Multiplayer Combat Synchronization**: Server authoritatively validates weapon firing, tracks ammo and cooldowns, simulates projectile movement (Pea Blaster, Rocket, Triple Shot) and mine placement/detonation, calculates direct/splash hit distances, applies HP damage and knockback impulses, increments kills/deaths, manages 3-second respawns, and broadcasts room-isolated combat events (`weaponFired`, `playerDamaged`, `playerDied`, `playerRespawned`, `mineDetonated`).
- [x] **Step 6 — Powerups, Storm, Arena Events & Match State Synchronization**:
  - **Powerup Boxes**: 8 static spawn locations with 10s respawns, 2.5m pickup radius, 1-powerup capacity validation, broadcasting `powerupPickedUp` and `powerupRespawned`.
  - **Storm System**: Continuous server-authoritative safe zone radius shrinking (72m -> 15m) over round time, applying 5 HP/sec storm tick damage out of bounds.
  - **Arena Events**: Dynamic 30-second random event engine (Tornado Outbreak, Meteor Shower, Overcharge Turbo, Golden Rush) with server-calculated physical/damage effects.
  - **Match State & Results**: Full match state machine (`WAITING` -> `COUNTDOWN` -> `PLAYING` -> `FINISHED`), round timer, host start trigger, and final player standings with XP progression payouts.
- [x] **Step 7 — Production Deployment Preparation**: Added `/health` monitoring endpoint, configurable `CORS_ORIGIN`, process `PORT` fallback, HTTP security headers, `SIGTERM`/`SIGINT` graceful shutdown, and cloud deployment guides for Render, Railway, Fly.io, and Cloud Run.
- [x] **Anti-Cheat Enforcement**: Client claims regarding damage dealt, hit targets, ammo counts, cooldowns, or kills are rejected. The server is the sole combat authority.
- [x] **100% Single-Player & Bot Preservation**: Local player controls, Three.js WebGL renderer, 4 bot personalities, weapons, powerups, shrinking storm ring, arena events, progression system, and HUD remain fully functional.

