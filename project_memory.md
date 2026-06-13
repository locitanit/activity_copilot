# Project Memory — RMG Astro-Activity

Technical reference for the codebase: architecture, conventions, data model, and
gotchas. Kept for fast onboarding (human or AI). Update it when these facts change.

---

## 1. What it is

Browser-based, real-time, multiplayer **"Activity"-style classroom game** with a
space / sci-fi ("Astro") reskin. Teams get a teammate to guess a secret word by
**miming / drawing / describing** (`mutogatás` / `rajzolás` / `körülírás`). First
fleet to the end of a space board ("Proxima base") wins. UI copy is **Hungarian**.

Three roles, one app (selected by URL/role, not separate pages):
- **Host / Irányítóközpont** — desktop dashboard; sees the secret word, controls timer & scoring.
- **Player / Asztronauta** — phone; only the active player sees the word after the host reveals it.
- **Projector / Kivetítő** — public wall display; **never shows the secret word**.

---

## 2. Tech stack

- **Vanilla JS, ES modules** — no framework, no build step.
- **Tailwind CSS via Play CDN** (`https://cdn.tailwindcss.com`, no plugins) + an inline
  `tailwind.config` (Material-Design-3 token palette) in `index.html`. Compiles in the
  browser and watches the DOM, so **dynamically injected (innerHTML) classes work**.
- **Material Symbols Outlined** (icon font) + **Exo 2** (display font).
- **Firebase Realtime Database** (CDN SDK 10.12.2) for live sync.
- `css/style.css` — hand-written CSS for the bits Tailwind doesn't own (see §4).
- Statically hostable (e.g. GitHub Pages); needs an HTTP server (Firebase fails on `file://`).

---

## 3. Architecture

```
index.html  ── SPA shell: Tailwind + config + design-system <style> + global
   │            WebGL starfield + 8 empty .view containers + <script module app.js>
   │
js/app.js ───── app shell: global `state`, showView(), showToast(),
   │            localStorage session persistence (reconnect), URL routing
   │            (?role=projector&room=CODE), the Firebase listener that routes by
   │            game.status, and the shared exit/leave helpers + leave-bar.
   │
js/firebase-config.js ── ONLY data-access layer: createGame / joinGame /
   │                       listenToGame / updateGameData / getGame / deleteGame /
   │                       removePlayer / deleteAllGames. Holds the canonical schema.
   │
js/data/topics.js ────── static word bank (operator-supplied; keys are topic names).
   │
js/logic/   turn-manager.js  → turn rotation, word draw, next-player, reroll,
   │                            switchToNextPlayer (hand the pre-reveal turn to another
   │                            teammate; bumps the skipped player's turnCount)
   │        timer.js         → pure phase/countdown math (pausable via timerElapsedMs)
   │        scoring.js       → award/stolen/shared points, win check, advance turn
   │        anomaly.js       → 4 random "space anomaly" events (every Nth cell; N = settings.anomalyEvery, default 5)
   │        boosts.js        → 5 power-ups (torpedo/trap/hyperdrive/timewarp/shield)
   │
js/views/   landing, join, host-setup, lobby, host-game, projector, player-game, winner
```

**Render pattern:** every view is a plain `render(game, state)` function that rebuilds
its container's `innerHTML` and re-binds listeners on each Firebase snapshot. Views never
mutate state locally — all writes go through `updateGameData(code, { 'path/to/field': value })`
(one atomic multi-path RTDB update). The `logic/` modules are **host-authoritative**
(they use `Math.random`), so only the host should call them.

**Routing** (`app.js`, by `game.status`): `lobby` → lobby · `briefing`/`playing` →
host-game or player-game (by `state.isHost`) · `finished` → winner. The projector path
is taken at load when `?role=projector&room=CODE` is present.

**Session / reconnect:** `app.js` saves `{gameCode, playerId, playerName, isHost}` to
`localStorage['rmg-session']` and auto-restores on reload. The **Leave control** (see §7)
clears it so reload no longer re-enters a game.

---

## 4. Design system (the redesign)

The whole UI was rebuilt to a **holographic HUD** look. Two style sources coexist:

- **Tailwind** (utilities + the MD3 color tokens from the inline config in `index.html`)
  drives all the redesigned view markup.
- **`css/style.css`** (~560 lines, pruned) keeps ONLY: `:root` theme vars, reset,
  splash, toast, the `.view` system, the **briefing hologram** (`.briefing-*`),
  the **boost chips** (`.boost-chip*`, host arsenal) + **`.boost-info`** (player arsenal
  description tooltip — shows on hover/`:focus`/`.tip-open`; tap toggles on phones, set in
  player-game.js), the host **projector dropdown** (`.proj-menu*`),
  the **anomaly modal** (`.anomaly-modal*`, used by host modals + projector overlay),
  and a few keyframes (`bh-pulse`, `orbit-wobble`, `fade-pulse`). Everything else (old
  per-view CSS) was deleted.
- Star-chart / astrolabe / `.holographic-panel` / `.glass-panel` / `.scanlines` /
  `.clip-chamfer` and the projector board classes live in the `<style>` block in `index.html`.

**Palette / fonts / motifs:** near-black surfaces, neon cyan (`#00d4ff`) accents, Exo 2,
animated starfield, holographic briefing screen, snake/constellation board.

**Team colors** (index = teamIndex, 6 max): `#ef4444 #3b82f6 #22c55e #f59e0b #a855f7 #ec4899`.

**Timer phases** (color-coded everywhere): phase 1 green `#00e676` (0–30s) · phase 2
yellow `#ffd600` (30–60s) · phase 3 red `#ff1744` (60–90s, stealable). Mapped in JS via a
local `PHASE_HEX` map per view; `timer.js` returns `colorClass` (`phase-0..3`).

### ⚠ Critical rendering gotcha (fixed — don't reintroduce)
The dark theme must NOT depend on `backdrop-filter` or the WebGL canvas:
- `#bg-stars` (the fixed full-viewport starfield container) has a **solid dark background
  `#020510`** so the backdrop is dark even if the WebGL canvas fails / doesn't cover.
- `.holographic-panel` / `.glass-panel` / `.briefing-hologram` **do not use
  `backdrop-filter`** — it mis-samples the WebGL canvas layer on some GPUs and renders
  panels grey/white (it showed up as a "white dashboard" after a re-render). Panels are
  opaque-enough translucent dark instead.
- The starfield script hides the canvas on `webglcontextlost`.

---

## 5. Firebase data model — `games/{code}`

`{code}` is a **4-char** code (chars `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`; note the
JSDoc says 6 — it's wrong). All shared state lives under one game object:

```js
{
  status,         // 'lobby' → 'briefing' → 'playing' → 'finished'
  createdAt,      // serverTimestamp()
  settings: { teamCount, assignmentType:'random'|'manual', teamNames[],
              boardLength, anomalyEvery, selectedTopics[], allowedTaskTypes[] },
  players: { <pushId>: { name, teamIndex:-1, turnCount:0 } },     // MAP; teamIndex -1 = unassigned
  teams:   [ { name, score:0, inventory:[], skipNextTurn:false } ], // ARRAY, indexed by teamIndex
  currentTurn: { word, taskType, points, teamIndex, activePlayerId,
                 timerStartedAt, timerElapsedMs, wordRevealed,
                 hyperdriveActive, timeDilationActive, commDisruptionActive },
  upcomingTurns: [],   // queue, refilled to 3
  turnHistory:   [],   // entries: result 'solved'|'stolen'|'shared'|'unsolved', winnerTeamIndex, ...
  traps:    { <cell>: true },
  boostLog: [],        // full event log ("Eseménynapló"); capped to last 500, projector shows last 30 (scrollable)
                       // entries are { message, timestamp, fx? } — fx drives projector board animations:
                       // { kind:'boost_gain'|'torpedo'|'trap_place'|'trap_trigger'|'shield_block'|'warp'|'timewarp',
                       //   team?, target?, cell?, outcome?:'hit'|'miss'|'shielded' } (added via addBoostLog's 4th arg)
  anomalyPending, anomalyEvent   // transient anomaly broadcast to the projector. anomalyEvent:
                       // { type, name, emoji, specificDescription, triggeredByTeamIndex, timestamp,
                       //   affected:[{teamIndex,from,to}]|null }  (affected set for supernova/blackhole)
}
```

**Timer pause model:** `timerElapsedMs` banks elapsed time while paused
(`timerStartedAt == null`); the live delta is added only while running. Start/pause/reset
write these fields from host-game (and the player view reads them). Total is 90s (105s with
time dilation); comm-disruption makes the whole turn phase-3 (stealable).

---

## 6. Views & key hooks (preserve these IDs/classes when editing markup)

| View | File | States | Key element hooks |
|------|------|--------|-------------------|
| Landing | `landing.js` | — | `#btn-new-game`, `#btn-join-game`, `#admin-station` (hidden admin gesture) |
| Join | `join.js` | — | `#join-code`, `#join-name`, `#btn-join-confirm`, `#btn-join-back` |
| Host setup | `host-setup.js` | — | `#team-count`, `name=assignmentType`, `.team-name-field`, `#board-length`/`#board-length-val`, `#topics-group`/`name=topic`, `#task-types-group`/`name=taskType`, `#btn-setup-back`, `#btn-create-lobby` |
| Lobby | `lobby.js` | host / player | `#btn-start-game`, `.team-join-btn[data-team]`, `#btn-leave-game` |
| Host game | `host-game.js` | briefing / playing | `#btn-launch-game`, `#btn-reveal-word`, `#btn-next-player` (switch active astronaut, pre-reveal), `#btn-reroll`, `#hg-timer`/`#hg-label`/`#hg-ring`, `#btn-start-timer`/`#btn-pause-timer`/`#btn-reset-timer`, `.score-btn[data-team]`, `#btn-no-score`, `.shared-score-check`/`#btn-award-shared`, `#host-details-toggle`/`#host-details-section`, `.proj-menu*`, `.boost-chip*`, `#btn-leave-game` |
| Projector | `projector.js` | lobby/briefing/playing/finished | `#proj-board-area` (empty mount — see §7 board engine), `#proj-timer`/`#proj-label`/`#proj-timer-panel`, `.stellar-node`/`.constellation-line`, `.proj-ship`/`.proj-ship-craft`/`.proj-planet`/`.proj-station`/`.proj-mine`, `.proj-fx*` |
| Player game | `player-game.js` | briefing / playing | `#pg-timer`/`#pg-label`/`#pg-ring`, `#pg-details-toggle`/`#pg-details-section`, `.boost-activate-row`, `.boost-info` (boost tooltip), `.torpedo-target-sel`/`.torpedo-fire-btn`, `.trap-cell-input`/`.trap-place-btn`, `.warp-btn`, `.timewarp-btn` (all `[data-bidx]`), `#btn-leave-game` |
| Winner | `winner.js` | — | `#btn-new-game-winner` |

**Collapsible panels** (host & player details) toggle inline `style.display`, NOT the
`hidden` attribute — a Tailwind `grid`/`flex` display utility would override `[hidden]`.

---

## 7. Conventions, mechanics & gotchas

- **Leave / End control** (`app.js`): `leaveBarHtml()` + `wireLeaveBar()` render a header
  leave button (`#btn-leave-game`) in lobby/host-game/player-game. Host → confirm →
  `deleteGame()` (kicks everyone via the null-game listener path); player → `removePlayer()`.
  Both call `exitToMenu()` (tear down listener, clear session, back to landing). Winner's
  "Új küldetés" also uses `exitToMenu()`.
- **Projector board engine** (`projector.js`, rebuilt 2026-06): the board uses **img assets**
  — `spaceship_<red|blue|green|yellow|purple|pink>.png` as team ships (side-view, point RIGHT,
  index = teamIndex), `planet1/2/3.png` as nodes (deterministic per cell), `space_station.png`
  as the goal (black bg dropped via `mix-blend-mode:screen` — NOT backdrop-filter), `mine.png`
  on trap cells, and `torpedo/explosion/wormhole/black_hole.png` for FX.
  - **Why it's not a plain re-render:** the projector rebuilds the whole view innerHTML every
    Firebase snapshot, which destroys element identity (kills CSS transitions). So a **persistent
    detached `_stage` node** (sublayers `#proj-static`/`#proj-ships`/`#proj-fx`) is
    `appendChild`-**moved** into the otherwise-empty `#proj-board-area` each snapshot — a move,
    not a recreate — so ship `<img>`s and in-flight `requestAnimationFrame` tweens survive.
    ⚠ **Never write to `#proj-board-area.innerHTML`** or you destroy the stage and all animations.
  - `computeLayout()` keeps the old serpentine + seeded-jitter math (seed = `gameCode`), giving
    `cx[]/cy[]/nd[]`. Static layer is only rebuilt when a `W,H,boardLength,trapKeys` signature
    changes. Module-level state holds `_shipEls/_shipCraft/_shipAnim/_shipPos/_targetCell/_shipOffset`,
    cursors `_fxCursor/_anomalyCursor/_commPrev`, and `_live`. `_resetStage()` (called on every
    non-playing branch) cancels all rAF and drops the stage.
  - **Animations:** movement is detected by **score-diff** vs `_targetCell` (no broadcast field) —
    ships fly cell-by-cell along the node polyline, rotate to heading (`scaleY` flip so never
    upside-down), thrust flame, ease-in-out. Boost/anomaly FX are driven by `boostLog[].fx`
    (drained from `_fxCursor`) and `anomalyEvent.type` (gated by `.timestamp > _anomalyCursor`);
    comms FX fires on the rising edge of `currentTurn.commDisruptionActive`. **Join-mid-game**
    baselines the cursors so history is NOT replayed; `prefers-reduced-motion`/≤2 cores → instant.
  - **Node decoration** (`_buildStaticHTML`): cell 0 = **Earth** (`planet1.png`, used ONLY at start);
    goal = `space_station.png`; anomaly cells = glowing dot + hazard halo + 🌀; trap cells = `mine.png`;
    other cells are seeded among **Jupiter/Saturn (sparse ~7.5% each), moon, nebula, or empty dot**.
  - **Ships have no ID pip** (color + glow only). **Animations are deliberately slow** (~330ms/cell,
    FX ~1.2–2.5s). The projector **anomaly popup is deferred** (`_syncAnomalyModal`, shown only when
    `!_anyShipAnimating()`) so the landing movement plays fully BEFORE the modal appears.
  - **Ship facing**: moving ships rotate to the travel heading (with a `scaleY(-1)` flip so they're
    never upside-down). A *resting* ship faces its serpentine row's travel direction — `_restHeading(cell)`
    returns 0 (right) or 180 (left, mirrored) from the sign of the node x-deltas — so a ship that moved
    left along a row keeps facing left when it stops.
  - **Special FX choreography**: supernova blast is placed *behind* each pushed ship (`_behindCellXY`,
    using `anomalyEvent.affected[].from`) so the wave shoves it forward; **wormhole = teleport**
    (`_fxWormholeTeleport`: ship shrinks at the entry cell, a wormhole sprite shows on entry AND exit,
    ship grows at the exit — no path glide); **torpedo hit defers the target's recoil until after the
    explosion** — for this to work the score change and the `fx` log entry must arrive in ONE snapshot,
    so `boosts.activateTorpedo` writes them atomically (reads `getBoostLog`, appends, writes score +
    inventory + boostLog in a single `updateGameData`). (Only HITS still do this; miss/shielded now
    append via the transactional `appendBoostLog` — see the §7 event-log note.)
  - **Win cinematic** (`_handleFinished` → `_runFinishCinematic`): when `status` flips to `finished`
    while the projector is LIVE (stage mounted), the finished branch does NOT immediately reset+show
    results. Instead it plays a sequence on the existing board, gated by `_finishState`
    (`null`→`'running'`→`'done'`): (1) final ship move to the goal (`_diffAndAnimate`), (2) a 360°
    loop-the-loop per winner ship (`_loopShip`), (3) a full-screen `<canvas>` cinematic
    (`_playWinCinematic`) — fireworks + a winning-fleet flyby with engine trails, all in the winner
    team color(s), over a dimmed backdrop — THEN `_renderFinished`. Re-renders during `'running'`
    are ignored; `prefers-reduced-motion`/low-CPU/`!_live` (projector opened after the game ended)
    skip straight to results. `_resetStage()` clears `_finishState` so a new game can replay it.
  - **Finished/winner screens** redesigned to a podium (medal + "Megtett táv") + full ranked
    scoreboard — `winner.js` (host/players, has the "Új küldetés" button) and `_renderFinished`
    (projector, same layout, no button). **Tie handling:** a single winner colors the whole podium
    in its team color; a TIE (≥2) uses a neutral GOLD (`#feb528`) medal/glow, a `border-image`
    gradient across all tied colors, and each winner name in its OWN team color (the scoreboard
    highlights every tied team). Avoids the old "only winners[0]'s color shows" look.
- **Scoring** (`scoring.js`): own team = "solved", another = "stolen", multiple = "shared"
  (points integer-split, remainder lost). Solving in phase 1 earns a boost. Reaching
  `settings.boardLength` sets `status='finished'` and short-circuits (boosts/traps/anomalies
  and next turn are skipped).
- **Boosts** (`boosts.js`, weighted draw, torpedo ~40%): torpedo, gravity trap, hyperdrive
  (`warp`), time dilation (`timewarp`), shield (passive, auto-blocks). Helpers compute
  "before" state from the passed-in `game` snapshot — chained calls on a stale `game` can
  clobber each other (that's why anomaly.js writes targeted paths, not the whole teams array).
- **Anomalies** (`anomaly.js`) on every **Nth** cell (`settings.anomalyEvery`, host-set at
  setup, default 5): supernova, wormhole, black hole, comms. `isAnomalyCell(cell, boardLength, every)`
  is the single source of truth — used by scoring.js and projector.js (so the marker and the
  trigger always agree). Number labels also mark anomaly cells regardless of N.
  Host-side `Math.random`, host-only DOM modals. Comms only sets `commDisruptionActive`;
  the actual behavior is enforced where that flag is read.
- **Security:** no auth. Firebase config (incl. apiKey) is committed; README tells operators
  to set RTDB rules to fully open read/write. Fine for a trusted classroom, not for public.
  There's a hidden admin gesture on the landing page (click `#admin-station`, type the
  password in `landing.js`) that calls `deleteAllGames()`.
- **Name uniqueness** is enforced only at join time, case-insensitive/trimmed.
- **Event log (`boostLog` / "Eseménynapló")** is the full play-by-play, written from many
  places: turn start (turn-manager `startNextTurn` + first turn in lobby), outcome + per-team
  movement (scoring solved/stolen/shared/unsolved, hyperdrive penalty, mission-complete),
  boost gain/use + effect (boosts.js), and anomaly + effect (anomaly.js). It is shown on the
  **projector**, so messages **never contain the secret word** — only task type, points, and
  score movements (`prev→new`). Append via `appendBoostLog()` in firebase-config — it now uses a
  Firebase **`runTransaction`** on `boostLog` so CONCURRENT writers (multiple phones + the host's
  turn-end) can't clobber each other (the old get()+update() read-modify-write could drop an
  entry). `addBoostLog(gameCode, game, msg)` is a thin wrapper (its `game` arg is now unused).
  **Torpedo logging:** a HIT still writes score+inventory+log in ONE atomic `updateGameData`
  (needed for the deferred-recoil choreography); a MISS/SHIELDED writes inventory then appends
  the log via the transactional `appendBoostLog` (no recoil → no atomicity needed). This fixed
  the "missed torpedo never appears in the log" bug — a clobbered miss left no trace, while a
  clobbered hit still showed its score drop.

---

## 8. Dev / preview notes

- `.claude/launch.json` runs a plain static server (`python -m http.server 5577`) for the
  Claude preview. **Do not** use a `no-store`/no-cache server here — the preview's live-reload
  loops on it. To test edited ES modules, cache-bust via `fetch(url, {cache:'reload'})`
  before reloading (the browser otherwise serves stale dynamically-imported modules).
- `docs/UI-SPEC.md` is the per-surface UI spec used to brief the redesign.

---

## 9. Recent major changes (2026-06)

- Full **Tailwind holographic redesign** of every view (was hand-written CSS).
- **Dedicated Join page** + in-game **Leave/End control** (players were previously trapped:
  session auto-restore re-entered the game with no way out).
- **Projector** rebuilt as a "Star Command HUD": header score badges, astrolabe timer,
  turn panel (word hidden), event log, and a **scalable, irregular star-chart board**.
- **Pruned `css/style.css`** from ~2020 → ~560 lines.
- Fixed the **"white/grey dashboard"** bug by removing `backdrop-filter` and giving
  `#bg-stars` a solid dark base (see §4).
- **Board redesign + animations (2026-06)**: projector board now uses the `img/` art
  (spaceships/planets/station/mine) and **animates** movement (ships fly along the path),
  boost usage, boost gains, and anomalies. Implemented via a persistent `_stage` + per-event
  FX (`boostLog[].fx`, score-diff, `anomalyEvent.type`). See §7 "Projector board engine".
- **Richer event log**: every turn start, outcome + per-team movement, boost gain/use+effect,
  and anomaly+effect are logged (word-free, since the projector shows it). `appendBoostLog`
  re-reads before append to avoid clobbering; `addBoostLog` takes an optional `fx` 4th arg.
- **Configurable anomaly density** (`settings.anomalyEvery`, host-set slider, default 5);
  `isAnomalyCell(cell, boardLength, every)` is the single source of truth (scoring + projector).
- **Host control** `#btn-next-player` (hand the pre-reveal turn to another teammate).
- **Board/animation polish**: slower timings; anomaly popup deferred until the landing move
  finishes; node art (Earth only at START, sparse planets, moons/nebulae); ships mirror to
  face their serpentine row's direction at rest (`_restHeading`); supernova blast behind the
  pushed ship; wormhole = shrink/teleport/grow; torpedo recoil waits for the explosion
  (atomic score+log write); dashboard task type shows its `fényév`; landing station hidden on phones.
- **Player boost tooltips**: `.boost-info` shows each boost's description on hover (PC) / tap (phone).
- **Win cinematic + results redesign (2026-06)**: the projector now plays a finish sequence —
  final move to the goal → winner-ship 360° loop → fireworks + winning-fleet flyby (engine trails in
  the winner color, dimmed backdrop) → results (`_finishState`-gated, see §7). Both the projector
  finished screen and `winner.js` were rebuilt to a podium + ranked-scoreboard HUD.
- **boostLog clobber fix**: `appendBoostLog` now uses a Firebase `runTransaction`; torpedo
  miss/shielded route through it (hit stays atomic). Fixes "missed torpedo not logged" under
  concurrent writes.
- **Two new databases** ("Általános" 200 words, "Mesterséges intelligencia" 10), **torpedo retune**
  (20%/-3, 30%/-2, 40%/-1, 10% miss), **phase rename** (Túltöltés fázis / Normál üzemmód), **manual
  lobby team-switching until launch**, dashboard active-astronaut display.
