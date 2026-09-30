const fs = require('fs');
const vm = require('vm');

let html = fs.readFileSync('client/index.html', 'utf8');

// Apply candidate fixes in memory:
// 1. Move window.SpectatorDirector = SpectatorDirector
html = html.replace(
  '/* ---------------- PHASE 6.8: ADVANCED SPECTATOR AUTO-DIRECTOR CAMERA ---------------- */\nwindow.SpectatorDirector = SpectatorDirector;\nconst SpectatorDirector = {',
  '/* ---------------- PHASE 6.8: ADVANCED SPECTATOR AUTO-DIRECTOR CAMERA ---------------- */\nconst SpectatorDirector = {'
);
html = html.replace(
  "targetInfoEl.textContent = `🎯 TRACKING: ${this.targetKart.name} [${this.targetKart.classData.name}] · HP: ${Math.ceil(this.targetKart.hp)}`;\n    }\n  }\n};",
  "targetInfoEl.textContent = `🎯 TRACKING: ${this.targetKart.name} [${this.targetKart.classData.name}] · HP: ${Math.ceil(this.targetKart.hp)}`;\n    }\n  }\n};\nwindow.SpectatorDirector = SpectatorDirector;"
);

// 2. Fix MAX_PARTICLES
html = html.replace(
  "let currentQuality = 'HIGH';\nfunction applyQualitySettings(quality) {",
  "let MAX_PARTICLES = 150;\nlet currentQuality = 'HIGH';\nfunction applyQualitySettings(quality) {"
);
html = html.replace(
  "/* ---------------- UNIFIED OBJECT-POOLED EFFECT SYSTEM (STEP 3.3) ---------------- */\nconst MAX_PARTICLES = 150;\nconst particlePool = [];",
  "/* ---------------- UNIFIED OBJECT-POOLED EFFECT SYSTEM (STEP 3.3) ---------------- */\nconst particlePool = [];"
);

// 3. Make renderGarageUI resilient to tabs
html = html.replace(
  "  } else if (tab === 'emotes') {\n    currentCategory = 'emote';\n    items = CosmeticsRegistry.emotes.map(e => ({ ...e, category: 'emote', portrait: e.icon }));\n  }",
  `  } else if (tab === 'skins') {
    currentCategory = 'skin';
    items = CosmeticsRegistry.skins.map(s => ({ ...s, category: 'skin', portrait: s.icon }));
  } else if (tab === 'wheels') {
    currentCategory = 'wheels';
    items = CosmeticsRegistry.wheels.map(w => ({ ...w, category: 'wheels', portrait: w.icon }));
  } else if (tab === 'trails') {
    currentCategory = 'trail';
    items = CosmeticsRegistry.trails.map(t => ({ ...t, category: 'trail', portrait: t.icon }));
  } else if (tab === 'emotes') {
    currentCategory = 'emote';
    items = CosmeticsRegistry.emotes.map(e => ({ ...e, category: 'emote', portrait: e.icon }));
  } else {
    currentCategory = 'character';
    items = CharacterRegistry.characters.map(c => ({ ...c, category: 'character' }));
  }`
);
html = html.replace(
  "  if (!previewState.selectedItem || previewState.tabChanged) {\n    previewState.selectedItem = items[0];\n    previewState.selectedCategory = items[0].category;\n    previewState.tabChanged = false;\n  }",
  "  if (items.length > 0 && (!previewState.selectedItem || previewState.tabChanged)) {\n    previewState.selectedItem = items[0];\n    previewState.selectedCategory = items[0].category;\n    previewState.tabChanged = false;\n  }"
);

// Extract Script 5
const regex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let scripts = [];
while ((match = regex.exec(html)) !== null) {
  scripts.push(match[1]);
}
let mainScript = scripts[4];

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
  console.log('PASS 1: Script loaded and executed to completion!');

  const tests = [
    ['MAIN_MENU state', () => mockWindow.setUIState('MAIN_MENU')],
    ['SOLO_SELECT state', () => mockWindow.setUIState('SOLO_SELECT')],
    ['GARAGE state', () => mockWindow.setUIState('GARAGE')],
    ['Switch tab to skins', () => mockWindow.switchGarageTab('skins')],
    ['Switch tab to wheels', () => mockWindow.switchGarageTab('wheels')],
    ['Switch tab to trails', () => mockWindow.switchGarageTab('trails')],
    ['Switch tab to emotes', () => mockWindow.switchGarageTab('emotes')],
    ['Equip garage item', () => mockWindow.equipGarageItem()],
    ['Close garage', () => mockWindow.closeGarage()],
    ['SETTINGS state', () => mockWindow.setUIState('SETTINGS')],
    ['Toggle quality setting', () => mockWindow.toggleSetting('Quality')],
    ['Toggle audio setting', () => mockWindow.toggleSetting('Audio')],
    ['Toggle sfx setting', () => mockWindow.toggleSetting('Sfx')],
    ['Toggle music setting', () => mockWindow.toggleSetting('Music')],
    ['Spectator toggle mode', () => mockWindow.spectatorToggleMode()],
    ['Spectator cycle +1', () => mockWindow.spectatorCycle(1)],
    ['Spectator cycle -1', () => mockWindow.spectatorCycle(-1)],
    ['Init Solo Game (Start Engine)', () => mockWindow.initSoloGame()]
  ];

  for (const [name, fn] of tests) {
    try {
      fn();
      console.log('PASS:', name);
    } catch (e) {
      console.error('FAIL:', name, e);
    }
  }

  console.log('ALL TESTS COMPLETED!');
} catch (err) {
  console.error('FATAL ERROR on load:', err);
}
