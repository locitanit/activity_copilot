# RMG Astro-Activity — UI Specification

A real-time, multiplayer classroom quiz game with a **space / sci-fi ("Astro") theme**.
All copy is in **Hungarian**. Three device roles share one app but each sees a different screen:
the **Host Dashboard** (teacher), the **Projector** (public wall display), and the **Player device** (student phone).

---

## ⚡ Condensed brief (prompt-sized, for a UI designer AI)

> Design the UI for a Hungarian, space-themed multiplayer classroom quiz game ("Activity"-style: explain/draw/mime words). Dark cinematic sci-fi look — near-black background, neon cyan accents, glowing team colors, "Exo 2" font, animated starfields, black holes, a holographic mission-briefing screen, and a snake-shaped board through space toward "Proxima base". Three distinct surfaces:
>
> 1. **Host Dashboard (desktop, landscape)** — the teacher's command console; the only screen that shows the secret word. Flow: main menu → mission setup (teams, board length, topics, task types) → lobby (join code + live roster) → control panel. The control panel has a secret-word card, reveal/reroll, a phase-colored timer (start/pause/reset), per-team scoring buttons (+ "nobody"/"shared"), team boost inventories, and a collapsible sidebar with standings, upcoming words, and history. Plus a winner screen.
> 2. **Projector (large shared display, landscape, full black)** — public, read-only, and **must never show the secret word**. Shows team score badges, a big live timer + phase, turn info (active team/player, task type, points — but not the word), an event/boost ticker, and a snake board with team tokens, anomaly cells (🌀) and trap cells (🕳️).
> 3. **Player device (phone, portrait)** — role-aware; the whole screen is tinted in the player's team color. Shows a role badge (on a mission / decoder / observer), the fleet turn order, and a secret-word card that only reveals the word to the active player after the host reveals it (others see "hidden"). The active player gets boost-activation controls (torpedo, trap, hyperdrive, time-dilation; shield is passive).
>
> A persistent "Leave / End mission" control must be reachable from every in-game screen.

---

## Shared design language (applies to all three surfaces)

- **Mood:** dark, cinematic deep-space sci-fi. Near-black background (`#020510`), dark navy surfaces, neon glow accents.
- **Accent colors:** primary neon cyan `#00d4ff`; success green `#00e676`; warning amber `#ffd600`; danger red `#ff1744`. Text is pale blue `#cde8ff`, muted `#3d6a8a`.
- **Team (fleet) colors**, up to 6, always indexed the same way: red `#ef4444`, blue `#3b82f6`, green `#22c55e`, amber `#f59e0b`, purple `#a855f7`, pink `#ec4899`.
- **Typography:** "Exo 2" (Google Font), bold headings with wide letter-spacing.
- **Timer is color-coded into 3 phases** (used everywhere a timer appears): 🟢 Phase 1 = 0–30s "encrypted, own team only" · 🟡 Phase 2 = 30–60s "database link" · 🔴 Phase 3 = 60–90s "open frequency — STEALABLE". (Special modifiers: *time-dilation* extends phase 1 to 45s; *comm-disruption* makes the whole turn red/stealable.)
- **Motifs:** animated starfields, a pulsing black hole, wormholes, planets; a holographic "mission briefing" screen with scanline/flicker effects; a snake-shaped game board (a journey through space to "Proxima base").
- **Glossary** (so the designer reads the screens): *küldetés* = mission/game · *flotta* = fleet/team · *fényév* (light-year) = points · *asztronauta* = player · *Irányítóközpont* = control center (the host) · *adatcsomag* = the secret word / "data packet".

---

## 1. Host Dashboard — the teacher's screen

**Device:** desktop / laptop, landscape. One per game. This is the command console; it's the only screen that shows the secret word to the host and controls the game.

It moves through several states:

### 1a. Main menu (also the players' entry)
- Title + two big buttons: **Új küldetés** (new mission → setup) and **Csatlakozás kóddal** (join with code → join page).
- Decorative black hole + space station; animated starfield. (A hidden admin gesture wipes all games — not user-facing.)

### 1b. Mission setup (game configuration form)
- **Fleets:** number of teams (dropdown, 2–6); assignment mode toggle — **random** vs **manual** (pill radios); editable team-name rows, each with its color dot and a default name.
- **Star map:** board length slider (5–60, default 30) with live value readout — this is the distance to win.
- **Databases:** topic checkboxes, each showing its word count.
- **Mission types:** which task types are allowed (mime / draw / describe), as checkboxes.
- Actions: **Back** and **Launch control center** (creates the game).

### 1c. Lobby (host view)
- **Large, prominent join code** to share with the class.
- **Live roster** grouped into team columns, filling in real time as players join; an "unassigned" column; a player counter and the assignment-mode indicator.
- **Start mission** button (disabled until ≥1 player, and — in manual mode — everyone is on a team).
- **Leave/End control** (top-left): ends & deletes the mission.

### 1d. Control panel — Briefing state
- Full **holographic mission-briefing** card (story narrative + the 4 game rules).
- **Control-center status:** total players + per-team counts.
- **🚀 Launch first round** button (enabled once everyone's aboard).
- Leave/End control.

### 1e. Control panel — Playing state ← *the core dashboard*
- **Header bar:** End-mission button · game code · active team (color dot + name) + active player's name · **Projector menu** (open projector in a popup window / copy projector link).
- **Left column (primary controls):**
  - **Secret-word card** — the data packet: the word, the task type (mime/draw/describe), and its point value, framed in the active team's color.
  - **Reveal word** button (pushes the word to the active player's phone) + **Reroll** button (re-draw the word, before the timer starts).
  - **Timer card:** large phase-colored countdown + phase label, with **Start/Continue · Pause · Reset** buttons.
  - **Scoring panel:** one button per team ("*Team X decoded it*", +points; the active team marked ⭐, others marked ⚡ "stolen"); a **"Nobody solved it"** button; and a **shared-points** block (per-team checkboxes + "record shared points"). *Scoring is only enabled while the timer is paused or expired.*
  - **Fleet arsenals:** each team's collected boosts as labeled chips.
- **Right sidebar — collapsible "Detailed view":**
  - **Star-map standings:** per-team progress bars (score ÷ board length).
  - **Upcoming missions:** next 3 queued words.
  - **Past missions:** scrollable history with result badges (solved / stolen / shared / unsolved).

### 1f. Winner screen (shared with all surfaces)
- Trophy, winning team name(s) (handles ties), final scoreboard, **New mission** button (resets to menu).

---

## 2. Projector page — the public wall display

**Device:** large shared screen / projector, landscape, full-black canvas, designed to be read across a room. Opened by the host in a separate window. **Hard rule: it must NEVER display the secret word.** Read-only — no controls.

### 2a. Lobby
- Branding/logo, **giant join code**, colored badges for each team, "waiting for the mission to start".

### 2b. Briefing
- Static **holographic mission briefing** (same story + rules), with scanline/flicker sci-fi effects.

### 2c. Playing ← *main HUD*
- **Top header:** per-team **score badges** + the game code.
- **Boost-log strip** (only when active): the last few boost/anomaly events as a ticker.
- **Sidebar:** large **live timer** + phase label; an optional **anomaly-event box**; **turn info** = active team name, active player name, and — *only after the host reveals* — the task type and points. Before reveal it shows a "loading data packet…" placeholder. (The word itself is never shown.)
- **Snake board:** a boustrophedon (snake) path of numbered cells from **START 🚀** to **END / Proxima base ⭐**. Every 5th cell is an **anomaly cell 🌀**; trap cells show **🕳️**. **Team tokens** are colored circles bearing the team's initial, positioned along the path by score.
- **Anomaly overlay:** a full-screen modal appears while a random "space anomaly" event is resolving.

### 2d. Finished
- Trophy, winning team(s) in their color, full scoreboard (handles ties).

---

## 3. Player device — the student's phone

**Device:** mobile phone, **portrait**. One per student. Role-aware: what it shows depends on whether it's your turn.

### 3a. Join page (dedicated screen)
- **Mission-code** field (4 chars, auto-uppercased) + **astronaut name** field, **Enter/Join** button, **Back** button.

### 3b. Lobby (player view)
- Join code shown for confirmation.
- **Manual mode & not yet placed:** team-picker buttons (each with a live member count) to choose your fleet.
- **Otherwise:** your assigned team name (in its color) + list of teammates.
- "Waiting for control center" status.
- **Leave control** (top-left).

### 3c. Briefing
- The holographic mission briefing (same story/rules), "waiting for the control center's command".

### 3d. Playing ← *role-aware main screen*
The **entire screen is tinted with your team's color** (vertical gradient). Game-code badge top-right; Leave control top-left.
- **Role badge:** 🚀 *"You're on a mission!"* (you're the explainer) · 🔬 *"Decoder"* (a teammate is up — you guess) · 📡 *"Observer"* (another team's turn).
- **Fleet turn order:** your team listed in turn sequence — current player marked 🚀, next marked ▶, you highlighted with "(te)".
- **Status block:** your mission / the active fleet + active player name; the task type and points.
- **Secret-word card** (the key role-gated element):
  - Active player, after reveal → **"🤫 Only you can see it!"** + the big word.
  - Active player, before reveal → **"🚀 Get ready!"** (waiting for the host).
  - Everyone else → **"🙈 Secret word hidden"**.
- **Fleet arsenal (boosts):** only the **active player, before reveal and before the timer starts**, gets activation controls:
  - **Torpedo 🚀** — choose a target team + fire (knock a rival back).
  - **Gravity trap 🕳️** — enter a board cell number + place.
  - **Hyperdrive ⚡** — activate (double points on success).
  - **Time dilation ⏳** — activate (extends phase 1 to 45s).
  - **Shield 🛡️** — passive chip, auto-defends (never manually fired).
- **Collapsible "Detailed view":** the live timer + phase label, and the star-map standings (per-team progress bars).

### 3e. Winner (shared)
- Trophy, winner(s), scoreboard, **New mission** (returns to menu).

---

## Boost & anomaly icon set (for consistent iconography across surfaces)

- **Boosts:** torpedo 🚀, gravity trap 🕳️, hyperdrive/warp ⚡, time dilation ⏳, shield 🛡️.
- **Anomalies:** supernova ☄️, wormhole 🌀, black hole, comms disruption 📡.
