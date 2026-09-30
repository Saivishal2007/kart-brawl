# KART BRAWL 2.0 — Character Asset Architecture

This directory defines the visual asset structure for 3D Character Models in KART BRAWL.

## Expected Asset Format
- Format: GLTF / GLB 2.0 (`.gltf` / `.glb`)
- Scale: 1 unit = 1 meter
- Coordinate System: Y-up, Right-handed
- Textures: Embedded PBR materials (BaseColor, MetallicRoughness, Normal Map)
- Driver Rigging: Standardized driver seat bone hierarchy (`Root -> Spine -> Head / Arms`)

## Character Directory Structure
- `racer/model.gltf` (Blaze Vance)
- `tank/model.gltf` (Titan Krush)
- `tech/model.gltf` (Cyber Nova)
- `wildcard/model.gltf` (Jester Jack)
- `ghost/model.gltf` (Phantom Shade)
- `bomber/model.gltf` (Boomer Baxter)
- `guardian/model.gltf` (Aegis Prime)
- `rookie/model.gltf` (Pixel Pete)
