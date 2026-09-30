# 🎨 KART BRAWL 2.0 — UI/UX DESIGN SYSTEM & ARCHITECTURE

**Version**: `2.0.0-DS`  
**Core Theme**: `NEON ARCADE + FUTURISTIC STREET RACING + CHAOTIC CARTOON ENERGY`  
**Status**: `PHASE 6.1 ESTABLISHED & INTEGRATED`  

---

## 📌 Visual Identity & Philosophy

KART BRAWL 2.0 presents an energetic, competitive, and game-like arcade user interface. The visual language blends deep midnight-space backgrounds (`#060713`) with electric neon accents (Cyan, Magenta, Yellow, Lime), glassmorphic elevated panels, bold arcade typography, and responsive glowing interactive elements.

---

## 🎨 Token Architecture (`:root`)

Centralized CSS variables defined in `client/index.html`:

```css
:root {
  /* 1. COLOR TOKENS */
  --kb-color-cyan: #00f3ff;          /* Primary Neon Accent */
  --kb-color-magenta: #ff0055;       /* Secondary Accent / Danger */
  --kb-color-yellow: #ffe600;        /* Warning / Nitro / Room Code */
  --kb-color-lime: #00ff66;          /* Success / HP Bar / Ally */
  --kb-color-purple: #7000ff;        /* XP / Super Nova / Special */
  --kb-color-orange: #ff6a00;        /* Fire / Event Hazard */

  --kb-color-bg: #060713;            /* Deep Arcade Night Background */
  --kb-color-surface: rgba(14, 17, 38, 0.88);
  --kb-color-surface-elevated: rgba(24, 29, 64, 0.94);
  --kb-color-panel-header: rgba(30, 36, 75, 0.95);
  
  --kb-color-border: rgba(0, 243, 255, 0.35);
  --kb-color-border-glow: rgba(0, 243, 255, 0.85);

  --kb-color-text: #ffffff;
  --kb-color-text-muted: rgba(255, 255, 255, 0.68);

  /* 2. TYPOGRAPHY TOKENS */
  --kb-font-display: 'Impact', 'Teko', 'Arial Black', sans-serif;
  --kb-font-heading: 'Segoe UI', 'Roboto', 'Trebuchet MS', sans-serif;
  --kb-font-body: 'Segoe UI', Arial, sans-serif;

  /* 3. SPACING TOKENS */
  --kb-space-xs: 4px;
  --kb-space-sm: 8px;
  --kb-space-md: 16px;
  --kb-space-lg: 24px;
  --kb-space-xl: 32px;
  --kb-space-2xl: 48px;

  /* 4. RADIUS TOKENS */
  --kb-radius-sm: 6px;
  --kb-radius-md: 14px;
  --kb-radius-lg: 22px;
  --kb-radius-pill: 9999px;

  /* 5. SHADOWS & GLOWS */
  --kb-glow-cyan: 0 0 15px rgba(0, 243, 255, 0.6);
  --kb-glow-magenta: 0 0 15px rgba(255, 0, 85, 0.6);
  --kb-glow-yellow: 0 0 15px rgba(255, 230, 0, 0.6);
  --kb-glow-lime: 0 0 15px rgba(0, 255, 102, 0.6);
  --kb-shadow-panel: 0 12px 35px rgba(0, 0, 0, 0.7), inset 0 1px 1px rgba(255, 255, 255, 0.2);

  /* 6. ANIMATIONS */
  --kb-anim-fast: 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  --kb-anim-normal: 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  --kb-anim-bounce: 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

---

## 🧩 Component Library Reference (`.kb-*`)

### 1. Buttons
- `.kb-btn`: Base button styling with neon hover scale and active push down.
- `.kb-btn-primary`: Cyan-to-purple gradient with bright white border & cyan glow.
- `.kb-btn-danger`: Magenta-to-orange gradient with danger glow.
- `.kb-btn-secondary`: Dark surface button with subtle white border.
- `.kb-btn-icon`: Square icon button for mute, back, and settings toggles.

### 2. Panels & Cards
- `.kb-panel`: Blur backdrop glass panel with 2px cyan border.
- `.kb-card`: Elevated surface card with subtle hover translation.
- `.kb-stat-card`: Stat box displaying label & neon numerical metric.
- `.kb-player-card`: Multiplayer lobby player card with `.is-host` and `.is-ready` state indicators.

### 3. Indicators & Status
- `.kb-badge`: Neon pill tag for status labels.
- `.kb-badge-rank`: Arcade leaderboard rank badge.
- `.kb-code-display`: Dashed yellow border room code box with yellow glow.

### 4. Progress Bars
- `.kb-progress-bar`: Base container with inset inner shadow.
- `.kb-hp-bar`: Lime-to-cyan gradient HP fill.
- `.kb-nitro-bar`: Cyan-to-yellow gradient boost fill.
- `.kb-xp-bar`: Purple-to-magenta gradient XP fill.

### 5. Controls & Feedback
- `.kb-toggle`: Pill switch toggle (`.active` state shifts thumb and lights up lime).
- `.kb-tab`: Tab navigation button with cyan bottom indicator line.
- `.kb-modal`: Fixed full-screen modal overlay with bounce pop-in animation (`.active`).
- `.kb-toast`: Toast notification popping in from bottom-right.

---

## 🌌 Atmosphere Background Layer System (`#kb-bg-layer`)

The background system runs on `#kb-bg-layer` positioned behind all menu UI screens (`z-index: 55`):
- **Perspective Grid (`#kb-bg-grid`)**: Animated CSS perspective grid sliding endlessly at 60 FPS.
- **Radial Vignette (`#kb-bg-vignette`)**: Deep dark corner shading for high text contrast.
- **Performance**: Runs on hardware-accelerated CSS transforms (`transform: perspective(...) rotateX(...) translateY(...)`). Zero CPU load on Three.js WebGL canvas during gameplay.

---

## 🧠 UI State Architecture (`UIManager`)

Client UI state is managed by the global `UIManager` JavaScript object, keeping screen routing 100% decoupled from server-authoritative multiplayer gameplay state:

```javascript
UIManager.switchScreen('onlineMenu'); // Transitions seamlessly to Online Menu
UIManager.showToast('Room Code Copied!', 'success');
UIManager.showModal('garageModal');
```

### Managed Screen Routes:
- `mainMenu` (`mainMenuView`)
- `onlineMenu` (`onlineMenuView`)
- `createRoom` (`createRoomView`)
- `joinRoom` (`joinRoomView`)
- `lobby` (`lobbyPreviewView`)
- `soloSelect` (`soloSelectView`)
- `settings` (`settingsView`)
- `countdown` (`countdownOverlay`)
- `game` (`hud`)
- `results` (`overlay`)
- `death` (`deathScreen`)

---

## ♿ Accessibility & Responsiveness

- **Focus Outlines**: `:focus-visible` triggers 3px bright cyan outline with cyan glow.
- **Reduced Motion**: `@media (prefers-reduced-motion: reduce)` overrides animations to instant transitions.
- **Breakpoints**:
  - **Desktop**: `> 1024px` (Full multi-column layout).
  - **Tablet**: `768px - 1024px` (Fluid 2-column grids).
  - **Mobile Landscape**: `max-height: 500px` (Compact padded panels, touch overlay).
  - **Mobile Portrait**: `< 768px` (Single column stacked cards).

---

## 🔮 Phase 6.5 Garage & Customization Hub Architecture

Phase 6.5 introduces the 3-column Customization Hub:
1. **Left Navigation Panel (`.kb-garage-nav-panel`)**: Category tabs (`CHARACTERS`, `KARTS & CLASSES`, `COSMETICS & SKINS`, `EMOTES`) and roster grid (`.kb-char-card` items).
2. **Center 3D Stage Panel (`.kb-garage-stage-panel`)**: Interactive 3D Turntable preview stage rendering combined character avatar seated in kart cockpit with pedestal radial glow.
3. **Right Details & Real Derived Stats Panel (`.kb-garage-detail-panel`)**: Displays rarity badge, item metadata, unlock level requirements, and derived kart class stat bars (Max HP, Top Speed, Acceleration, Knockback Power derived directly from `KART_CLASSES`).
4. **Bottom Action Bar**: `#garageCloseBtn` and `#btnGarageEquip` equipped handler synchronized with `EquipmentSystem` and `localStorage`.

---
*KART BRAWL 2.0 — UI/UX Design System Updated for Phase 6.5 Garage Customization Hub.*
