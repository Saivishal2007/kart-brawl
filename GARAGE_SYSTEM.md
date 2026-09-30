# 🏎️ KART BRAWL 2.0 — GARAGE & CUSTOMIZATION SYSTEM ARCHITECTURE

**Version**: `2.5.0-GARAGE`  
**Status**: `PHASE 6.5 COMPLETE & INTEGRATED`  

---

## 📌 Overview

The **KART BRAWL 2.0 Garage & Equipment System** transforms the garage into an arcade customization hub. It provides an interactive 3D combined character + kart turntable preview stage, category tabs for browsing equipment, derived kart stats directly calculated from gameplay constants (`KART_CLASSES`), and persistent client-side equipment management.

---

## 🛠️ Architecture & Components

### 1. `CosmeticsRegistry`
Centralized registry containing catalog items for skins, wheels, exhaust trails, and emotes:
- **Skins**: Default Neon, Cyber Chrome, Golden Champion, Flame Burst, Stealth Matte.
- **Wheels**: Standard Racing, Neon Glow Discs, Chrome Spoke, Offroad Tread.
- **Trails**: Standard Exhaust, Flame Exhaust, Rainbow Sparks, Galaxy Aura, Gold Sparkles.
- **Emotes**: Wave, Nitro Taunt, Victory Cheer, Good Game, Heavy Flex.

### 2. `EquipmentSystem`
Handles client-side persistence and item equipping:
- Keys in `localStorage`:
  - `kb_equipped_character`: Active character ID (default: `'racer'`).
  - `kb_equipped_kart_class`: Active kart class key (default: `'tank'`).
  - `kb_equipped_skin`: Active kart paint skin (default: `'default'`).
  - `kb_equipped_wheels`: Active wheel cosmetic (default: `'standard'`).
  - `kb_equipped_trail`: Active exhaust particle trail (default: `'default'`).
  - `kb_equipped_emote`: Active player quick emote (default: `'default'`).

### 3. Combined 3D Turntable Preview (`#garagePreviewStage`)
- Renders the selected character avatar seated inside the active kart class cockpit.
- Uses Three.js WebGL rendering with interactive mouse/touch turntable rotation.
- Dynamically updates color schemes, skin tints, and spotlight accent lighting.

### 4. Real Derived Kart Stats Panel (`#garageDetailPanel`)
Stat metrics are derived directly from server/client gameplay source of truth (`KART_CLASSES`):
- **Max Health (HP)**: `classData.maxHp` (100–125 HP).
- **Top Speed**: `classData.topSpeedMult` (100%–130%).
- **Acceleration**: `classData.accelMult` (100%–180%).
- **Knockback Power**: `classData.knockMult` (100%–200%).

---

## 🔒 Unlock Progression Integrity

Items require a minimum player Level (`reqLvl`) evaluated against `ProgressionSystem.data.level`. Locked items display level requirements (`🔒 UNLOCKS AT LVL X`) and disable the equip CTA until reached.

---
*KART BRAWL 2.0 — Phase 6.5 Garage Customization System Complete.*
