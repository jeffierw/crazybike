# CRAZYBIKE · 暴走速降

**▶ Play Online / 在线试玩：https://crazybike.yepw.dev**

A pure-code, zero-asset 3D arcade downhill mountain biking & combat racing game in a single HTML file — inspired by PS2 **Downhill Domination** (*暴走山地自行车*) and the code-only WebGPU/WebGL2 architecture of **Cold Smoke** (`huiskylabs/cold-smoke`).

- **Zero external assets**: Terrain, mountains, bikes, articulated riders, dust plumes, impacts, ratchet SFX and adaptive rock/electro beats are all generated in code at runtime.
- **4 Distinct Theme Mountains**: Red Rock Canyon (红岩峡谷), Pine Forest (苍翠松林), Volcanic Ridge (火山黑砂), and Hillside Town (山城阶梯).
- **Career Tour + Endless Mode**: 12 career tour events (Freeride / Technical / Mountain Cross) with 3D visual bike upgrades, plus an Endless Downhill mode with dynamically spawning AI rivals and daily mountain seeds (`#today`, `#seed-xxxxxx`).
- **The Downhill Loop**: High-speed line choice & drifting → Big air automatic trick combos → Melee/bottle combat & rival takedowns → Ragdoll wipeouts & Adrenaline overdrive.

## Quick Start

```bash
npm start
# opens http://localhost:8080  (dev tuning mode: http://localhost:8080/dev?dev)
```

## Controls

| Context | Action | Keyboard | Gamepad |
| :--- | :--- | :--- | :--- |
| Ground | Steer / Carve | `A / D` or `← / →` | Left Stick |
| Ground | Pedal / Rear-Brake Drift | `W` / `S` | `RT` / `LT` |
| Ground | Charge & Jump | Hold `Space`, release | Hold `A` (×), release |
| Ground | Adrenaline Boost | `Shift` | `RB` or `Y` |
| Ground | Smart Left/Right Attack / Throw | `Q / E` or `J / K` | `LB / X` · `B` |
| Mid-Air | Tricks (release before landing!) | `W` Superman · `S` Backflip · `A/D` Tailwhip/360 | Stick + Trick |
| General | Camera / Pause | `V` / `Esc` | `View` / `Menu` |

## Credits & License

MIT License. Dual WebGPU/WebGL2 rendering abstraction (`src/01_gfx.js`) and single-file code-only philosophy are inspired by and adapted from [huiskylabs/cold-smoke](https://github.com/huiskylabs/cold-smoke) (MIT).
