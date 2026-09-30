const fs = require('fs');
const path = require('path');
const vm = require('vm');

const htmlPath = path.join(__dirname, 'client', 'index.html');
const content = fs.readFileSync(htmlPath, 'utf8');

// Extract all inline script tags
const scriptMatches = [...content.matchAll(/<script>([\s\S]*?)<\/script>/gi)];
const mainScript = scriptMatches[scriptMatches.length - 1][1];

console.log('=== Simulating full script execution in vm ===');

// Create mock browser window & DOM environment
const mockWindow = {
  document: {
    createElement: (tag) => {
      const el = {
        style: {},
        classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
        appendChild: () => {},
        addEventListener: () => {},
        getContext: () => ({
          fillRect: () => {}, clearRect: () => {}, strokeRect: () => {}, getImageData: () => ({ data: [] }),
          putImageData: () => {}, createImageData: () => [], setTransform: () => {},
          drawImage: () => {}, save: () => {}, fillText: () => {}, restore: () => {},
          beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, closePath: () => {},
          stroke: () => {}, translate: () => {}, scale: () => {}, rotate: () => {},
          arc: () => {}, fill: () => {}, measureText: () => ({ width: 0 }),
          transform: () => {}, rect: () => {}, clip: () => {}
        }),
      };
      return el;
    },
    getElementById: (id) => {
      return {
        id,
        style: {},
        classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
        addEventListener: (evt, fn) => {
          console.log(`[DOM mock] Attached listener for event '${evt}' on #${id}`);
        },
        querySelectorAll: () => [],
        appendChild: () => {},
        setAttribute: () => {},
        getAttribute: () => null,
      };
    },
    querySelectorAll: (sel) => {
      console.log(`[DOM mock] querySelectorAll for: ${sel}`);
      return [{
        style: {},
        classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
        addEventListener: (evt, fn) => {
          console.log(`[DOM mock] Attached listener for '${evt}' on selector '${sel}'`);
        }
      }];
    },
    addEventListener: () => {},
  },
  navigator: { userAgent: 'Mozilla/5.0' },
  localStorage: {
    getItem: (k) => null,
    setItem: (k, v) => {},
  },
  innerWidth: 1920,
  innerHeight: 1080,
  devicePixelRatio: 1,
  addEventListener: () => {},
  removeEventListener: () => {},
  requestAnimationFrame: (fn) => 1,
  cancelAnimationFrame: () => {},
  AudioContext: class {
    createGain() { return { gain: { value: 1, setValueAtTime: () => {} }, connect: () => {} }; }
    createOscillator() { return { start: () => {}, stop: () => {}, connect: () => {} }; }
    createBufferSource() { return { start: () => {}, stop: () => {}, connect: () => {} }; }
  },
  THREE: {
    WebGLRenderer: class {
      constructor() {
        this.shadowMap = {};
      }
      setPixelRatio() {}
      setSize() {}
    },
    Scene: class { add() {} },
    PerspectiveCamera: class {
      constructor() { this.position = { set: () => {}, copy: () => {} }; }
      lookAt() {}
    },
    Color: class {},
    FogExp2: class {},
    AmbientLight: class {},
    DirectionalLight: class { constructor() { this.position = { set: () => {}, copy: () => {} }; this.shadow = { mapSize: { set: () => {} }, camera: {} }; } },
    HemisphereLight: class {},
    Vector3: class { constructor(x=0,y=0,z=0) { this.x=x; this.y=y; this.z=z; } set() { return this; } copy() { return this; } add() { return this; } sub() { return this; } normalize() { return this; } setScalar() { return this; } },
    MeshStandardMaterial: class {},
    MeshBasicMaterial: class {},
    BoxGeometry: class {},
    SphereGeometry: class {},
    CylinderGeometry: class {},
    ConeGeometry: class {},
    PlaneGeometry: class {},
    TorusGeometry: class {},
    DodecahedronGeometry: class {},
    RingGeometry: class {},
    ExtrudeGeometry: class { translate() {} },
    Shape: class { moveTo() {} lineTo() {} closePath() {} },
    Mesh: class { constructor() { this.position = { set: () => {}, copy: () => {} }; this.rotation = {}; this.scale = { set: () => {}, setScalar: () => {} }; } add() {} },
    Group: class { constructor() { this.position = { set: () => {}, copy: () => {} }; this.rotation = {}; this.scale = { set: () => {}, setScalar: () => {} }; this.children = []; } add() {} remove() {} },
    CanvasTexture: class { constructor() { this.wrapS = this.wrapT = 1; this.repeat = { set: () => {} }; } },
    RepeatWrapping: 1,
    DoubleSide: 2,
    PCFSoftShadowMap: 1,
    Clock: class { getDelta() { return 0.016; } }
  },
  io: () => ({ on: () => {}, emit: () => {} })
};

mockWindow.window = mockWindow;

const sandbox = vm.createContext(mockWindow);

try {
  vm.runInContext(mainScript, sandbox, { filename: 'client_index.js' });
  console.log('🎉 SUCCESS: Main Script executed cleanly to completion with zero runtime exceptions!');
} catch (err) {
  console.error('❌ Script execution CRASHED:', err.message);
  console.error(err.stack);
}
