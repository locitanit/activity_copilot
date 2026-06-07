/**
 * views/projector.js – View 4/A: Kivetítő (STAR COMMAND HUD)
 * Publikus nézet az osztályterem falára vetítve. SOHA NEM mutatja a titkos szót.
 * Megnyitja: host via window.open('?role=projector&room=KÓD').
 *
 * A csillagtérkép (board) procedurálisan, a beállított boardLength alapján
 * skálázódik: a csomópontokat JS pozicionálja a panel méretéhez igazítva.
 */

import { state }                    from '../app.js';
import { getElapsedMs, getPhaseInfo, formatTime } from '../logic/timer.js';
import { isAnomalyCell }            from '../logic/anomaly.js';

const TEAM_COLORS = ['#ef4444','#3b82f6','#22c55e','#f59e0b','#a855f7','#ec4899'];
const SHIP_COLORS = ['red','blue','green','yellow','purple','pink']; // index = teamIndex
const PLANET_IMG  = ['img/planet1.png','img/planet2.png','img/planet3.png'];
const STATION_IMG = 'img/space_station.png';
const PHASE_HEX = { 'phase-0': '#bbc9cf', 'phase-1': '#00e676', 'phase-2': '#ffd600', 'phase-3': '#ff1744' };

let _timerInterval = null;
let _boardResizeObs = null;

// ── Perzisztens "stage" (csillagtérkép) állapot ───────────────
// A stage egy modul-szintű, leválasztott DOM-csomópont, amelyet minden
// pillanatképnél VISSZAfűzünk a #proj-board-area-ba (appendChild = MOZGATÁS,
// nem újraépítés), így a hajó-<img>-ek és a futó animációk túlélik a
// shell innerHTML újraépítését – ez teszi lehetővé a sima mozgásanimációt.
let _stage = null, _staticLayer = null, _shipsLayer = null, _fxLayer = null;
let _stageGameCode = null, _stageBoardLen = null, _stageTeamCount = null;
let _layout = null;            // { W,H,cx[],cy[],nd[],baseNode,shipW,shipH,numF,markF,enableFloat,showAllNums }
let _lastStaticSig = null;     // a statikus réteg utolsó "aláírása" (W,H,boardLen,csapdák)
let _shipEls = [], _shipCraft = []; // perzisztens hajó-wrapper / forgó-belső elemek
let _shipAnim = [];            // csapatonként { raf, cancel } | null (folyamatban lévő tween)
let _shipPos  = [];            // csapatonként { x, y } aktuális pixel-pozíció (közép)
let _targetCell = [];          // csapatonként a logikai célmező (egész)
let _shipOffset = [];          // csapatonként { dx, dy } stacking-eltolás
let _fxCursor = 0;             // boostLog "high-water" index (FX dedup)
let _anomalyCursor = 0;        // utolsó animált anomalyEvent.timestamp
let _commPrev = false;         // commDisruptionActive előző érték (felfutó él)
let _live = false;             // a baseline beállt-e (csatlakozás-játék-közben őr)
let _assetsKicked = false;     // képek előtöltése egyszer
let _lastGame = null;          // legutóbbi game snapshot (az anomália-felugró halasztásához)
const _reduced = (() => {
  try {
    const mm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lowCpu = (navigator.hardwareConcurrency || 4) <= 2;
    return !!(mm || lowCpu);
  } catch (_) { return false; }
})();

// ── Fő export ─────────────────────────────────────────────────
export function renderProjector(game) {
  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
  if (_boardResizeObs) { _boardResizeObs.disconnect(); _boardResizeObs = null; }

  const el = document.getElementById('view-projector');

  if (!game) {
    _resetStage();
    el.innerHTML = '<div class="h-screen flex items-center justify-center"><p class="text-on-surface-variant text-2xl">Játék nem található.</p></div>';
    return;
  }

  // Bármely nem-"playing" állapotban leállítjuk és eldobjuk a stage-et
  // (a rAF-loopok megszűnnek, nem ketyegnek leválasztott DOM-on – ez kezeli
  // a játék-vége animáció közben esetet is).
  if (game.status === 'lobby')    { _resetStage(); _renderLobby(el, game);    return; }
  if (game.status === 'briefing') { _resetStage(); _renderBriefing(el, game);  return; }
  if (game.status === 'finished') { _resetStage(); _renderFinished(el, game); return; }

  _renderPlaying(el, game);
}

// ── HUD sarokkeret + globális díszek ──────────────────────────
function _hudOrnaments() {
  return `
    <div class="fixed top-4 left-4 w-16 h-16 border-t-4 border-l-4 border-primary/40 z-50 pointer-events-none rounded-tl-xl"></div>
    <div class="fixed top-4 right-4 w-16 h-16 border-t-4 border-r-4 border-primary/40 z-50 pointer-events-none rounded-tr-xl"></div>
    <div class="fixed bottom-4 left-4 w-16 h-16 border-b-4 border-l-4 border-primary/40 z-50 pointer-events-none rounded-bl-xl"></div>
    <div class="fixed bottom-4 right-4 w-16 h-16 border-b-4 border-r-4 border-primary/40 z-50 pointer-events-none rounded-br-xl"></div>`;
}

// ── Lobby nézet ───────────────────────────────────────────────
function _renderLobby(el, game) {
  const teams    = game.teams || [];
  const gameCode = state.gameCode || '';

  el.innerHTML = `
    ${_hudOrnaments()}
    <div class="h-screen flex flex-col items-center justify-center text-center px-12">
      <div class="font-label-md text-label-md text-on-surface-variant uppercase tracking-[0.3em] mb-6">RMG Astro-Activity</div>
      <div class="font-body-lg text-body-lg text-primary-fixed-dim mb-4">Csatlakozz a küldetéshez a kóddal:</div>
      <div class="font-display-lg text-[7rem] leading-none text-primary tracking-[0.4rem] drop-shadow-[0_0_40px_rgba(0,212,255,0.6)] mb-12">${_esc(gameCode)}</div>
      <div class="flex gap-6 justify-center flex-wrap">
        ${teams.map((t, i) => `
          <div class="glass-panel px-7 py-3 flex items-center gap-3 border-l-4" style="border-color:${TEAM_COLORS[i]}">
            <span class="w-3 h-3 rounded-full" style="background:${TEAM_COLORS[i]};box-shadow:0 0 8px ${TEAM_COLORS[i]}"></span>
            <span class="font-headline-lg text-headline-lg text-white">${_esc(t.name)}</span>
          </div>`).join('')}
      </div>
      <div class="mt-12 font-label-md text-label-md text-on-surface-variant uppercase tracking-wider animate-pulse">Várakozás a küldetés kezdetére...</div>
    </div>
  `;
}

// ── Briefing nézet (kivetítő) – a meglévő hologram képernyő ────
function _renderBriefing(el, game) {
  el.innerHTML = `
    <div class="briefing-overlay briefing-projector">
      <div class="briefing-hologram">
        <div class="briefing-scanlines"></div>
        <div class="briefing-content">
          <div class="briefing-header-lines">
            <span class="briefing-line">&gt;&gt;&gt; BIZTONSÁGI PROTOKOLL: AKTÍV</span>
            <span class="briefing-line">&gt;&gt;&gt; HITELESÍTÉS: KÓDOLT CSATORNA</span>
            <span class="briefing-line">&gt;&gt;&gt; FELADÓ: HOUSTON IRÁNYÍTÓKÖZPONT</span>
            <span class="briefing-line">&gt;&gt;&gt; CÍMZETTEK: RMG ŰRFLOTTÁK – DIGITÁLIS KULTÚRA DIVÍZIÓ</span>
          </div>

          <h2 class="briefing-title">KADÉTOK! FIGYELEM!</h2>

          <p class="briefing-text">
            A 23. század legfontosabb tudásbázisa, a <strong>Radnóti Központi Archívum</strong> kritikus találatot kapott. A teljes Digitális Kultúra adatbázis megsemmisült, a fogalmak és kódok erősen titkosított adatcsomagok formájában szóródtak szét a mélyűrben. Ha ezek az adatok elvesznek, a galaxis technológiai sötétségbe borul.
          </p>
          <p class="briefing-text">
            Az Irányítóközpont titeket választott a mentőakcióra. A küldetés a következő: <strong>szeljétek át a galaxist, és érjétek el elsőként a biztonságos Proxima bázist!</strong> A hajtóművetek azonban csak akkor kap energiát, ha útközben sikeresen elfogjátok és dekódoljátok a sérült adatcsomagokat.
          </p>

          <div class="briefing-rules">
            <h3 class="briefing-rules-title">A KÜLDETÉS SZABÁLYAI:</h3>
            <div class="briefing-rule">
              <span class="briefing-rule-num">1</span>
              <div>
                <strong>DEKÓDOLÁS:</strong> A magas háttérsugárzás miatt a kommunikációs modulok tönkrementek. Az adatcsomagokat befogó asztronauta nem mondhatja ki a fogalmat! Csak alternatív módszerekkel (rajz, mutogatás, kódolt körülírás) adhatja át az információt a legénységének.
              </div>
            </div>
            <div class="briefing-rule">
              <span class="briefing-rule-num">2</span>
              <div>
                <strong>TITKOSÍTOTT CSATORNA (0-30 mp):</strong> A pajzsok még tartanak. Csak a saját flottád hallja az adást.
              </div>
            </div>
            <div class="briefing-rule">
              <span class="briefing-rule-num">3</span>
              <div>
                <strong>ADATBÁZIS KAPCSOLAT (30-60 mp):</strong> A hajó számítógépe engedélyezi a fizikai archívumok elérését – a flotta bevetheti a korábbi küldetések hajónaplóit!
              </div>
            </div>
            <div class="briefing-rule">
              <span class="briefing-rule-num">4</span>
              <div>
                <strong>NYÍLT FREKVENCIA (60-90 mp):</strong> A titkosítás összeomlik! Bármelyik rivális flotta lehallgathatja az adást, és ellophatja az energiát a saját hajtóművéhez.
              </div>
            </div>
          </div>

          <p class="briefing-text">
            Az űr nem biztonságos. A sikeres akciókért cserébe Houston fejlesztéseket küld, de vigyázzatok: a térség tele van instabil féreglyukakkal és anomáliákkal, amik pillanatok alatt átrendezhetik az erőviszonyokat.
          </p>

          <p class="briefing-text briefing-closing">
            A rendszerek élesítve. Sok szerencsét, Kadétok. A Radnóti Miklós Galaxis jövője a ti kezetekben van.
          </p>

          <div class="briefing-footer">
            <span class="briefing-line">&gt;&gt;&gt; ÜZENET VÉGE &lt;&lt;&lt;</span>
          </div>

          <p class="briefing-waiting">Várakozás az Irányítóközpont parancsára...</p>
        </div>
      </div>
    </div>
  `;
}

// ── Győztes nézet ─────────────────────────────────────────────
function _renderFinished(el, game) {
  const teams      = game.teams || [];
  const maxScore   = Math.max(...teams.map(t => t.score), 0);
  const winners    = teams.map((t, i) => ({ ...t, _idx: i })).filter(t => t.score === maxScore);

  el.innerHTML = `
    ${_hudOrnaments()}
    <div class="h-screen flex flex-col items-center justify-center text-center px-12">
      <div class="text-[7rem] leading-none mb-4">🏆</div>
      <div class="font-label-md text-label-md text-on-surface-variant uppercase tracking-[0.2em] mb-2">
        ${winners.length > 1 ? 'Győztes flották' : 'Győztes flotta'}
      </div>
      ${winners.map(w => `
        <div class="font-display-lg text-[4.5rem] leading-tight uppercase tracking-widest mb-2"
             style="color:${TEAM_COLORS[w._idx] || '#fbbf24'};text-shadow:0 0 50px ${TEAM_COLORS[w._idx] || '#fbbf24'}80">
          ${_esc(w.name)}
        </div>`).join('')}
      <div class="flex gap-6 justify-center flex-wrap mt-8">
        ${teams.map((t, i) => `
          <div class="glass-panel px-8 py-4 text-center border-2" style="border-color:${TEAM_COLORS[i]}">
            <div class="font-display-md text-[2.5rem] leading-none font-black" style="color:${TEAM_COLORS[i]}">${t.score}</div>
            <div class="font-body-md text-body-md text-on-surface-variant mt-1">${_esc(t.name)}</div>
          </div>`).join('')}
      </div>
    </div>
  `;
}

// ── Játék közbeni nézet (STAR COMMAND HUD) ─────────────────────
function _renderPlaying(el, game) {
  const currentTurn    = game.currentTurn || {};
  const teams          = game.teams       || [];
  const players        = game.players     || {};
  const timerStartedAt = currentTurn.timerStartedAt || null;
  const timerElapsedMs = currentTurn.timerElapsedMs || 0;
  const timeDilationActive    = !!currentTurn.timeDilationActive;
  const commDisruptionActive  = !!currentTurn.commDisruptionActive;
  const phaseInfo      = getPhaseInfo(timerStartedAt, timerElapsedMs, timeDilationActive, commDisruptionActive);
  const timerHasValue  = getElapsedMs(timerStartedAt, timerElapsedMs) > 0;
  const timerColor     = PHASE_HEX[phaseInfo.colorClass] || '#feb528';
  const boardLength    = game.settings?.boardLength || 30;
  const gameCode       = state.gameCode || '';

  const activeTeam    = teams[currentTurn.teamIndex] || {};
  const activeColor   = TEAM_COLORS[currentTurn.teamIndex] || '#888';
  const activePlayer  = currentTurn.activePlayerId ? (players[currentTurn.activePlayerId]?.name ?? '') : '';

  const labelText = timerStartedAt ? phaseInfo.label
    : (timerHasValue ? 'Adatátvitel szünetel' : (commDisruptionActive ? '📡 Kommunikációs zavar' : 'Várakozás...'));

  const hatch = "url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxwYXRoIGQ9Ik0wIDBMOCA4TTAgOEw4IDAiIHN0cm9rZT0iIzM2NDE0ZSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9zdmc+')";

  el.innerHTML = `
    ${_hudOrnaments()}
    <div class="h-screen flex flex-col p-6 gap-5">

      <!-- Header: score badges + code -->
      <header class="flex-shrink-0 flex justify-between items-start gap-4">
        <div class="flex gap-3 items-center flex-wrap">
          ${teams.map((t, i) => `
            <div class="glass-panel px-4 py-2 flex items-center gap-3 border-l-4" style="border-color:${TEAM_COLORS[i]}">
              <span class="w-3 h-3 rounded-full" style="background:${TEAM_COLORS[i]};box-shadow:0 0 8px ${TEAM_COLORS[i]}"></span>
              <div>
                <div class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider leading-none">${_esc(t.name)}</div>
                <div class="font-headline-lg text-headline-lg text-white leading-tight">${t.score} <span class="text-sm text-primary/70">fényév</span></div>
              </div>
            </div>`).join('')}
        </div>
        <div class="glass-panel px-6 py-3 flex flex-col items-end flex-shrink-0 border-r-4 border-primary">
          <div class="font-code-sm text-code-sm text-primary/60 uppercase tracking-widest">SESSION ID</div>
          <div class="font-display-md text-display-md text-primary tracking-[0.2em] drop-shadow-[0_0_10px_rgba(0,212,255,0.6)]">${_esc(gameCode)}</div>
        </div>
      </header>

      <!-- Main split: board + sidebar -->
      <div class="flex-1 flex gap-6 min-h-0">

        <!-- Board (immersive star chart) -->
        <div class="flex-1 glass-panel relative p-6 overflow-hidden">
          <div class="proj-hud-corner proj-hud-corner-tl"></div>
          <div class="proj-hud-corner proj-hud-corner-tr"></div>
          <div class="proj-hud-corner proj-hud-corner-bl"></div>
          <div class="proj-hud-corner proj-hud-corner-br"></div>
          <div class="absolute inset-0 nebula-bg"></div>
          <div id="proj-board-area" class="relative w-full h-full"></div>
        </div>

        <!-- Sidebar -->
        <div class="w-80 flex-shrink-0 flex flex-col gap-5 z-20 min-h-0">

          <!-- Astrolabe timer -->
          <div id="proj-timer-panel" class="glass-panel p-4 flex items-center justify-center relative overflow-hidden h-[210px] shrink-0 border-t-4" style="border-color:${timerColor}">
            <div class="absolute inset-0" style="background:${timerColor}0d"></div>
            <div class="astrolabe opacity-80">
              <div class="astrolabe-ring astrolabe-ring-1 proj-spin-slow"></div>
              <div class="astrolabe-ring astrolabe-ring-2 proj-spin-rev-slow"></div>
              <div class="astrolabe-ring astrolabe-ring-3 proj-spin-slow" style="animation-duration:8s"></div>
            </div>
            <div class="absolute inset-0 flex flex-col items-center justify-center">
              <div id="proj-label" class="font-code-sm text-code-sm uppercase tracking-[0.2em] mb-1 bg-background/80 px-2 rounded ${timerStartedAt ? 'animate-pulse' : ''}" style="color:${timerColor}">${_esc(labelText)}</div>
              <div id="proj-timer" class="font-display-lg text-[48px] leading-none tracking-widest font-bold" style="color:${timerColor};text-shadow:0 0 15px ${timerColor}cc">${formatTime(phaseInfo.secondsLeft)}</div>
            </div>
          </div>

          <!-- Turn info -->
          <div class="glass-panel p-5 flex flex-col border-l-4 shrink-0" style="border-color:${activeColor}">
            <div class="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest mb-4 pb-2 border-b border-primary/20 flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-sm">radar</span> Jelenlegi forduló
            </div>
            <div class="flex flex-col gap-4">
              <div>
                <div class="font-code-sm text-code-sm text-primary/60 uppercase mb-1">Aktív flotta</div>
                <div class="font-headline-lg text-headline-lg uppercase" style="color:${activeColor};text-shadow:0 0 8px ${activeColor}">${_esc(activeTeam.name || '–')}</div>
              </div>
              ${activePlayer ? `
              <div>
                <div class="font-code-sm text-code-sm text-primary/60 uppercase mb-1">Asztronauta</div>
                <div class="font-body-lg text-body-lg text-white flex items-center gap-2">
                  <span class="material-symbols-outlined text-primary/70">person</span> ${_esc(activePlayer)}
                </div>
              </div>` : ''}
              <div class="bg-surface-container/50 p-4 rounded-lg border border-primary/10">
                <div class="font-code-sm text-code-sm text-primary/60 uppercase mb-1">Feladat típusa</div>
                ${currentTurn.taskType && currentTurn.wordRevealed
                  ? `<div class="flex justify-between items-center">
                       <div class="font-headline-lg-mobile text-headline-lg-mobile" style="color:${activeColor}">${_esc(currentTurn.taskType)}</div>
                       <div class="px-2 py-1 bg-primary/10 rounded text-primary text-sm font-bold border border-primary/30">${currentTurn.points ?? '–'} FÉNYÉV</div>
                     </div>
                     <!-- A titkos szó SOSEM jelenik meg -->
                     <div class="mt-4 h-10 bg-surface-container-highest rounded-lg flex items-center justify-center opacity-50 relative overflow-hidden border border-outline-variant/30">
                       <div class="absolute inset-0" style="background-image:${hatch}"></div>
                       <span class="material-symbols-outlined text-outline-variant z-10 text-sm">visibility_off</span>
                     </div>`
                  : currentTurn.word && !currentTurn.wordRevealed
                    ? `<div class="font-body-lg text-body-lg text-primary/70 mt-1">Adatcsomag betöltése...</div>`
                    : `<div class="font-body-lg text-body-lg text-on-surface-variant mt-1">Kör hamarosan indul...</div>`
                }
              </div>
            </div>
          </div>

          ${game.anomalyEvent ? `
          <div class="glass-panel p-4 text-center border border-error/40 shrink-0">
            <div class="text-3xl mb-1">${_esc(game.anomalyEvent.emoji)}</div>
            <div class="font-headline-lg-mobile text-headline-lg-mobile text-error">${_esc(game.anomalyEvent.name)}</div>
            <div class="font-body-md text-body-md text-on-surface-variant mt-1">${_esc(game.anomalyEvent.specificDescription || '')}</div>
          </div>` : ''}

          <!-- Event log -->
          <div class="glass-panel p-4 flex-1 flex flex-col border-t-4 border-primary min-h-0">
            <div class="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest pb-2 border-b border-primary/20 flex items-center gap-2 shrink-0">
              <span class="material-symbols-outlined text-primary text-sm">history</span> Eseménynapló
            </div>
            <div class="flex-1 overflow-y-auto mt-3 flex flex-col gap-2 font-code-sm text-code-sm text-primary/80 pr-2">
              ${Array.isArray(game.boostLog) && game.boostLog.length > 0
                ? [...game.boostLog].reverse().slice(0, 30).map(e => `
                    <div class="flex items-start gap-2">
                      <div class="w-1.5 h-1.5 mt-1.5 rounded-full bg-primary shrink-0 shadow-[0_0_5px_#00d4ff]"></div>
                      <div>${_esc(e.message || '')}</div>
                    </div>`).join('')
                : '<div class="text-on-surface-variant">Nincs esemény még.</div>'}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // ── Perzisztens csillagtérkép-stage felfűzése + animációk ────
  const boardArea = document.getElementById('proj-board-area');
  if (boardArea) {
    _ensureStage(game, boardLength, teams.length);
    boardArea.appendChild(_stage);          // MOZGATÁS (nem újraépítés) → elemek túlélnek
    _layoutStage(game, boardLength);         // mérés + statikus réteg + hajóméretek
    if (!_live) {
      _baseline(game, boardLength);          // csatlakozás játék közben: snap, nincs visszajátszás
    } else {
      _diffAndAnimate(game, boardLength);    // mozgás (score-diff) + FX (boostLog/anomalyEvent)
    }
    if (typeof ResizeObserver !== 'undefined') {
      _boardResizeObs = new ResizeObserver(() => {
        if (_stage && document.getElementById('proj-board-area')) {
          _layoutStage(game, boardLength);   // csak újrapozicionál (reflow), nem épít hajót
        }
      });
      _boardResizeObs.observe(boardArea);
    }
  }

  // ── Anomália felugró ablak – KÉSLELTETVE: csak akkor jelenik meg,
  //    ha már nincs futó hajómozgás (előbb lássuk a mozgást, aztán a popupot).
  _lastGame = game;
  _syncAnomalyModal();

  // ── Helyi timer interval (UI frissítés) ───────────────────
  if (timerStartedAt) {
    _timerInterval = setInterval(() => {
      const timerEl = document.getElementById('proj-timer');
      const labelEl = document.getElementById('proj-label');
      if (!timerEl) { clearInterval(_timerInterval); _timerInterval = null; return; }

      const info = getPhaseInfo(timerStartedAt, timerElapsedMs, timeDilationActive, commDisruptionActive);
      const col  = PHASE_HEX[info.colorClass] || '#feb528';
      timerEl.innerHTML = formatTime(info.secondsLeft);
      timerEl.style.color = col;
      timerEl.style.textShadow = `0 0 15px ${col}cc`;
      if (labelEl) { labelEl.textContent = info.label; labelEl.style.color = col; }
      const panelEl = document.getElementById('proj-timer-panel');
      if (panelEl) panelEl.style.borderColor = col;
      if (info.phase >= 4) { clearInterval(_timerInterval); _timerInterval = null; }
    }, 1000);
  }
}

// ════════════════════════════════════════════════════════════════
//  Perzisztens csillagtérkép-motor (stage + hajók + FX)
// ════════════════════════════════════════════════════════════════

const _clampCell = (score, bl) => Math.min(Math.max(Math.round(score || 0), 0), bl);
const _easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const _now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

// Tiszta layout-számítás (a régi _layoutStarChart matematikája kiemelve) ──
function computeLayout(W, H, boardLength, seed) {
  const N = boardLength + 1;                       // 0 (START) .. boardLength (CÉL)
  let cols = Math.max(2, Math.round(Math.sqrt(N * (W / H))));
  cols = Math.max(2, Math.min(cols, N));
  const rows = Math.ceil(N / cols);
  const padX = W * 0.06, padY = H * 0.10;
  const cellW = (W - 2 * padX) / cols;
  const cellH = (H - 2 * padY) / rows;
  const baseNode = Math.max(11, Math.min(52, Math.min(cellW, cellH) * 0.46));
  const numF   = Math.max(8,  Math.min(13, baseNode * 0.32));
  const markF  = Math.max(11, Math.min(22, baseNode * 0.5));
  const enableFloat = baseNode >= 26;
  const showAllNums = baseNode >= 20;
  const shipW = Math.max(22, Math.min(66, baseNode * 1.7));
  const shipH = shipW * 0.58;

  const rnd = (i, salt) => {
    const s = seed + ':' + i + ':' + salt;
    let h = 2166136261;
    for (let k = 0; k < s.length; k++) { h ^= s.charCodeAt(k); h = Math.imul(h, 16777619); }
    h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
    return ((h >>> 0) % 100000) / 100000;
  };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const jit = 0.5;
  const cx = new Array(N), cy = new Array(N), nd = new Array(N);
  for (let i = 0; i < N; i++) {
    const rowFromBottom = Math.floor(i / cols);
    let col = i % cols;
    if (rowFromBottom % 2 === 1) col = cols - 1 - col;
    const bx = padX + (col + 0.5) * cellW;
    const by = H - (padY + (rowFromBottom + 0.5) * cellH);
    cx[i] = clamp(bx + (rnd(i, 'x') - 0.5) * cellW * jit, padX * 0.5, W - padX * 0.5);
    cy[i] = clamp(by + (rnd(i, 'y') - 0.5) * cellH * jit, padY * 0.5, H - padY * 0.5);
    let scale = 0.78 + rnd(i, 's') * 0.5;
    if (i === boardLength) scale = Math.max(scale, 1.25);
    nd[i] = baseNode * scale;
  }
  return { W, H, N, cx, cy, nd, baseNode, numF, markF, enableFloat, showAllNums, shipW, shipH, rnd };
}

// ── Stage életciklus ──────────────────────────────────────────
function _resetStage() {
  for (const a of _shipAnim) { if (a && a.cancel) { try { a.cancel(); } catch (_) {} } }
  if (_stage && _stage.parentNode) _stage.parentNode.removeChild(_stage);
  _stage = _staticLayer = _shipsLayer = _fxLayer = null;
  _stageGameCode = _stageBoardLen = _stageTeamCount = null;
  _layout = null; _lastStaticSig = null;
  _shipEls = []; _shipCraft = []; _shipAnim = []; _shipPos = []; _targetCell = []; _shipOffset = [];
  _fxCursor = 0; _anomalyCursor = 0; _commPrev = false; _live = false; _assetsKicked = false; _lastGame = null;
}

function _ensureStage(game, boardLength, teamCount) {
  const gc = state.gameCode || 'RMG';
  if (!_stage || _stageGameCode !== gc || _stageBoardLen !== boardLength || _stageTeamCount !== teamCount) {
    _resetStage();
    _buildStage(gc, boardLength, teamCount, game);
    _live = false;
  }
}

function _buildStage(gc, bl, tc, game) {
  _stage       = document.createElement('div'); _stage.className = 'proj-stage';
  _stage.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
  _staticLayer = document.createElement('div'); _staticLayer.className = 'proj-static';
  _staticLayer.style.cssText = 'position:absolute;inset:0;';
  _shipsLayer  = document.createElement('div'); _shipsLayer.className = 'proj-ships';
  _shipsLayer.style.cssText = 'position:absolute;inset:0;z-index:10;';
  _fxLayer     = document.createElement('div'); _fxLayer.className = 'proj-fx-layer';
  _fxLayer.style.cssText = 'position:absolute;inset:0;z-index:20;overflow:visible;';
  _stage.appendChild(_staticLayer); _stage.appendChild(_shipsLayer); _stage.appendChild(_fxLayer);

  _shipEls = []; _shipCraft = []; _shipAnim = []; _shipPos = []; _targetCell = []; _shipOffset = [];
  const teams = game.teams || [];
  for (let i = 0; i < tc; i++) {
    const color = SHIP_COLORS[i] || SHIP_COLORS[0];
    const wrap  = document.createElement('div');
    wrap.className = 'proj-ship';
    wrap.style.color = TEAM_COLORS[i] || '#fff';
    const craft = document.createElement('div'); craft.className = 'proj-ship-craft';
    const img   = document.createElement('img'); img.className = 'proj-ship-img';
    img.src = `img/spaceship_${color}.png`; img.alt = ''; img.decoding = 'async'; img.draggable = false;
    img.addEventListener('error', () => wrap.classList.add('proj-ship--noimg'), { once: true });
    craft.appendChild(img);
    wrap.title = (teams[i] && teams[i].name) || ('Csapat ' + (i + 1));
    wrap.appendChild(craft);
    _shipsLayer.appendChild(wrap);
    _shipEls[i] = wrap; _shipCraft[i] = craft; _shipAnim[i] = null;
    _shipPos[i] = null; _targetCell[i] = 0; _shipOffset[i] = { dx: 0, dy: 0 };
  }
  _stageGameCode = gc; _stageBoardLen = bl; _stageTeamCount = tc; _lastStaticSig = null;
  _preload(tc);
}

// ── Layout / pozicionálás minden pillanatképnél + resize-nál ──
function _layoutStage(game, boardLength) {
  const boardArea = document.getElementById('proj-board-area');
  if (!boardArea || !_stage) return;
  const rect = boardArea.getBoundingClientRect();
  const W = rect.width, H = rect.height;
  if (W < 20 || H < 20) return;

  _layout = computeLayout(W, H, boardLength, state.gameCode || 'RMG');

  // Statikus réteg újraépítése csak ha a méret / boardLength / csapdák / anomália-sűrűség változtak
  const traps = game.traps || {};
  const every = Math.max(1, parseInt(game.settings?.anomalyEvery, 10) || 5);
  const trapKeys = Object.keys(traps).filter(k => traps[k] !== undefined && traps[k] !== null).sort().join(',');
  const sig = `${Math.round(W)}x${Math.round(H)}|${boardLength}|${every}|${trapKeys}`;
  if (sig !== _lastStaticSig) {
    _staticLayer.innerHTML = _buildStaticHTML(_layout, boardLength, traps, every);
    _lastStaticSig = sig;
  }

  // Hajóméretek
  for (let i = 0; i < _shipEls.length; i++) {
    const w = _shipEls[i]; if (!w) continue;
    w.style.width = _layout.shipW.toFixed(1) + 'px';
    w.style.height = _layout.shipH.toFixed(1) + 'px';
  }

  // Pihenő hajók újrapozicionálása (a repülő hajók a következő frame-ben
  // önmaguktól igazodnak az élő _layout-hoz).
  _applyStacking();
}

function _buildStaticHTML(layout, boardLength, traps, anomalyEvery) {
  const { N, cx, cy, nd, numF, markF, enableFloat, showAllNums, rnd } = layout;
  let html = '';

  for (let i = 1; i < N; i++) {
    const dx = cx[i] - cx[i - 1], dy = cy[i] - cy[i - 1];
    const len = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx) * 180 / Math.PI;
    html += `<div class="constellation-line" style="left:${cx[i-1].toFixed(1)}px;top:${cy[i-1].toFixed(1)}px;width:${len.toFixed(1)}px;transform:rotate(${ang.toFixed(2)}deg)"></div>`;
  }

  for (let i = 0; i < N; i++) {
    const isStart   = i === 0;
    const isEnd     = i === boardLength;
    const isAnomaly = isAnomalyCell(i, boardLength, anomalyEvery);
    const isTrap    = traps[String(i)] !== undefined && traps[String(i)] !== null;
    const d = nd[i];

    let cls = 'stellar-node';
    if (isEnd) cls += ' active';
    else if (isAnomaly) cls += ' hazard';
    else if (isTrap) cls += ' special';
    if (enableFloat) cls += ' proj-float';
    const delay = enableFloat ? `animation-delay:${(rnd(i, 'd') * -6).toFixed(1)}s;` : '';

    const left = (cx[i] - d / 2).toFixed(1);
    const top  = (cy[i] - d / 2).toFixed(1);

    // Csomópont-dekoráció:
    //  - START (0) = Föld (planet1), KIZÁRÓLAG itt
    //  - CÉL = űrállomás
    //  - anomália = üres (izzó pötty) + hazard halo + 🌀 (a teljes örvény csak FX-kor)
    //  - sima mező = ritkán Jupiter/Szaturnusz, gyakran hold / köd / üres (mint régen)
    const innerDot = () => {
      const iD = Math.max(5, Math.min(16, d * 0.28));
      return `<div class="node-inner" style="width:${iD.toFixed(1)}px;height:${iD.toFixed(1)}px"></div>`;
    };
    let media;
    if (isEnd) {
      media = `<div class="proj-station"><img src="${STATION_IMG}" alt="" draggable="false"></div>`;
    } else if (isStart) {
      media = `<img class="proj-planet proj-planet-earth" src="img/planet1.png" alt="" draggable="false">`;
    } else if (isAnomaly) {
      media = innerDot();
    } else {
      const r = rnd(i, 'decor');
      if (r < 0.075)      media = `<img class="proj-planet" src="img/planet2.png" alt="" draggable="false">`;       // Jupiter – ritka
      else if (r < 0.15)  media = `<img class="proj-planet" src="img/planet3.png" alt="" draggable="false">`;       // Szaturnusz – ritka
      else if (r < 0.40)  media = `<div class="proj-moon" style="width:${(d*0.70).toFixed(1)}px;height:${(d*0.70).toFixed(1)}px"></div>`;
      else if (r < 0.62)  media = `<div class="proj-nebula" style="width:${(d*1.18).toFixed(1)}px;height:${(d*1.18).toFixed(1)}px"></div>`;
      else                media = innerDot();
    }
    const mine   = isTrap ? `<img class="proj-mine" src="img/mine.png" alt="" draggable="false">` : '';
    const marker = isAnomaly
      ? `<span class="proj-node-label" style="top:${(-markF - 2).toFixed(0)}px;font-size:${markF.toFixed(0)}px">🌀</span>`
      : '';

    const wantNum = showAllNums || isStart || isEnd || isAnomaly || i % 5 === 0;
    const numColor = isEnd ? '#a8e8ff' : isAnomaly ? 'rgba(255,180,171,0.85)' : isTrap ? 'rgba(254,181,40,0.9)' : 'rgba(168,232,255,0.6)';
    const numEl = wantNum
      ? `<span class="proj-node-label" style="top:${(d + 2).toFixed(0)}px;font-size:${(isEnd ? numF * 1.3 : numF).toFixed(0)}px;font-weight:700;color:${numColor}">${i}</span>`
      : '';

    let tag = '';
    if (isStart) tag = `<span class="proj-node-label" style="top:${(-numF - 10).toFixed(0)}px;font-size:${numF.toFixed(0)}px;letter-spacing:0.1em;color:rgba(168,232,255,0.7)">START</span>`;
    else if (isEnd) tag = `<span class="proj-node-label" style="top:${(d + numF * 1.3 + 6).toFixed(0)}px;font-size:${numF.toFixed(0)}px;letter-spacing:0.1em;color:rgba(168,232,255,0.7)">CÉL</span>`;

    html += `<div class="${cls}" style="left:${left}px;top:${top}px;width:${d.toFixed(1)}px;height:${d.toFixed(1)}px;${delay}">${media}${mine}${marker}${numEl}${tag}</div>`;
  }
  return html;
}

// ── Baseline (csatlakozás játék közben: snap, nincs visszajátszás) ──
function _baseline(game, boardLength) {
  const teams = game.teams || [];
  for (let i = 0; i < _shipEls.length; i++) {
    _targetCell[i] = _clampCell(teams[i] ? teams[i].score : 0, boardLength);
    _shipPos[i] = null;
  }
  _applyStacking();                                  // beállítja az offseteket + leteszi a hajókat
  _fxCursor = Array.isArray(game.boostLog) ? game.boostLog.length : 0;
  _anomalyCursor = (game.anomalyEvent && game.anomalyEvent.timestamp) || 0;
  _commPrev = !!(game.currentTurn && game.currentTurn.commDisruptionActive);
  _live = true;
}

// ── Diff + animáció (mozgás score-diffből, FX broadcast-mezőkből) ──
function _diffAndAnimate(game, boardLength) {
  const teams = game.teams || [];

  // 1) Mozgás: minden csapatra, ha a cél-mező változott
  for (let i = 0; i < _shipEls.length; i++) {
    const cell = _clampCell(teams[i] ? teams[i].score : 0, boardLength);
    if (cell !== _targetCell[i]) _tweenShip(i, cell);
  }
  _applyStacking();

  // 2) FX: boostLog "fx" bejegyzések leürítése a kurzortól
  const log = Array.isArray(game.boostLog) ? game.boostLog : [];
  if (_fxCursor > log.length) _fxCursor = log.length;   // front-trim védelem
  for (let k = _fxCursor; k < log.length; k++) {
    const e = log[k];
    if (e && e.fx) _spawnFx(e.fx, game, boardLength);
  }
  _fxCursor = log.length;

  // 3) Anomália FX (timestamp-kapuval)
  const ev = game.anomalyEvent;
  if (ev && ev.timestamp && ev.timestamp > _anomalyCursor) {
    _spawnAnomalyFx(ev, game, boardLength);
    _anomalyCursor = ev.timestamp;
  }

  // 4) Kommunikációs zavar felfutó éle
  const comm = !!(game.currentTurn && game.currentTurn.commDisruptionActive);
  if (comm && !_commPrev) _fxComms();
  _commPrev = comm;
}

// ── Geometria-segédek ─────────────────────────────────────────
function _cellXY(cell) {
  if (!_layout) return { x: 0, y: 0 };
  const c = Math.min(Math.max(cell | 0, 0), _layout.N - 1);
  return { x: _layout.cx[c], y: _layout.cy[c] };
}
function _closestCell(x, y) {
  if (!_layout) return 0;
  let best = 0, bestD = Infinity;
  for (let c = 0; c < _layout.N; c++) {
    const dx = _layout.cx[c] - x, dy = _layout.cy[c] - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}
function _pointAlongCells(cells, p) {
  const pts = cells.map(c => _cellXY(c));
  if (pts.length === 1) return { x: pts[0].x, y: pts[0].y, heading: 0 };
  const segs = []; let total = 0;
  for (let k = 1; k < pts.length; k++) {
    const dx = pts[k].x - pts[k - 1].x, dy = pts[k].y - pts[k - 1].y;
    const len = Math.hypot(dx, dy) || 0.0001;
    segs.push({ dx, dy, len, x0: pts[k - 1].x, y0: pts[k - 1].y });
    total += len;
  }
  let d = p * total;
  for (let k = 0; k < segs.length; k++) {
    const s = segs[k];
    if (d <= s.len || k === segs.length - 1) {
      const t = Math.max(0, Math.min(1, d / s.len));
      return { x: s.x0 + s.dx * t, y: s.y0 + s.dy * t, heading: Math.atan2(s.dy, s.dx) * 180 / Math.PI };
    }
    d -= s.len;
  }
  const last = segs[segs.length - 1];
  return { x: last.x0 + last.dx, y: last.y0 + last.dy, heading: Math.atan2(last.dy, last.dx) * 180 / Math.PI };
}

// ── Hajó-pozicionálás ─────────────────────────────────────────
function _setShipTransform(i, x, y, heading, thrust) {
  const w = _shipEls[i], craft = _shipCraft[i];
  if (!w || !_layout) return;
  const sw = _layout.shipW, sh = _layout.shipH;
  w.style.transform = `translate(${(x - sw / 2).toFixed(1)}px, ${(y - sh / 2).toFixed(1)}px)`;
  if (craft) {
    const flip = Math.abs(heading) > 90 ? -1 : 1;     // sose fejre állítva
    craft.style.transform = `rotate(${heading.toFixed(1)}deg) scaleY(${flip})`;
    if (thrust) craft.classList.add('proj-ship--thrusting');
    else craft.classList.remove('proj-ship--thrusting');
  }
}
function _placeShip(i) {
  if (_shipAnim[i]) return;                            // repülő hajót nem bántunk
  const c = _cellXY(_targetCell[i] || 0);
  const o = _shipOffset[i] || { dx: 0, dy: 0 };
  _shipPos[i] = { x: c.x + o.dx, y: c.y + o.dy };
  _setShipTransform(i, c.x + o.dx, c.y + o.dy, 0, false);
}
function _applyStacking() {
  if (!_layout) return;
  const byCell = {};
  for (let i = 0; i < _shipEls.length; i++) {
    const cell = _targetCell[i] || 0;
    (byCell[cell] = byCell[cell] || []).push(i);
  }
  const R = _layout.baseNode * 0.55;
  Object.keys(byCell).forEach(cell => {
    const arr = byCell[cell];
    if (arr.length <= 1) { _shipOffset[arr[0]] = { dx: 0, dy: 0 }; }
    else {
      arr.forEach((i, j) => {
        const ang = (j / arr.length) * Math.PI * 2 - Math.PI / 2;
        _shipOffset[i] = { dx: Math.cos(ang) * R, dy: Math.sin(ang) * R };
      });
    }
  });
  for (let i = 0; i < _shipEls.length; i++) _placeShip(i);
}

// ── Hajó-tween (repülés a csomópont-poligon mentén) ───────────
function _tweenShip(i, toCell) {
  if (!_layout) return;
  if (_shipAnim[i]) { _shipAnim[i].cancel(); _shipAnim[i] = null; }
  _targetCell[i] = toCell;
  if (_reduced) { _placeShip(i); return; }

  const startPos = _shipPos[i] || _cellXY(toCell);
  const nearest  = _shipPos[i] ? _closestCell(startPos.x, startPos.y) : toCell;
  const dir = toCell > nearest ? 1 : (toCell < nearest ? -1 : 0);
  const cells = [nearest];
  if (dir !== 0) { for (let c = nearest + dir; ; c += dir) { cells.push(c); if (c === toCell) break; } }
  const steps = Math.max(1, cells.length - 1);
  const dur = Math.min(4000, Math.max(900, 330 * steps));   // lassabb repülés
  const craft = _shipCraft[i];
  const offset = _shipOffset[i] || { dx: 0, dy: 0 };
  const start = _now();

  const tick = (now) => {
    const handle = _shipAnim[i];
    if (!handle) return;
    const p = Math.min(1, (now - start) / dur);
    const e = _easeInOutCubic(p);
    const pt = _pointAlongCells(cells, e);
    const offT = Math.max(0, (e - 0.8) / 0.2);          // stack-offset behúzása a végén
    const x = pt.x + offset.dx * offT, y = pt.y + offset.dy * offT;
    _setShipTransform(i, x, y, pt.heading, true);
    _shipPos[i] = { x, y };
    if (p < 1) { handle.raf = requestAnimationFrame(tick); }
    else { _shipAnim[i] = null; _placeShip(i); _syncAnomalyModal(); }   // mozgás kész → jöhet a felugró
  };
  _shipAnim[i] = {
    raf: requestAnimationFrame(tick),
    cancel() { cancelAnimationFrame(this.raf); if (craft) craft.classList.remove('proj-ship--thrusting'); },
  };
}

// ── Anomália-felugró kezelése (előbb a mozgás, aztán a popup) ──
function _anyShipAnimating() { return _shipAnim.some(a => !!a); }

function _buildAnomalyModalEl(game) {
  const teams = game.teams || [];
  const p = game.anomalyPending;
  const pColor = TEAM_COLORS[p.triggeredByTeamIndex] || '#888';
  const pTeamName = _esc((teams[p.triggeredByTeamIndex] || {}).name || '');
  const overlay = document.createElement('div');
  overlay.className = 'anomaly-modal-overlay';
  overlay.innerHTML = `
      <div class="anomaly-modal anomaly-modal--projector">
        <div class="anomaly-modal-emoji">${_esc(p.emoji)}</div>
        <div class="anomaly-modal-header">⚠ Űranomália észlelve</div>
        <div class="anomaly-modal-title">${_esc(p.name)}</div>
        <div class="anomaly-modal-team" style="color:${_esc(pColor)}">${pTeamName} flotta anomáliára lépett</div>
        <div class="anomaly-modal-general">${_esc(p.generalDescription)}</div>
        <div class="anomaly-modal-body">${_esc(p.specificDescription)}</div>
      </div>`;
  return overlay;
}

// Megjeleníti/elrejti az anomália-felugrót a legutóbbi snapshot + a futó
// animációk alapján: csak akkor jelenik meg, ha van anomalyPending ÉS nincs
// futó hajómozgás. A hajó-tween befejezésekor (és minden rendernél) meghívódik.
function _syncAnomalyModal() {
  const el = document.getElementById('view-projector');
  if (!el) return;
  const pending = _lastGame && _lastGame.anomalyPending;
  const existing = el.querySelector('.anomaly-modal-overlay');
  if (!pending || _anyShipAnimating()) { if (existing) existing.remove(); return; }
  if (!existing) el.appendChild(_buildAnomalyModalEl(_lastGame));
}

// ════════════════════════════════════════════════════════════════
//  FX – átmeneti animációk a #proj-fx rétegen
// ════════════════════════════════════════════════════════════════
function _shipXY(i) {
  if (_shipPos[i]) return _shipPos[i];
  return _cellXY(_targetCell[i] || 0);
}
function _expSize() { return Math.max(40, (_layout ? _layout.baseNode : 24) * 2.2); }

function _fxSprite(x, y, src, size, animClass, ttl) {
  if (!_fxLayer) return;
  const d = document.createElement('div');
  d.className = 'proj-fx ' + animClass;
  d.style.left = (x - size / 2).toFixed(1) + 'px';
  d.style.top  = (y - size / 2).toFixed(1) + 'px';
  d.style.width = size.toFixed(1) + 'px';
  d.style.height = size.toFixed(1) + 'px';
  if (src) d.style.backgroundImage = `url(${src})`;
  _fxLayer.appendChild(d);
  const done = () => { if (d.parentNode) d.parentNode.removeChild(d); };
  d.addEventListener('animationend', done, { once: true });
  setTimeout(done, ttl || 2000);
  return d;
}
function _fxRing(x, y, size, color, animClass, ttl) {
  const d = _fxSprite(x, y, null, size, animClass, ttl);
  if (d && color) d.style.color = color;   // a CSS currentColor-t használ a keret/glow-hoz
  return d;
}

function _fxExplosion(x, y, size) { _fxSprite(x, y, 'img/explosion.png', size || _expSize(), 'fx-explode', 1300); }
function _fxSupernova(x, y) {
  _fxSprite(x, y, 'img/explosion.png', _expSize() * 1.35, 'fx-explode fx-nova', 1350);
  _fxRing(x, y, _expSize() * 1.7, '#fff3c4', 'fx-shockwave', 1450);
}
function _fxWormhole(x, y) { _fxSprite(x, y, 'img/wormhole.png', _expSize() * 1.3, 'fx-wormhole', 2350); }
function _fxBlackhole(x, y) { _fxSprite(x, y, 'img/black_hole.png', _expSize() * 1.5, 'fx-blackhole', 2650); }
function _fxMineDrop(x, y) { _fxSprite(x, y, 'img/mine.png', Math.max(26, (_layout ? _layout.baseNode : 24) * 0.95), 'fx-mine-drop', 1500); }
function _fxBoostPulse(x, y, color) { _fxRing(x, y, Math.max(44, (_layout ? _layout.baseNode : 24) * 1.9), color || '#ffd45e', 'fx-boost', 1450); }
function _fxShield(x, y) { _fxRing(x, y, Math.max(42, (_layout ? _layout.baseNode : 24) * 1.7), '#5fe0ff', 'fx-shield', 1400); }
function _fxWarp(x, y, color) { _fxRing(x, y, Math.max(52, (_layout ? _layout.baseNode : 24) * 2.1), color || '#00d4ff', 'fx-warp', 1450); }
function _fxTimewarp(x, y) {
  _fxRing(x, y, Math.max(52, (_layout ? _layout.baseNode : 24) * 2.1), '#c79cff', 'fx-timewarp', 1700);
  const panel = document.getElementById('proj-timer-panel');
  if (panel) { panel.classList.add('proj-timewarp-pulse'); setTimeout(() => panel.classList.remove('proj-timewarp-pulse'), 1650); }
}
function _fxComms() {
  if (!_fxLayer) return;
  const d = document.createElement('div');
  d.className = 'proj-fx proj-fx-comms';
  _fxLayer.appendChild(d);
  const done = () => { if (d.parentNode) d.parentNode.removeChild(d); };
  d.addEventListener('animationend', done, { once: true });
  setTimeout(done, 2450);
}
function _fxHit(i) {
  const craft = _shipCraft[i]; if (!craft) return;
  craft.classList.add('proj-ship--hit'); setTimeout(() => craft.classList.remove('proj-ship--hit'), 950);
}
function _fxStun(i) {
  const craft = _shipCraft[i]; if (!craft) return;
  craft.classList.add('proj-ship--stunned'); setTimeout(() => craft.classList.remove('proj-ship--stunned'), 1850);
}
function _fxBounce(i) {
  const craft = _shipCraft[i]; if (!craft) return;
  craft.classList.add('proj-ship--bounce'); setTimeout(() => craft.classList.remove('proj-ship--bounce'), 720);
}
function _fxTorpedo(from, to, outcome, targetIdx) {
  if (_reduced || !_fxLayer) {
    if (outcome === 'hit') { _fxExplosion(to.x, to.y); _fxHit(targetIdx); }
    else if (outcome === 'shielded') { _fxShield(to.x, to.y); }
    return;
  }
  const size = Math.max(28, (_layout ? _layout.baseNode : 24) * 1.3);
  let dest = to, extend = false;
  if (outcome === 'miss') {
    const dx = to.x - from.x, dy = to.y - from.y, L = Math.hypot(dx, dy) || 1;
    dest = { x: to.x + dx / L * size * 2.4, y: to.y + dy / L * size * 2.4 }; extend = true;
  }
  const bearing = Math.atan2(dest.y - from.y, dest.x - from.x) * 180 / Math.PI;
  const h = size * 0.27;
  const el = document.createElement('div');
  el.className = 'proj-fx proj-torpedo';
  el.style.width = size.toFixed(1) + 'px'; el.style.height = h.toFixed(1) + 'px';
  el.style.backgroundImage = 'url(img/torpedo.png)'; el.style.left = '0'; el.style.top = '0';
  _fxLayer.appendChild(el);
  const dist = Math.hypot(dest.x - from.x, dest.y - from.y);
  const dur = Math.min(1400, Math.max(420, dist * 2.2));   // lassabb torpedó
  const start = _now();
  const step = (now) => {
    if (!el.isConnected) { if (el.parentNode) el.parentNode.removeChild(el); return; }
    const p = Math.min(1, (now - start) / dur);
    const x = from.x + (dest.x - from.x) * p, y = from.y + (dest.y - from.y) * p;
    const fade = extend ? Math.max(0, 1 - (p - 0.6) / 0.4) : 1;
    el.style.transform = `translate(${(x - size / 2).toFixed(1)}px, ${(y - h / 2).toFixed(1)}px) rotate(${bearing.toFixed(1)}deg)`;
    el.style.opacity = String(fade);
    if (p < 1) { requestAnimationFrame(step); }
    else {
      if (el.parentNode) el.parentNode.removeChild(el);
      if (outcome === 'hit') { _fxExplosion(to.x, to.y); _fxHit(targetIdx); }
      else if (outcome === 'shielded') { _fxShield(to.x, to.y); }
    }
  };
  requestAnimationFrame(step);
}

function _spawnFx(fx, game, bl) {
  if (!_layout || !_fxLayer || !fx) return;
  switch (fx.kind) {
    case 'boost_gain': { const p = _shipXY(fx.team); _fxBoostPulse(p.x, p.y, TEAM_COLORS[fx.team]); _fxBounce(fx.team); break; }
    case 'torpedo':    { _fxTorpedo(_shipXY(fx.team), _shipXY(fx.target), fx.outcome, fx.target); break; }
    case 'trap_place': { const p = _cellXY(_clampCell(fx.cell, bl)); _fxMineDrop(p.x, p.y); break; }
    case 'trap_trigger': { const p = _cellXY(_clampCell(fx.cell, bl)); _fxExplosion(p.x, p.y); if (fx.team != null) _fxStun(fx.team); break; }
    case 'shield_block': { const p = (fx.cell != null) ? _cellXY(_clampCell(fx.cell, bl)) : _shipXY(fx.team); _fxShield(p.x, p.y); break; }
    case 'warp':     { const p = _shipXY(fx.team); _fxWarp(p.x, p.y, TEAM_COLORS[fx.team]); break; }
    case 'timewarp': { const p = _shipXY(fx.team); _fxTimewarp(p.x, p.y); break; }
  }
}
function _spawnAnomalyFx(ev, game, bl) {
  if (!_layout || !_fxLayer || !ev) return;
  const teams = game.teams || [];
  const ti = ev.triggeredByTeamIndex;
  const cell = (ti != null && teams[ti]) ? _clampCell(teams[ti].score, bl) : Math.floor(bl / 2);
  const p = _cellXY(cell);
  switch (ev.type) {
    case 'supernova': _fxSupernova(p.x, p.y); break;
    case 'wormhole':  _fxWormhole(p.x, p.y); break;
    case 'blackhole': _fxBlackhole(p.x, p.y); break;
    case 'comms':     break;  // a comms FX-et a commDisruptionActive felfutó éle indítja (nincs dupla)
    default:          _fxSupernova(p.x, p.y);
  }
}

function _preload(teamCount) {
  if (_assetsKicked) return; _assetsKicked = true;
  const list = [...PLANET_IMG, STATION_IMG, 'img/torpedo.png', 'img/explosion.png',
    'img/mine.png', 'img/wormhole.png', 'img/black_hole.png'];
  for (let i = 0; i < (teamCount || 6); i++) list.push(`img/spaceship_${SHIP_COLORS[i] || SHIP_COLORS[0]}.png`);
  list.forEach(src => { const im = new Image(); im.src = src; });
}

// ── XSS védelem ───────────────────────────────────────────────
function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
