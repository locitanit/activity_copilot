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
js/logic/   turn-manager.js  → turn rotation, word draw, next-player, reroll
   │        timer.js         → pure phase/countdown math (pausable via timerElapsedMs)
   │        scoring.js       → award/stolen/shared points, win check, advance turn
   │        anomaly.js       → 4 random "space anomaly" events (every 5th cell)
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
  the **boost chips** (`.boost-chip*`), the host **projector dropdown** (`.proj-menu*`),
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
              boardLength, selectedTopics[], allowedTaskTypes[] },
  players: { <pushId>: { name, teamIndex:-1, turnCount:0 } },     // MAP; teamIndex -1 = unassigned
  teams:   [ { name, score:0, inventory:[], skipNextTurn:false } ], // ARRAY, indexed by teamIndex
  currentTurn: { word, taskType, points, teamIndex, activePlayerId,
                 timerStartedAt, timerElapsedMs, wordRevealed,
                 hyperdriveActive, timeDilationActive, commDisruptionActive },
  upcomingTurns: [],   // queue, refilled to 3
  turnHistory:   [],   // entries: result 'solved'|'stolen'|'shared'|'unsolved', winnerTeamIndex, ...
  traps:    { <cell>: true },
  boostLog: [],        // capped to last 10; shown on projector event log
  anomalyPending, anomalyEvent   // transient anomaly broadcast to the projector
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
| Host game | `host-game.js` | briefing / playing | `#btn-launch-game`, `#btn-reveal-word`, `#btn-reroll`, `#hg-timer`/`#hg-label`/`#hg-ring`, `#btn-start-timer`/`#btn-pause-timer`/`#btn-reset-timer`, `.score-btn[data-team]`, `#btn-no-score`, `.shared-score-check`/`#btn-award-shared`, `#host-details-toggle`/`#host-details-section`, `.proj-menu*`, `.boost-chip*`, `#btn-leave-game` |
| Projector | `projector.js` | lobby/briefing/playing/finished | `#proj-board-area`, `#proj-timer`/`#proj-label`/`#proj-timer-panel`, `.stellar-node`/`.constellation-line`/`.proj-token` |
| Player game | `player-game.js` | briefing / playing | `#pg-timer`/`#pg-label`/`#pg-ring`, `#pg-details-toggle`/`#pg-details-section`, `.boost-activate-row`, `.torpedo-target-sel`/`.torpedo-fire-btn`, `.trap-cell-input`/`.trap-place-btn`, `.warp-btn`, `.timewarp-btn` (all `[data-bidx]`), `#btn-leave-game` |
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
- **Projector board scaling** (`projector.js _layoutStarChart`): the board is generated
  procedurally for `boardLength+1` cells on a serpentine skeleton, with **seeded
  jitter + varied star sizes** for an irregular constellation look. Seed = `gameCode + cell
  index` → the shape is **stable across re-renders/score updates** (only tokens move) and
  unique per game. Node/token/label sizes scale down as the board grows; re-lays out on a
  `ResizeObserver`. Verified at boardLength 5 / 30 / 60.
- **Scoring** (`scoring.js`): own team = "solved", another = "stolen", multiple = "shared"
  (points integer-split, remainder lost). Solving in phase 1 earns a boost. Reaching
  `settings.boardLength` sets `status='finished'` and short-circuits (boosts/traps/anomalies
  and next turn are skipped).
- **Boosts** (`boosts.js`, weighted draw, torpedo ~40%): torpedo, gravity trap, hyperdrive
  (`warp`), time dilation (`timewarp`), shield (passive, auto-blocks). Helpers compute
  "before" state from the passed-in `game` snapshot — chained calls on a stale `game` can
  clobber each other (that's why anomaly.js writes targeted paths, not the whole teams array).
- **Anomalies** (`anomaly.js`) on every 5th cell: supernova, wormhole, black hole, comms.
  Host-side `Math.random`, host-only DOM modals. Comms only sets `commDisruptionActive`;
  the actual behavior is enforced where that flag is read.
- **Security:** no auth. Firebase config (incl. apiKey) is committed; README tells operators
  to set RTDB rules to fully open read/write. Fine for a trusted classroom, not for public.
  There's a hidden admin gesture on the landing page (click `#admin-station`, type the
  password in `landing.js`) that calls `deleteAllGames()`.
- **Name uniqueness** is enforced only at join time, case-insensitive/trimmed.

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
