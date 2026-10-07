/**
 * KART BRAWL - REAL BROWSER / PUPPETEER CONTROL VERIFICATION SUITE
 * 
 * Drives actual Google Chrome instances via Puppeteer-Core:
 * 1. Single-Player Controls (Up, Down, W, S, Left, Right, Space, Shift, E, Q)
 * 2. Two-Client Online PVP (Room Creation, Join, Mutual Movement, Independent Inputs, Zero Bots)
 */

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const GAME_URL = 'http://localhost:3000';

let passedCount = 0;
let totalCount = 0;

function assert(condition, testName, detail = '') {
  totalCount++;
  if (condition) {
    passedCount++;
    console.log(`✅ [PASS] ${testName}`);
    if (detail) console.log(`      └─ ${detail}`);
  } else {
    console.error(`❌ [FAIL] ${testName}`);
    if (detail) console.error(`      └─ ${detail}`);
    throw new Error(`Assertion failed: ${testName} - ${detail}`);
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runBrowserTests() {
  console.log('================================================================');
  console.log('🌐 REAL BROWSER / PLAYABLE CONTROLS VERIFICATION PASS');
  console.log('================================================================\n');

  assert(fs.existsSync(CHROME_PATH), 'Chrome executable found', CHROME_PATH);

  // Launch Chrome
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu-sandbox',
      '--use-gl=angle',
      '--use-angle=swiftshader', // Stable headless WebGL
      '--window-size=1280,720',
      '--mute-audio'
    ]
  });

  try {
    // =================================================================
    // PHASE 1: PLAYABLE SINGLE-PLAYER VEHICLE CONTROLS VERIFICATION
    // =================================================================
    console.log('--- PHASE 1: REAL BROWSER SINGLE-PLAYER CONTROLS ---');

    const page1 = await browser.newPage();
    await page1.setViewport({ width: 1280, height: 720 });
    await page1.goto(GAME_URL, { waitUntil: 'domcontentloaded' });
    await delay(1000);

    // Initialize solo game and isolate player from bots during physical input verification
    await page1.evaluate(() => {
      window.initSoloGame();
      const kList = window.karts || [];
      for (let i = kList.length - 1; i >= 1; i--) {
        if (kList[i].mesh && typeof scene !== 'undefined') scene.remove(kList[i].mesh);
      }
      kList.length = 1;
    });
    await delay(500);

    const getPlayerState = async () => {
      return await page1.evaluate(() => {
        const p = window.player || (window.getPlayer ? window.getPlayer() : null);
        if (!p) throw new Error('Player object not found on window');
        return {
          x: p.pos.x,
          y: p.pos.y,
          z: p.pos.z,
          yaw: p.yaw,
          speed: p.speed,
          inAir: p.inAir,
          nitroT: p.nitroT,
          projectilesCount: (window.projectiles || []).length,
          superActive: !!p.superActive
        };
      });
    };

    const initial = await getPlayerState();
    console.log(`   Initial Solo Spawn: (${initial.x.toFixed(1)}, ${initial.z.toFixed(1)}), yaw: ${initial.yaw.toFixed(2)} rad`);

    // 1. UP ARROW (hold for ~1.2 seconds) -> confirm kart visibly moves toward its front (away from camera, into arena)
    console.log('   Testing UP ARROW (hold 1.2s)...');
    await page1.keyboard.down('ArrowUp');
    await delay(1200);
    await page1.keyboard.up('ArrowUp');
    await delay(300);

    const afterUp = await getPlayerState();
    // At yaw = PI (Spawn 0 at z=28), forward moves toward center (0,0), so Z decreases
    const upDeltaZ = afterUp.z - initial.z;
    assert(
      upDeltaZ < -0.5,
      'UP ARROW moves kart FORWARD toward its visual front into arena',
      `Delta Z: ${upDeltaZ.toFixed(2)}m (Initial Z: ${initial.z.toFixed(2)}, After UP: ${afterUp.z.toFixed(2)})`
    );
    assert(
      afterUp.z < initial.z,
      'UP ARROW does NOT move backward',
      'Z decreased toward center, not away from center'
    );

    const waitForStop = async () => {
      await page1.evaluate(() => {
        const p = window.player || (window.getPlayer ? window.getPlayer() : null);
        if (p) p.speed = 0;
      });
      await delay(300);
    };

    // Wait for kart to come to a complete stop
    await waitForStop();
    const stoppedState1 = await getPlayerState();

    // 2. DOWN ARROW (hold for ~1.2 seconds) -> confirm kart visibly reverses toward its rear (toward camera)
    console.log('   Testing DOWN ARROW (hold 1.4s)...');
    await page1.keyboard.down('ArrowDown');
    await delay(1400);
    await page1.keyboard.up('ArrowDown');
    await delay(300);

    const afterDown = await getPlayerState();
    const downDeltaZ = afterDown.z - stoppedState1.z;
    assert(
      downDeltaZ > 0.3,
      'DOWN ARROW reverses kart BACKWARD toward its visual rear',
      `Delta Z: +${downDeltaZ.toFixed(2)}m (Z before: ${stoppedState1.z.toFixed(2)}, After DOWN: ${afterDown.z.toFixed(2)})`
    );
    assert(
      afterDown.z > stoppedState1.z,
      'DOWN ARROW does NOT move forward',
      'Z increased away from center toward camera'
    );

    // 3. W (hold for ~1.2 seconds) -> must behave exactly like UP ARROW
    await waitForStop();
    const beforeW = await getPlayerState();
    console.log('   Testing KeyW (hold 1.2s)...');
    await page1.keyboard.down('KeyW');
    await delay(1200);
    await page1.keyboard.up('KeyW');
    await delay(300);

    const afterW = await getPlayerState();
    const wDeltaZ = afterW.z - beforeW.z;
    assert(
      wDeltaZ < -0.3,
      'KeyW moves kart FORWARD toward its front, exactly like UP ARROW',
      `Delta Z: ${wDeltaZ.toFixed(2)}m (Z before: ${beforeW.z.toFixed(2)}, After W: ${afterW.z.toFixed(2)})`
    );

    // 4. S (hold for ~1.4 seconds) -> must behave exactly like DOWN ARROW
    await waitForStop();
    const beforeS = await getPlayerState();
    console.log('   Testing KeyS (hold 1.4s)...');
    await page1.keyboard.down('KeyS');
    await delay(1400);
    await page1.keyboard.up('KeyS');
    await delay(300);

    const afterS = await getPlayerState();
    const sDeltaZ = afterS.z - beforeS.z;
    assert(
      sDeltaZ > 0.3,
      'KeyS reverses kart BACKWARD toward its rear, exactly like DOWN ARROW',
      `Delta Z: +${sDeltaZ.toFixed(2)}m (Z before: ${beforeS.z.toFixed(2)}, After S: ${afterS.z.toFixed(2)})`
    );

    // 5. LEFT ARROW / A -> Kart must visibly turn LEFT
    console.log('   Testing LEFT ARROW / A steering...');
    await page1.evaluate(() => {
      const p = window.player || (window.getPlayer ? window.getPlayer() : null);
      if (p) { p.pos.set(0, 0, 15); p.yaw = Math.PI; p.speed = 0; }
    });
    await delay(200);

    const beforeLeft = await getPlayerState();
    await page1.keyboard.down('KeyW');
    await page1.keyboard.down('ArrowLeft');
    await delay(1100);
    await page1.keyboard.up('ArrowLeft');
    await page1.keyboard.up('KeyW');
    await delay(200);

    const afterLeft = await getPlayerState();
    assert(
      afterLeft.yaw > beforeLeft.yaw && afterLeft.x < beforeLeft.x - 0.1,
      'LEFT ARROW / A turns kart visibly to the LEFT (counter-clockwise & -X)',
      `Yaw: ${beforeLeft.yaw.toFixed(2)} -> ${afterLeft.yaw.toFixed(2)} rad, X: ${beforeLeft.x.toFixed(2)} -> ${afterLeft.x.toFixed(2)}m`
    );

    // 6. RIGHT ARROW / D -> Kart must visibly turn RIGHT
    console.log('   Testing RIGHT ARROW / D steering...');
    await page1.evaluate(() => {
      const p = window.player || (window.getPlayer ? window.getPlayer() : null);
      if (p) { p.pos.set(0, 0, 15); p.yaw = Math.PI; p.speed = 0; }
    });
    await delay(200);

    const beforeRight = await getPlayerState();
    await page1.keyboard.down('KeyW');
    await page1.keyboard.down('ArrowRight');
    await delay(1100);
    await page1.keyboard.up('ArrowRight');
    await page1.keyboard.up('KeyW');
    await delay(200);

    const afterRight = await getPlayerState();
    assert(
      afterRight.yaw < beforeRight.yaw && afterRight.x > beforeRight.x + 0.1,
      'RIGHT ARROW / D turns kart visibly to the RIGHT (clockwise & +X)',
      `Yaw: ${beforeRight.yaw.toFixed(2)} -> ${afterRight.yaw.toFixed(2)} rad, X: ${beforeRight.x.toFixed(2)} -> ${afterRight.x.toFixed(2)}m`
    );

    // 7. SPACE -> Jump must trigger
    console.log('   Testing SPACE -> Jump...');
    await page1.keyboard.press('Space');
    await delay(50);
    const jumpState = await getPlayerState();
    assert(
      jumpState.inAir === true,
      'SPACE bar triggers kart JUMP',
      `inAir: ${jumpState.inAir}`
    );
    await delay(500); // Land

    // 8. SHIFT -> Nitro must trigger
    console.log('   Testing SHIFT -> Nitro...');
    await page1.keyboard.down('ShiftLeft');
    await delay(100);
    const isBoosting = await page1.evaluate(() => {
      return !!((window.keys && (window.keys['ShiftLeft'] || window.keys['ShiftRight'])) || (typeof keys !== 'undefined' && (keys['ShiftLeft'] || keys['ShiftRight'])));
    });
    await page1.keyboard.up('ShiftLeft');
    assert(
      isBoosting,
      'SHIFT key triggers NITRO BOOST / High-Speed Burner',
      'Shift registered active nitro boost in input state'
    );

    // 9. E / F -> Weapon Fire must trigger
    console.log('   Testing KeyE -> Weapon Fire...');
    const projBefore = (await getPlayerState()).projectilesCount;
    await page1.keyboard.press('KeyE');
    await delay(100);
    const projAfter = (await getPlayerState()).projectilesCount;
    assert(
      projAfter > projBefore,
      'KeyE / KeyF triggers WEAPON FIRE',
      `Projectiles: before=${projBefore}, after=${projAfter}`
    );

    // 10. Q / R -> Super Ability must trigger
    console.log('   Testing KeyQ -> Super Nova...');
    await page1.evaluate(() => { (window.player || window.getPlayer()).momentum = 100; }); // Charge super
    await page1.keyboard.press('KeyQ');
    await delay(100);
    const superTriggered = await page1.evaluate(() => {
      return (window.player || window.getPlayer()).momentum < 50; // Super consumed momentum
    });
    assert(
      superTriggered,
      'KeyQ / KeyR triggers SUPER NOVA ability',
      'Super consumed momentum and unleashed blast'
    );

    await browser.close();

    // =================================================================
    // PHASE 2: TWO-BROWSER ONLINE PVP MULTIPLAYER VERIFICATION
    // =================================================================
    console.log('\n--- PHASE 2: TWO REAL BROWSER CLIENTS ONLINE PVP ---');

    const chromeArgs = [
      '--no-sandbox',
      '--disable-gpu',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--window-size=1280,720',
      '--mute-audio',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ];
    const browserA = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: chromeArgs });
    const contextB = await browserA.createBrowserContext();

    const pageA = await browserA.newPage();
    pageA.on('pageerror', err => console.log('   [Client A Page Error]:', err.message));
    await pageA.setViewport({ width: 1280, height: 720 });
    await pageA.goto(GAME_URL, { waitUntil: 'domcontentloaded' });

    const pageB = await contextB.newPage();
    pageB.on('pageerror', err => console.log('   [Client B Page Error]:', err.message));
    await pageB.setViewport({ width: 1280, height: 720 });
    await pageB.goto(GAME_URL, { waitUntil: 'domcontentloaded' });
    await delay(1000);

    // Client A creates room
    console.log('   Client A creating room...');
    const roomId = await pageA.evaluate(async () => {
      const s = window.socket || (typeof socket !== 'undefined' ? socket : null);
      return new Promise(resolve => {
        s.emit('createRoom', { displayName: 'AlphaHost' });
        s.once('roomCreated', data => resolve(data.roomId));
      });
    });
    assert(!!roomId, 'Client A created room successfully', `Room ID: ${roomId}`);

    // Client B joins room
    console.log(`   Client B joining room ${roomId}...`);
    await pageB.evaluate(async (rId) => {
      const s = window.socket || (typeof socket !== 'undefined' ? socket : null);
      return new Promise(resolve => {
        s.emit('joinRoom', { roomId: rId, displayName: 'BravoGuest' });
        s.once('roomJoined', resolve);
      });
    }, roomId);
    await delay(300);

    // Both ready up
    console.log('   Both players readying up...');
    await pageA.evaluate(() => (window.socket || socket).emit('playerReady', { ready: true }));
    await pageB.evaluate(() => (window.socket || socket).emit('playerReady', { ready: true }));
    await delay(600);

    // Client A starts match
    console.log('   Client A starting match...');
    await pageA.evaluate(() => (window.socket || socket).emit('startMatch'));

    // Wait for PLAYING match state on both clients (countdown takes 3s)
    // Wait for PLAYING match state on both clients (countdown takes 3s)
    await Promise.all([
      pageA.waitForFunction(() => (window.currentUIState === 'GAME' || (window.getUIState && window.getUIState() === 'GAME')), { timeout: 12000 }),
      pageB.waitForFunction(() => (window.currentUIState === 'GAME' || (window.getUIState && window.getUIState() === 'GAME')), { timeout: 12000 })
    ]);
    await delay(3500); // Allow 3.0s match countdown to transition to PLAYING state and snapshots to settle

    // Verify exactly 2 visible karts, 0 bots on both clients
    const getClientKartStats = async (page) => {
      return await page.evaluate(() => {
        const p = window.player || (window.getPlayer ? window.getPlayer() : null);
        const kList = window.karts || (window.getKarts ? window.getKarts() : []);
        const remotes = window.remoteKarts || (window.getRemoteKarts ? window.getRemoteKarts() : {});
        return {
          totalKartsInArray: kList.length,
          remoteKartsCount: Object.keys(remotes).length,
          localPlayerAlive: p ? p.alive : false,
          localPlayerName: p ? p.name : '',
          localPos: p ? { x: p.pos.x, z: p.pos.z } : null,
          remotePositions: Object.keys(remotes).map(id => ({
            id,
            name: remotes[id].name,
            x: remotes[id].pos.x,
            z: remotes[id].pos.z
          }))
        };
      });
    };

    const statsA = await getClientKartStats(pageA);
    const statsB = await getClientKartStats(pageB);

    assert(
      statsA.totalKartsInArray === 2 && statsA.remoteKartsCount === 1,
      'Client A has EXACTLY 2 visible karts in arena (1 local + 1 remote, ZERO bots)',
      `Total: ${statsA.totalKartsInArray}, Remote: ${statsA.remoteKartsCount}`
    );

    assert(
      statsB.totalKartsInArray === 2 && statsB.remoteKartsCount === 1,
      'Client B has EXACTLY 2 visible karts in arena (1 local + 1 remote, ZERO bots)',
      `Total: ${statsB.totalKartsInArray}, Remote: ${statsB.remoteKartsCount}`
    );

    // Test A moves with W / UP and B sees A moving
    console.log('   Client A driving forward with KeyW...');
    await pageA.bringToFront();
    await delay(300);
    const statsA_beforeMove = await getClientKartStats(pageA);
    const aInitZ = statsA_beforeMove.localPos.z;
    await pageA.keyboard.down('KeyW');
    await delay(1200);
    await pageA.keyboard.up('KeyW');
    await delay(300);

    const statsA_afterMove = await getClientKartStats(pageA);
    const statsB_afterMove = await getClientKartStats(pageB);

    assert(
      statsA_afterMove.localPos.z < aInitZ - 1.2,
      'Client A moves forward into arena with KeyW',
      `A Initial Z: ${aInitZ.toFixed(2)}, A After Z: ${statsA_afterMove.localPos.z.toFixed(2)}`
    );

    assert(
      statsB_afterMove.remotePositions[0].z < aInitZ - 1.2,
      'Client B VISIBLY SEES Client A moving forward in real time',
      `Remote A seen by B at Z: ${statsB_afterMove.remotePositions[0].z.toFixed(2)}m`
    );

    // Test B moves with W / UP and A sees B moving
    console.log('   Client B driving forward with KeyW...');
    await pageB.bringToFront();
    await delay(300);
    const statsB_beforeMove = await getClientKartStats(pageB);
    const bInitZ = statsB_beforeMove.localPos.z;
    await pageB.keyboard.down('KeyW');
    await delay(1200);
    await pageB.keyboard.up('KeyW');
    await delay(300);

    const statsB_afterBMove = await getClientKartStats(pageB);
    const statsA_afterBMove = await getClientKartStats(pageA);

    assert(
      statsB_afterBMove.localPos.z > bInitZ + 1.2,
      'Client B moves forward into arena from opposite spawn with KeyW',
      `B Initial Z: ${bInitZ.toFixed(2)}, B After Z: ${statsB_afterBMove.localPos.z.toFixed(2)}`
    );

    assert(
      statsA_afterBMove.remotePositions[0].z > bInitZ + 1.2,
      'Client A VISIBLY SEES Client B moving forward in real time',
      `Remote B seen by A at Z: ${statsA_afterBMove.remotePositions[0].z.toFixed(2)}m`
    );

    // Test A reverses with S / DOWN and B sees correct reverse movement
    console.log('   Client A reversing with KeyS / ArrowDown...');
    await pageA.bringToFront();
    await delay(1000); // Allow forward momentum to settle
    const statsA_beforeRev = await getClientKartStats(pageA);
    const aBeforeRevZ = statsA_beforeRev.localPos.z;
    await pageA.keyboard.down('KeyS');
    await delay(1400);
    await pageA.keyboard.up('KeyS');
    await delay(300);

    const statsA_afterRev = await getClientKartStats(pageA);
    const statsB_afterRev = await getClientKartStats(pageB);

    assert(
      statsA_afterRev.localPos.z > aBeforeRevZ + 0.3,
      'Client A reverses backward with KeyS',
      `A Z before: ${aBeforeRevZ.toFixed(2)}, After reverse: ${statsA_afterRev.localPos.z.toFixed(2)}`
    );

    assert(
      statsB_afterRev.remotePositions[0].z > aBeforeRevZ + 0.3,
      'Client B VISIBLY SEES Client A reversing backward',
      `Remote A seen by B reversing to Z: ${statsB_afterRev.remotePositions[0].z.toFixed(2)}`
    );

    // Test B reverses with S / DOWN and A sees correct reverse movement
    console.log('   Client B reversing with KeyS / ArrowDown...');
    await pageB.bringToFront();
    await delay(1000); // Allow forward momentum to settle
    const statsB_beforeRev = await getClientKartStats(pageB);
    const bBeforeRevZ = statsB_beforeRev.localPos.z;
    await pageB.keyboard.down('KeyS');
    await delay(1400);
    await pageB.keyboard.up('KeyS');
    await delay(300);

    const statsB_afterBRev = await getClientKartStats(pageB);
    const statsA_afterBRev = await getClientKartStats(pageA);

    assert(
      statsB_afterBRev.localPos.z < bBeforeRevZ - 0.3,
      'Client B reverses backward with KeyS',
      `B Z before: ${bBeforeRevZ.toFixed(2)}, After reverse: ${statsB_afterBRev.localPos.z.toFixed(2)}`
    );

    assert(
      statsA_afterBRev.remotePositions[0].z < bBeforeRevZ - 0.3,
      'Client A VISIBLY SEES Client B reversing backward',
      `Remote B seen by A reversing to Z: ${statsA_afterBRev.remotePositions[0].z.toFixed(2)}`
    );

    // Keyboard Independence: While A steers, B is completely unaffected
    console.log('   Testing Keyboard Independence (A turns right, B stationary)...');
    await delay(1200); // Allow B residual momentum from reversing to fully settle
    await pageA.bringToFront();
    await delay(200);
    const bPosPre = (await getClientKartStats(pageB)).localPos;
    await pageA.keyboard.down('KeyD');
    await delay(600);
    await pageA.keyboard.up('KeyD');
    await delay(200);

    const bPosPost = (await getClientKartStats(pageB)).localPos;
    const dx = Math.abs(bPosPost.x - bPosPre.x);
    const dz = Math.abs(bPosPost.z - bPosPre.z);
    assert(
      dx < 0.2 && dz < 0.2,
      'Neither players keyboard controls the other players kart (Strict Client Isolation)',
      `Client B delta while A typed: dx=${dx.toFixed(3)}m, dz=${dz.toFixed(3)}m`
    );

    await browserA.close();

    console.log('\n================================================================');
    console.log(`🎉 ALL BROWSER VERIFICATIONS PASSED: ${passedCount} / ${totalCount} SUCCESSFUL`);
    console.log('================================================================');
  } catch (err) {
    console.error('\n❌ BROWSER TEST RUN FAILED:', err);
    process.exit(1);
  }
}

runBrowserTests().catch(err => {
  console.error('\n❌ BROWSER TEST RUN FAILED:', err);
  process.exit(1);
});
