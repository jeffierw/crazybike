# CrazyBike Game Design & Technical Architecture (`docs/DESIGN.md`)

## 1. Design Pillar: The ABCD Chain Reaction
Every mechanic connects into one continuous risk-reward flywheel:
1. **C — High-Speed Line Choice & Terrain**: Carve berms, rear-brake skid tight corners, choose between wide main paths and steep high-risk cliff/forest shortcuts.
2. **B — Big Air Tricks**: Leaving the ground automatically turns inputs into 1-button tricks (`Superman`, `Tailwhip`, `Backflip`, `360`). Holding builds score & adrenaline; releasing ~0.2s before touchdown snaps upright cleanly.
3. **A — Dirty Combat & Weapon Escalation**: Context-smart left/right strikes (`Q/E` or `J/K`). Close to a rival = melee strike; ahead in cone with ranged charge = bottle/wrench throw. Combat evolves across 4 tiers: **Shove → Kick → Water Bottle → Bat/Wrench**.
4. **D — Ragdoll Wipeouts**: Getting slammed into trees/rocks/cliffs or greedily holding a mid-air trick into the ground detaches bike and rider into tumbling rigid bodies with hitstop/slow-mo punch and snappy 1.2s respawn.

## 2. Game Modes
- **Career Tour (Route B)**: 4 Theme Mountains × 3 Event Types (`Freeride`, `Technical Downhill`, `Mountain Cross`) = 12 tour events. Earn `$` from placement, trick cashout, takedown bounties (`+$250`), and sponsor challenges.
- **3D Garage Upgrades**: 5 upgrade tiers (`Frame`, `Fork & Shock`, `Drivetrain`, `Tires`, `Combat Gear`) that visibly upgrade the procedural 3D bike mesh AND physics/combat performance.
- **Endless Downhill**: Pick any mountain (or `#today` / `#seed-xxxxxx`) for infinite descent with dynamically recycled AI rivals so there is always traffic to overtake and fight.

## 3. Physics-Driven Single-Player AI
All 7 AI rivals run the exact same downhill physics engine as the player, controlled by a per-frame lookahead steering & combat controller (`src/08_ai.js`):
- **5 Skill Parameters**: `lookAhead`, `shortcutRate`, `trickSkill`, `aggro`, `bikeTier`.
- **4 Personalities**: `Brawler`, `Speedster`, `Showoff`, and dynamic `Nemesis` (rivals knocked down by the player spawn back enraged to hunt the player for double bounty).
- **Director Rubber-Banding**: Keeps pack tension alive (lead targets, side-by-side brawlers, chasing pressure).

## 4. Coordinate System & Verification Hook
- World axes: `x` right, `y` up, downhill fall line along `-z` (`s = -z` is downhill distance in metres; `u = x - cx(s)` is lateral offset from track centerline).
- Global headless test hook: `window.__bike` exposes `sim(dt, inputFn, {draw})`, `state()`, `teleport(s, u)`, `setMountain(id)`, `camClearance()`, and `aiStats()` for Playwright verification.
