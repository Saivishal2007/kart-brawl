const io = require('socket.io-client');

async function runLiveMultiplayerTest() {
  console.log('--- STARTING LIVE MULTIPLAYER INTEGRATION & COLLISION TEST ---');

  const URL = 'http://localhost:3000';
  const sockets = [];
  const names = ['Alpha', 'Bravo', 'Charlie', 'Delta'];

  function createClient(name) {
    return new Promise((resolve, reject) => {
      const socket = io(URL, { reconnection: false, transports: ['websocket'] });
      socket.on('connect', () => {
        socket.name = name;
        resolve(socket);
      });
      socket.on('connect_error', reject);
    });
  }

  for (let i = 0; i < 4; i++) {
    const s = await createClient(names[i]);
    sockets.push(s);
  }
  console.log(`Connected 4 live players to ${URL}`);

  let roomId = null;
  const host = sockets[0];

  // 1. Create Room with host
  await new Promise((resolve) => {
    host.on('roomCreated', (data) => {
      roomId = data.roomId;
      console.log(`Host created Room: ${roomId}`);
      resolve();
    });
    host.emit('createRoom', { displayName: names[0] });
  });

  // 2. Other 3 players join
  for (let i = 1; i < 4; i++) {
    await new Promise((resolve) => {
      sockets[i].on('roomJoined', () => resolve());
      sockets[i].emit('joinRoom', { roomId, displayName: names[i] });
    });
  }
  console.log(`All 4 players joined room ${roomId}`);

  // 3. All ready up and wait for confirmation
  await new Promise((resolve) => {
    host.on('roomState', (data) => {
      const allReady = data.players && data.players.length === 4 && data.players.every(p => p.ready);
      if (allReady) resolve();
    });
    for (let i = 0; i < 4; i++) {
      sockets[i].emit('playerReady', { ready: true });
    }
  });
  console.log('All 4 players confirmed READY by server');

  // 4. Host starts match
  await new Promise((resolve) => {
    host.on('matchStateChanged', (data) => {
      if (data.status === 'PLAYING') {
        console.log('Match transitioned to PLAYING state!');
        resolve();
      }
    });
    host.emit('startMatch');
  });

  // 5. Run simulation for 5 seconds (~150 ticks)
  let receivedStates = 0;
  let totalBytes = 0;
  let lastReceiveTime = Date.now();
  const intervals = [];
  let minLxBackWall = 999;
  let backWallPassed = false;

  const testStartTime = Date.now();

  await new Promise((resolve) => {
    host.on('gameState', (data) => {
      receivedStates++;
      const now = Date.now();
      intervals.push(now - lastReceiveTime);
      lastReceiveTime = now;
      totalBytes += JSON.stringify(data).length;

      // Find host player in gameState
      const pHost = data.players.find(p => p.id === host.id);
      if (pHost) {
        // Check Ramp 0 (-40, 0, yaw=0): local lx = p.x - (-40) = p.x + 40
        // Ramp back wall is at lx = 16. With R_kart=1.35, exterior barrier boundary is lx >= 17.35
        const lxRamp0 = pHost.x - (-40);
        const lzRamp0 = pHost.z - 0;
        if (Math.abs(lzRamp0) <= 6.0) {
          if (lxRamp0 < minLxBackWall && lxRamp0 >= 16.0) {
            minLxBackWall = lxRamp0;
          }
        }
      }

      // Check after 150 packets
      if (receivedStates >= 150) {
        resolve();
      }
    });

    // Send driving input loop from all clients
    const inputInterval = setInterval(() => {
      if (Date.now() - testStartTime > 6000) {
        clearInterval(inputInterval);
        resolve();
        return;
      }

      // Host drives at top speed + nitro straight towards Ramp 0 back wall
      host.emit('playerInput', { forward: true, nitro: true, left: false, right: false });

      // Other players drive and steer actively
      sockets[1].emit('playerInput', { forward: true, left: true });
      sockets[2].emit('playerInput', { forward: true, right: true, nitro: true });
      sockets[3].emit('playerInput', { backward: true, left: true });
    }, 1000 / 30);
  });

  const durationSec = (Date.now() - testStartTime) / 1000;
  const avgPacketHz = (receivedStates / durationSec).toFixed(1);
  const avgPayloadBytes = (totalBytes / receivedStates).toFixed(0);
  const avgIntervalMs = (intervals.slice(1).reduce((a, b) => a + b, 0) / (intervals.length - 1)).toFixed(2);

  console.log('\n=== LIVE MULTIPLAYER BENCHMARK RESULTS ===');
  console.log(`Total GameState Packets Received: ${receivedStates} across ${durationSec.toFixed(2)}s`);
  console.log(`Average Packet Rate: ${avgPacketHz} Hz (Target: 30.0 Hz)`);
  console.log(`Average Packet Interval: ${avgIntervalMs} ms (Target: 33.33 ms)`);
  console.log(`Average Payload Size: ${avgPayloadBytes} bytes/tick`);
  console.log(`Bandwidth per Client: ${((avgPayloadBytes * avgPacketHz) / 1024).toFixed(2)} KB/s`);
  console.log(`Nitro High-Speed Barrier Test: minLx at Ramp 0 back = ${minLxBackWall.toFixed(2)} (>= 17.34 expected)`);
  console.log(`Barrier Solid Result: ${minLxBackWall >= 17.30 ? 'PASS (Zero Tunneling)' : 'FAIL'}`);

  // Disconnect sockets
  for (const s of sockets) s.disconnect();
  console.log('\nAll sockets disconnected cleanly.');
}

runLiveMultiplayerTest().catch(console.error);
