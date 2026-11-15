# AGENT.md — SYNAPZ HOCKEY V2.0 ARCHITECTURE MAP

## Clean-Sheet Modular Mandate
- **Strict Modularity:** Every TypeScript/React module under `src/` must stay focused on a single responsibility and remain **under ~300 lines**. Never introduce monolithic components or legacy single-file HTML patterns.
- **Coordinate Determinism:** Logical rink space spans `x: 0..100` (left boards to right boards in Attack-Up) and `y: 0..200` (`y = 0` opponent offensive end-boards at top in Attack-Up, `y = 200` home defensive end-boards at bottom). `RinkViewport.ts` handles bi-directional `iceToScreen` / `screenToIce` mapping for all 5 `IceZone` framings and both `ATTACK_UP` (North-South) and `BROADCAST` (East-West) orientations.

---

## Module Directory Map
```text
src/
├── types/
│   └── hockey.ts                # Core vectors, hip/stick angles, zones, federations, 16 pillars, blueprints
├── engine/
│   ├── RinkViewport.ts          # Bi-directional ice <-> screen projection & zone camera framing
│   ├── RinkRenderer.ts          # High-DPI 60/120fps Canvas 2D renderer (ice, skaters, sticks, saucer, rewind)
│   ├── PhysicsEngine.ts         # Skater kinematics, defender deception, snap/saucer/bank/shot physics
│   ├── SoundAndHaptics.ts       # Zero-dep Web Audio foley synthesizer + global gesture unlock
│   ├── StorageIsolation.ts      # Enforces strict `synapz_v2_` prefix on all storage keys
│   └── useArenaCanvas.ts        # ResizeObserver + DPR (<= 2x) responsive canvas sizing hook
├── curriculum/
│   ├── PillarsData.ts           # 16 Tactical IQ Pillars metadata & Saturday Ice Transfer habits
│   ├── PlayLibrary.ts           # Seed blueprints across all 16 pillars + left/right mirror transform
│   ├── AdaptiveIqDirector.ts    # 0–1000 IQ scaling parameters + 3-play Redemption queue
│   └── PositionModel.ts         # Real-time 6-position tactical spacing solver & off-puck scenarios
├── modes/
│   ├── LiveReadMode.tsx         # Mode 1: Roll-in -> 25% bullet-time gesture -> 100% physics -> Rewind
│   ├── PositionLabMode.tsx      # Mode 2: Live puck-drag Tactical Table + "Where Do I Belong?" game
│   ├── HeadUpScannerMode.tsx    # Mode 3: Shoulder-check scan window -> fog reception -> one-touch flick
│   └── CoachStudioMode.tsx      # Mode 4: <30s play creator + MediaRecorder voice cue + JSON packs
└── ui/
    ├── TopCommandBar.tsx        # Quick profile (Age/Pos/Fed), IQ badge, Notes, View & Audio toggles
    ├── TabletRail.tsx           # Adaptive 5-item left rail (PC/Landscape) & bottom dock (Portrait/Phone)
    ├── DesktopTelemetryAside.tsx# >= 1100px widescreen tactical telemetry & PC keyboard shortcuts panel
    ├── PlaytestNotesModal.tsx   # Cross-device playtest notes drawer with 1-tap copy/share
    ├── TelestratorCaptionBar.tsx# Synchronized non-blocking teaching & audio caption bar
    └── IqRadarDashboard.tsx     # 16-Pillar SVG mastery radar + Saturday Ice Transfer launcher
```

---

## Verification & Deployment Gates
1. **Typecheck & Build:** `npm.cmd run build` (`tsc --noEmit && vite build` + `dist/.nojekyll` with `base: './'`)
2. **4-Device Universal Matrix:** `npx.cmd playwright test qa/v2_universal_devices.spec.ts`
   - Verifies Desktop (`1920×1080`), Landscape Tablets (`1180×820`, `1024×768`), Portrait Tablet (`800×1280`), and Smartphones (`412×915`, `390×844`) with `0` console errors, `0px` overflow, and strict `synapz_v2_*` storage isolation.
3. **Isolated GitHub Pages Deploy:** `node scripts/deploy-v2-pages.mjs`
   - Enforces a hard abort if any remote URL does not end with `/synapz-v2` or `/synapz-v2.git`, deploys `main` + `dist/` (`gh-pages`) strictly to `danebekkedahl/synapz-v2`, and verifies `https://danebekkedahl.github.io/synapz-v2/`.
