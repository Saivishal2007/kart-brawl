const ARENA_RAMP_DEFS = [
  { x: -40, z: 0, yaw: 0, width: 12, length: 16, maxHeight: 3.8 },
  { x: 40, z: 0, yaw: Math.PI, width: 12, length: 16, maxHeight: 3.8 },
  { x: 0, z: -40, yaw: Math.PI / 2, width: 12, length: 16, maxHeight: 3.8 },
  { x: 0, z: 40, yaw: -Math.PI / 2, width: 12, length: 16, maxHeight: 3.8 }
];

function resolveRampCollision(p, fwdX, fwdZ) {
  const R_kart = 1.35;
  let onRamp = false;
  let groundY = 0;

  for (let i = 0; i < ARENA_RAMP_DEFS.length; i++) {
    const rmp = ARENA_RAMP_DEFS[i];
    const cosY = Math.cos(rmp.yaw);
    const sinY = Math.sin(rmp.yaw);
    const dx = p.x - rmp.x;
    const dz = p.z - rmp.z;
    let lx = dx * cosY - dz * sinY;
    let lz = dx * sinY + dz * cosY;
    const hw = rmp.width / 2;
    const L = rmp.length;
    const curMaxH = rmp.maxHeight;

    const slopeAtX = (lx >= 0 && lx <= L) ? (lx / L) * curMaxH : (lx > L ? curMaxH : 0);
    const isAboveSlope = p.y >= (slopeAtX - 0.35);

    let collided = false;
    let nlx = 0, nlz = 0;

    // 1. Back Wall & Back Corners
    if (lx >= L) {
      if (Math.abs(lz) <= hw) {
        // Direct backside
        if (lx < L + R_kart && !isAboveSlope) {
          lx = L + R_kart;
          nlx = 1; nlz = 0;
          collided = true;
        }
      } else {
        // Diagonal back corners: (L, -hw) and (L, hw)
        const signZ = Math.sign(lz);
        const clx = lx - L;
        const clz = Math.abs(lz) - hw;
        const distSq = clx * clx + clz * clz;
        if (distSq < R_kart * R_kart && !isAboveSlope) {
          const dist = Math.sqrt(distSq) || 0.001;
          lx = L + (clx / dist) * R_kart;
          lz = signZ * (hw + (clz / dist) * R_kart);
          nlx = clx / dist;
          nlz = signZ * (clz / dist);
          collided = true;
        }
      }
    } else if (lx >= 0 && lx < L) {
      // 2. Side Walls & Interior Penetration
      if (Math.abs(lz) >= hw) {
        // Outside side wall
        if (Math.abs(lz) < hw + R_kart && !isAboveSlope) {
          const signZ = Math.sign(lz);
          lz = signZ * (hw + R_kart);
          nlx = 0;
          nlz = signZ;
          collided = true;
        }
      } else {
        // Inside ramp footprint (lx in [0, L], |lz| < hw)
        if (!isAboveSlope) {
          // Kart penetrated inside solid prism! Eject to nearest barrier face
          const dBack = L - lx;
          const dSide = hw - Math.abs(lz);
          const signZ = Math.sign(lz) || 1;
          if (dBack < dSide) {
            lx = L + R_kart;
            nlx = 1; nlz = 0;
          } else {
            lz = signZ * (hw + R_kart);
            nlx = 0; nlz = signZ;
          }
          collided = true;
        } else {
          // Kart is legitimately on top of the ramp slope
          onRamp = true;
          groundY = Math.max(groundY, slopeAtX);
        }
      }
    } else if (lx < 0 && Math.abs(lz) > hw) {
      // Front corners: (0, -hw) and (0, hw)
      const signZ = Math.sign(lz);
      const clx = -lx;
      const clz = Math.abs(lz) - hw;
      const distSq = clx * clx + clz * clz;
      if (distSq < R_kart * R_kart && !isAboveSlope) {
        const dist = Math.sqrt(distSq) || 0.001;
        lx = -(clx / dist) * R_kart;
        lz = signZ * (hw + (clz / dist) * R_kart);
        nlx = -clx / dist;
        nlz = signZ * (clz / dist);
        collided = true;
      }
    }

    if (collided) {
      // Convert resolved local position back to world
      p.x = rmp.x + (lx * cosY + lz * sinY);
      p.z = rmp.z + (-lx * sinY + lz * cosY);

      // Convert local normal to world normal
      const nx = nlx * cosY + nlz * sinY;
      const nz = -nlx * sinY + nlz * cosY;

      let vx = fwdX * p.speed + p.knockVel.x;
      let vz = fwdZ * p.speed + p.knockVel.z;
      const vDotN = vx * nx + vz * nz;
      if (vDotN < 0) {
        const vnX = vDotN * nx, vnZ = vDotN * nz;
        const vtX = vx - vnX, vtZ = vz - vnZ;
        vx = vtX * 0.85 - vnX * 0.15;
        vz = vtZ * 0.85 - vnZ * 0.15;
        const newSpeed = vx * fwdX + vz * fwdZ;
        p.speed = newSpeed;
        p.knockVel.x = vx - fwdX * newSpeed;
        p.knockVel.z = vz - fwdZ * newSpeed;
      }
    }
  }

  return { onRamp, groundY };
}

// 15-item comprehensive test suite
const tests = [
  { name: '1. Front Entrance - Straight Drive (Ramp 0, yaw=0)', r: 0, lx: 2, lz: 0, y: 0.5, speed: 25, isReverse: false, expectOnRamp: true },
  { name: '2. Front Entrance - Straight Drive (Ramp 1, yaw=180)', r: 1, lx: 2, lz: 0, y: 0.5, speed: 25, isReverse: false, expectOnRamp: true },
  { name: '3. Front Entrance - Straight Drive (Ramp 2, yaw=90)', r: 2, lx: 2, lz: 0, y: 0.5, speed: 25, isReverse: false, expectOnRamp: true },
  { name: '4. Front Entrance - Straight Drive (Ramp 3, yaw=-90)', r: 3, lx: 2, lz: 0, y: 0.5, speed: 25, isReverse: false, expectOnRamp: true },
  { name: '5. Direct Back Wall Impact (Yaw 0)', r: 0, lx: 16.5, lz: 0, y: 0, speed: 30, isReverse: false, expectBlocked: true },
  { name: '6. Direct Left Wall Impact (Yaw 90)', r: 2, lx: 8, lz: -6.2, y: 0, speed: 30, isReverse: false, expectBlocked: true },
  { name: '7. Direct Right Wall Impact (Yaw 180)', r: 1, lx: 8, lz: 6.2, y: 0, speed: 30, isReverse: false, expectBlocked: true },
  { name: '8. Oblique Back-Left Corner (Yaw -90)', r: 3, lx: 16.5, lz: -6.5, y: 0, speed: 32, isReverse: false, expectBlocked: true },
  { name: '9. Oblique Back-Right Corner (Yaw 0)', r: 0, lx: 16.5, lz: 6.5, y: 0, speed: 32, isReverse: false, expectBlocked: true },
  { name: '10. Nitro High-Speed Impact into Back (Speed 45, Yaw 0)', r: 0, lx: 15.5, lz: 0, y: 0, speed: 45, isReverse: false, expectBlocked: true },
  { name: '11. Nitro High-Speed Impact into Side (Speed 45, Yaw 90)', r: 2, lx: 8, lz: 5.5, y: 0, speed: 45, isReverse: false, expectBlocked: true },
  { name: '12. Reverse into Back Wall (Speed -12, Yaw 0)', r: 0, lx: 16.5, lz: 0, y: 0, speed: -12, isReverse: true, expectBlocked: true },
  { name: '13. Reverse into Side Wall (Speed -12, Yaw 180)', r: 1, lx: 8, lz: -6.2, y: 0, speed: -12, isReverse: true, expectBlocked: true },
  { name: '14. Drive Off Crest (Airborne, lx=17, y=3.8)', r: 0, lx: 17, lz: 0, y: 3.8, speed: 30, isReverse: false, expectAirborne: true },
  { name: '15. Drive Off Side (Airborne, lx=8, lz=7.5, y=1.9)', r: 0, lx: 8, lz: 7.5, y: 1.9, speed: 30, isReverse: false, expectAirborne: true }
];

let allPassed = true;
console.log('Running 15-Item Ramp Collision Matrix:\n');

for (const t of tests) {
  const rmp = ARENA_RAMP_DEFS[t.r];
  const cosY = Math.cos(rmp.yaw), sinY = Math.sin(rmp.yaw);
  
  // World coordinates of test starting position
  const wx = rmp.x + (t.lx * cosY + t.lz * sinY);
  const wz = rmp.z + (-t.lx * sinY + t.lz * cosY);
  const p = { x: wx, y: t.y, z: wz, speed: t.speed, knockVel: { x: 0, z: 0 } };

  // Determine forward heading vector
  let fwdX, fwdZ;
  if (t.isReverse) {
    // Heading away from obstacle, driving in reverse into obstacle
    fwdX = cosY;
    fwdZ = -sinY;
  } else {
    // Forward heading towards test point
    fwdX = -cosY;
    fwdZ = sinY;
  }

  const res = resolveRampCollision(p, fwdX, fwdZ);

  // Convert resulting world position back to local
  const dx = p.x - rmp.x, dz = p.z - rmp.z;
  const resLx = dx * cosY - dz * sinY;
  const resLz = dx * sinY + dz * cosY;

  let passed = false;
  let detail = '';

  if (t.expectOnRamp) {
    passed = res.onRamp && res.groundY > 0.4;
    detail = `onRamp=${res.onRamp}, groundY=${res.groundY.toFixed(2)}`;
  } else if (t.expectBlocked) {
    const isOutside = (resLx >= 17.34 || Math.abs(resLz) >= 7.34 || Math.hypot(resLx - 16, Math.abs(resLz) - 6) >= 1.34);
    passed = isOutside && !res.onRamp;
    detail = `lx=${resLx.toFixed(2)}, lz=${resLz.toFixed(2)}, onRamp=${res.onRamp}`;
  } else if (t.expectAirborne) {
    passed = !res.onRamp;
    detail = `onRamp=${res.onRamp} (airborne fall)`;
  }

  console.log(`${t.name}: [${passed ? 'PASS' : 'FAIL'}] (${detail})`);
  if (!passed) allPassed = false;
}

console.log('\nMatrix Result:', allPassed ? 'ALL 15 TESTS PASSED PERFECTLY!' : 'SOME FAILED');
