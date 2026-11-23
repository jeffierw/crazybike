<div align="center">

<h1>CRAZYBIKE · Downhill Mayhem</h1>

<p><strong>A single-file WebGPU &amp; WebGL2 procedural downhill mountain biking game — 820 m seamless panoramic mountains, 4 sculpted biomes, persistent 3D carved tire tracks, realistic MTB bunny hops vs. cliff big air, ink-ribbon stunts, pickup combat, and live 3D camera inspection.</strong></p>

<p>
  <a href="https://crazybike.yepw.dev"><strong>Play Live (crazybike.yepw.dev)</strong></a>
  &nbsp;·&nbsp;
  <strong>English</strong> | <a href="README.zh-CN.md">中文</a>
</p>

<p>
  <img src="https://img.shields.io/badge/WebGPU%20%2B%20WebGL2-10%20Pipelines-0ea5e9?style=flat-square" alt="WebGPU + WebGL2">
  <img src="https://img.shields.io/badge/Single%20File-347.8%20KB%20(~114%20KB%20gz)-10b981?style=flat-square" alt="Bundle Size">
  <img src="https://img.shields.io/badge/Zero%20Deps-28%20Modules-f59e0b?style=flat-square" alt="Zero Dependencies">
  <img src="https://img.shields.io/badge/Verify-20%2F20%20PASS-22c55e?style=flat-square" alt="Verify Passing">
</p>

<img src="docs/media/hero.jpg" alt="CrazyBike V7 Red Rock Canyon Carved Tire Tracks & Downhill" width="100%">

</div>

---

## Highlights

- **Dual GPU Engine (`WebGPU` + `WebGL2`):** Single-source typed shader language (SSL) compiled at boot into **10 GPU pipelines** (`WGSL` & `GLSL ES 3.00`) featuring PCF directional shadows, physical sky scattering, ACES filmic tone mapping, bloom, and speed-adaptive atmospheric haze.
- **820 m Seamless Panoramic Terrain (Zero Airborne Clipping):** Non-uniform horizon-stretched terrain mesh spans `-66.5 m` behind to `+820 m` ahead and `±560 m` laterally (`C.far = 1800 m`), melting into biome-matched horizon mist so launching off massive cliffs never exposes world edges.
- **4 Sculpted Procedural Biomes & Atmospheric Vistas:**
  - **Red Rock Canyon** — Smooth geological Moab canyon walls, eroded sandstone hoodoos, fluted saguaros with curved elbows, cactus scrub, desert creeks, and warm golden Monument Valley basin haze.
  - **Pine Forest** — 7-tier overlapping drooping conifer boughs, alpine boulders, snow-capped jagged granite ranges, luminous valley cloud seas, and boundary-free endless freeride.
  - **Volcanic Ridge** — Clustered stepped hexagonal basalt organ formations, magma streams, glowing fissures, caldera plume silhouette, and smoky volcanic basin haze.
  - **Hillside Town** — Plumb terraced Mediterranean villas anchored on warm limestone plinths with overhanging terracotta roofs and shuttered French windows, coastal cypress/bougainvillea, perspective-projected glittering ocean waves, and soaring gulls.
- **Realistic MTB Bunny Hops vs. Mega Cliff Big Air:** Pressing `Space` on flat or smooth trail terrain pops a responsive MTB bunny hop (`~0.48 m` quick tap, `~0.98 m` full charge), while kicker ramps and cliff drop-off lips launch explosive `11 m+` big air for sequential stunt chaining.
- **Persistent Carved 3D Tire Tracks & Biome Ground Spray:** Dedicated `tracks` pipeline cuts terrain-hugging tread grooves, raised edge rims, and frothy creek wakes behind all riders, breaking cleanly across jumps and kicking up carve-directional dust plumes plus sandstone gravel, pine loam, obsidian ash sparks, or coastal grit.
- **Pickup-Driven Combat & Biomechanical Melee:** Randomly spawned **Nitro Canisters** and **Water Bottles** (`≤ 26 m` bounded homing); when out of bottles, attacks randomly perform a **Human Punch** (side shove, no KO) or **Flying Kick** (close-range ragdoll KO), while normal rider/obstacle bumps never knock players off the bike and respawns recover strictly upright.
- **Live 3D Camera Preview & 8 Views:** Clicking any camera view updates the background 3D scene immediately with a live right-hand preview status readout and automatic helmet visor clipping removal (`Helmet FPV`).
- **Memory-Aware Quality, Adaptive AI & Lo-Fi Soundscape:** Hardware profiler scales shadows/foliage/wildlife (`Low / Balanced / High`), 7 AI rivals pace dynamically around upgrades and player skill EMA, and Web Audio mixes Lo-Fi tracks with subtle speed-scaled wind and biome impact cues.

---

## World & UI Gallery

<table>
  <tr>
    <td width="50%">
      <img src="docs/media/redrock.jpg" alt="Red Rock Canyon Mega Drop & Seamless Horizon" width="100%">
      <p align="center"><strong>Red Rock Canyon</strong> — 118 km/h canyon drop with Nitro pickups &amp; 820 m horizon haze</p>
    </td>
    <td width="50%">
      <img src="docs/media/forest.jpg" alt="Pine Forest Layered Conifers & Carved Loam Tracks" width="100%">
      <p align="center"><strong>Pine Forest</strong> — 7-tier conifers, valley cloud sea &amp; persistent loam tire ruts</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="docs/media/volcano.jpg" alt="Volcanic Ridge Clustered Basalt & Lava Haze" width="100%">
      <p align="center"><strong>Volcanic Ridge</strong> — Hexagonal basalt organ clusters, caldera glow &amp; charred ruts</p>
    </td>
    <td width="50%">
      <img src="docs/media/town.jpg" alt="Hillside Town Mediterranean Villas & Perspective Ocean" width="100%">
      <p align="center"><strong>Hillside Town</strong> — Plumb Mediterranean villas, perspective sea shimmer &amp; soaring gulls</p>
    </td>
  </tr>
</table>

<p align="center">
  <img src="docs/media/settings.jpg" alt="Live Camera View Preview & Helmet FPV" width="90%">
  <br>
  <em>Live 3D camera switching with right-hand active preview readout and Helmet FPV auto-cut</em>
</p>

---

## Controls

| Action | Keys | Notes |
| --- | --- | --- |
| **Steer / Pedal / Brake** | `WASD` / `Arrow Keys` | Carve slopes downhill, tuck, or corner-brake |
| **Jump** | `Space` | Crisp bunny hop on flat trails · Mega launch on ramps & cliff crests |
| **Aerial Stunt** | `Mid-Air WASD` / `Space` | Sequential ink-brush stunt chain (Zero Crash!) |
| **Combat / Bottle** | `Q` `E` / `J` `K` | Throw picked-up Bottle (`≤ 26 m` homing), else random Punch / Flying Kick |
| **Nitro Boost** | `Shift` | Burn adrenaline & picked-up Nitro Overdrive |
| **Camera Rig** | `V` / `Shift+V` / `1`–`8` | Switch all 8 camera views; clickable with live 3D preview |
| **360° Inspect / Pause** | `Right-Drag` / `Esc` | Orbit rider & horizon or open pause/camera settings |
| **Bilingual Switch** | Top `EN / 中文` pill | Instant runtime language toggle |

---

## Quick Start & Build

Requires Node.js (tested on Node 20+, zero `npm install` packages needed):

```bash
# Development build + full automated verification suite (20 checks)
node build.js && npm run verify

# Minified production single-file build -> dist/index.html (347.8 KB)
MIN=1 node build.js

# Serve locally on port 8080 (open ?backend=webgl2 to force WebGL2 fallback)
npm start
```

---

## Architecture (`28` Modules in `src/`)

| Module Group | Responsibility |
| --- | --- |
| `00a_i18n.js` – `00c_quality.js` | Bilingual dictionary (`EN`/`ZH`), Lo-Fi music scales, memory/hardware quality profiler |
| `01_gfx.js` – `02_shaderlib.js` | Dual `WebGPU` + `WebGL2` abstraction & SSL-to-WGSL/GLSL ES 3.00 transpiler |
| `03_course.js` – `05_sky.js` | 820 m seamless stretched terrain, 2D-sculpted mountain vistas, cloud sea & perspective ocean |
| `06_bikemesh.js` – `06b_rider_anim.js` | SDF-sculpted rider mesh (`11,181` verts / `21,076` tris), 3-phase melee kinematics & world props geometry |
| `07_physics.js` – `09_combat.js` | Slope-relative bunny hops vs. cliff big air, upright respawn, 8 cameras, chained tricks & pickup combat |
| `10_particles.js` – `15_wildlife.js` | 3D carved tire tracks pipeline (`tracks`), biome spray, ink ribbons, `Props.onHit`, grounded villas/flora & wildlife |
| `16_career.js` – `99_main.js` | 12-event Career Tour, garage upgrades, Web Audio synthesizer, frosted glass UI & runtime hooks |

`tools/verify-mvp.js` runs **20** automated headless checks covering all 10 GPU shader pipelines, SDF rider synthesis, 4-mountain race simulations, camera clearances, stunt chaining, boundary-free endless terrain, pickup/combat KO semantics, horizon bounds, bunny-hop vs. ramp trajectories, and 3D tire track gaps.
