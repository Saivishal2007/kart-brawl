const fs = require('fs');
const vm = require('vm');

let html = fs.readFileSync('client/index.html', 'utf8');

const regex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let scripts = [];
while ((match = regex.exec(html)) !== null) {
  scripts.push(match[1]);
}
let mainScript = scripts[4];

// Replace SpectatorDirector
mainScript = mainScript.replace('window.SpectatorDirector = SpectatorDirector;\nconst SpectatorDirector = {', 'const SpectatorDirector = {');
const afterIdx = mainScript.indexOf('update(dt) {');
const closeIdx = mainScript.indexOf('\n};\n', afterIdx);
mainScript = mainScript.slice(0, closeIdx + 4) + '\nwindow.SpectatorDirector = SpectatorDirector;\n' + mainScript.slice(closeIdx + 4);

const makeDummy = () => new Proxy(function(){}, {
  get: (target, prop) => {
    if (prop === Symbol.toPrimitive || prop === 'toString') return () => '';
    return makeDummy();
  },
  apply: () => makeDummy(),
  construct: () => makeDummy(),
  set: () => true
});

const mockStorage = {};
const mockWindow = new Proxy({
  innerWidth: 1920,
  innerHeight: 1080,
  devicePixelRatio: 1,
  localStorage: {
    getItem: (k) => mockStorage[k] || null,
    setItem: (k, v) => { mockStorage[k] = v; },
    removeItem: (k) => { delete mockStorage[k]; }
  },
  addEventListener: () => {},
  removeEventListener: () => {},
  location: { reload: () => {} },
  requestAnimationFrame: () => {},
  cancelAnimationFrame: () => {}
}, {
  get: (target, prop) => {
    if (prop in target) return target[prop];
    if (prop === 'window') return mockWindow;
    return makeDummy();
  }
});

const mockEl = new Proxy({
  style: {},
  classList: { add: ()=>{}, remove: ()=>{}, contains: ()=>false, toggle: ()=>{} },
  addEventListener: ()=>{},
  removeEventListener: ()=>{},
  appendChild: ()=>{},
  removeChild: ()=>{},
  querySelector: ()=>null,
  querySelectorAll: ()=>[],
  getContext: ()=>makeDummy(),
  setAttribute: ()=>{},
  getAttribute: ()=>null,
  innerHTML: '',
  textContent: '',
  value: ''
}, {
  get: (target, prop) => (prop in target ? target[prop] : makeDummy())
});

const mockDocument = new Proxy({
  getElementById: (id) => mockEl,
  querySelector: (sel) => mockEl,
  querySelectorAll: (sel) => [mockEl],
  createElement: (tag) => mockEl,
  addEventListener: () => {},
  removeEventListener: () => {},
  body: mockEl,
  documentElement: mockEl
}, {
  get: (target, prop) => (prop in target ? target[prop] : makeDummy())
});

const mockTHREE = new Proxy({
  BasicShadowMap: 0,
  PCFSoftShadowMap: 1
}, {
  get: (target, prop) => {
    if (prop in target) return target[prop];
    return function() { return makeDummy(); };
  }
});

const context = {
  window: mockWindow,
  document: mockDocument,
  THREE: mockTHREE,
  io: () => makeDummy(),
  localStorage: mockWindow.localStorage,
  requestAnimationFrame: () => {},
  cancelAnimationFrame: () => {},
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval,
  Math: Math,
  Date: Date,
  JSON: JSON,
  Array: Array,
  Object: Object,
  String: String,
  Number: Number,
  Boolean: Boolean,
  RegExp: RegExp,
  Error: Error,
  TypeError: TypeError,
  ReferenceError: ReferenceError,
  parseInt: parseInt,
  parseFloat: parseFloat,
  isNaN: isNaN,
  isFinite: isFinite,
  encodeURIComponent: encodeURIComponent,
  decodeURIComponent: decodeURIComponent
};

try {
  vm.runInNewContext(mainScript, context);
  console.log('SUCCESS! Main script executed without errors in simulated environment.');
  
  // Expose applyQualitySettings to window if needed or test via window.toggleSetting
  console.log('Testing window.toggleSetting("quality"):');
  mockWindow.toggleSetting('quality');
  console.log('toggleSetting("quality") passed!');
} catch (err) {
  console.error('CAUGHT ERROR during execution:');
  console.error(err);
}
