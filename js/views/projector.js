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

const TEAM_COLORS = ['#ef4444','#3b82f6','#22c55e','#f59e0b','#a855f7','#ec4899'];
const PHASE_HEX = { 'phase-0': '#bbc9cf', 'phase-1': '#00e676', 'phase-2': '#ffd600', 'phase-3': '#ff1744' };

let _timerInterval = null;
let _boardResizeObs = null;

// ── Fő export ─────────────────────────────────────────────────
export function renderProjector(game) {
  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
  if (_boardResizeObs) { _boardResizeObs.disconnect(); _boardResizeObs = null; }

  const el = document.getElementById('view-projector');

  if (!game) {
    el.innerHTML = '<div class="h-screen flex items-center justify-center"><p class="text-on-surface-variant text-2xl">Játék nem található.</p></div>';
    return;
  }

  if (game.status === 'lobby')    { _renderLobby(el, game);    return; }
  if (game.status === 'briefing') { _renderBriefing(el, game);  return; }
  if (game.status === 'finished') { _renderFinished(el, game); return; }

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
                ? [...game.boostLog].reverse().slice(0, 14).map(e => `
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

  // ── Csillagtérkép kirajzolása (mérés + pozicionálás) ─────────
  const boardArea = document.getElementById('proj-board-area');
  if (boardArea) {
    const doLayout = () => _layoutStarChart(boardArea, teams, boardLength, game.traps || {});
    doLayout();
    if (typeof ResizeObserver !== 'undefined') {
      _boardResizeObs = new ResizeObserver(() => doLayout());
      _boardResizeObs.observe(boardArea);
    }
  }

  // ── Anomália pending overlay (a meglévő modal stílus) ──────────
  if (game.anomalyPending) {
    const p         = game.anomalyPending;
    const pColor    = TEAM_COLORS[p.triggeredByTeamIndex] || '#888';
    const pTeamName = _esc((teams[p.triggeredByTeamIndex] || {}).name || '');
    const overlay   = document.createElement('div');
    overlay.className = 'anomaly-modal-overlay';
    overlay.innerHTML = `
      <div class="anomaly-modal anomaly-modal--projector">
        <div class="anomaly-modal-emoji">${_esc(p.emoji)}</div>
        <div class="anomaly-modal-header">⚠ Űranomália észlelve</div>
        <div class="anomaly-modal-title">${_esc(p.name)}</div>
        <div class="anomaly-modal-team" style="color:${_esc(pColor)}">${pTeamName} flotta anomáliára lépett</div>
        <div class="anomaly-modal-general">${_esc(p.generalDescription)}</div>
        <div class="anomaly-modal-body">${_esc(p.specificDescription)}</div>
      </div>
    `;
    el.appendChild(overlay);
  }

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

// ── Csillagtérkép layout (skálázódik a boardLength szerint) ────
function _layoutStarChart(boardArea, teams, boardLength, traps) {
  const rect = boardArea.getBoundingClientRect();
  const W = rect.width, H = rect.height;
  if (W < 20 || H < 20) return;

  const N = boardLength + 1; // cellák: 0 (START) .. boardLength (CÉL)

  // Oszlopszám a panel képarányához igazítva, szerpentin elrendezés
  let cols = Math.max(2, Math.round(Math.sqrt(N * (W / H))));
  cols = Math.max(2, Math.min(cols, N));
  const rows = Math.ceil(N / cols);

  const padX = W * 0.06, padY = H * 0.10;
  const cellW = (W - 2 * padX) / cols;
  const cellH = (H - 2 * padY) / rows;

  const baseNode = Math.max(11, Math.min(52, Math.min(cellW, cellH) * 0.46));
  const tokenD = Math.max(13, Math.min(28, baseNode * 0.55));
  const numF   = Math.max(8,  Math.min(13, baseNode * 0.32));
  const markF  = Math.max(11, Math.min(22, baseNode * 0.5));
  const enableFloat = baseNode >= 26;
  // Sűrű táblán csak az 5-ös mezőkre + start/cél írunk számot
  const showAllNums = baseNode >= 20;

  // Determinisztikus ál-véletlen: a tábla "szabálytalan" csillagtérkép-alakja
  // stabil egy adott játékkódra (frissítéskor csak a tokenek mozognak).
  const seed = state.gameCode || 'RMG';
  const rnd = (i, salt) => {
    const s = seed + ':' + i + ':' + salt;
    let h = 2166136261;
    for (let k = 0; k < s.length; k++) { h ^= s.charCodeAt(k); h = Math.imul(h, 16777619); }
    h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
    return ((h >>> 0) % 100000) / 100000;
  };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // Csapatok a mezőkön
  const teamAt = {};
  teams.forEach((t, i) => {
    const c = Math.min(Math.max(t.score, 0), boardLength);
    (teamAt[c] = teamAt[c] || []).push(i);
  });

  // Csomópont-középpontok + méretek (jitterrel – szabálytalan elrendezés)
  const jit = 0.5;
  const cx = new Array(N), cy = new Array(N), nd = new Array(N);
  for (let i = 0; i < N; i++) {
    const rowFromBottom = Math.floor(i / cols);
    let col = i % cols;
    if (rowFromBottom % 2 === 1) col = cols - 1 - col; // szerpentin alap
    const bx = padX + (col + 0.5) * cellW;
    const by = H - (padY + (rowFromBottom + 0.5) * cellH);
    cx[i] = clamp(bx + (rnd(i, 'x') - 0.5) * cellW * jit, padX * 0.5, W - padX * 0.5);
    cy[i] = clamp(by + (rnd(i, 'y') - 0.5) * cellH * jit, padY * 0.5, H - padY * 0.5);
    let scale = 0.78 + rnd(i, 's') * 0.5;          // 0.78 .. 1.28 (változó csillagméret)
    if (i === boardLength) scale = Math.max(scale, 1.25); // a cél nagyobb
    nd[i] = baseNode * scale;
  }

  let html = '';

  // Összekötő vonalak (egymást követő csomópontok között)
  for (let i = 1; i < N; i++) {
    const dx = cx[i] - cx[i - 1], dy = cy[i] - cy[i - 1];
    const len = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx) * 180 / Math.PI;
    html += `<div class="constellation-line" style="left:${cx[i-1].toFixed(1)}px;top:${cy[i-1].toFixed(1)}px;width:${len.toFixed(1)}px;transform:rotate(${ang.toFixed(2)}deg)"></div>`;
  }

  // Csomópontok
  for (let i = 0; i < N; i++) {
    const isStart   = i === 0;
    const isEnd     = i === boardLength;
    const isAnomaly = i % 5 === 0 && i > 0 && i < boardLength;
    const isTrap    = traps[String(i)] !== undefined;
    const d = nd[i];

    let cls = 'stellar-node';
    if (isEnd) cls += ' active';
    else if (isAnomaly) cls += ' hazard';
    else if (isTrap) cls += ' special';
    if (enableFloat) cls += ' proj-float';
    const delay = enableFloat ? `animation-delay:${(rnd(i, 'd') * -6).toFixed(1)}s;` : '';

    const left = (cx[i] - d / 2).toFixed(1);
    const top  = (cy[i] - d / 2).toFixed(1);
    const iD   = Math.max(5, Math.min(16, d * 0.28)) * (isEnd ? 1.4 : 1);

    const inner = `<div class="node-inner" style="width:${iD.toFixed(1)}px;height:${iD.toFixed(1)}px"></div>`;

    // Marker (anomália / csapda / cél) a csomópont fölött
    const mEmoji = isTrap ? '🕳️' : isAnomaly ? '🌀' : isEnd ? '⭐' : '';
    const marker = mEmoji
      ? `<span class="proj-node-label" style="top:${(-markF - 2).toFixed(0)}px;font-size:${markF.toFixed(0)}px">${mEmoji}</span>`
      : '';

    // Szám a csomópont alatt
    const wantNum = showAllNums || isStart || isEnd || i % 5 === 0;
    const numColor = isEnd ? '#a8e8ff' : isAnomaly ? 'rgba(255,180,171,0.7)' : isTrap ? 'rgba(254,181,40,0.75)' : 'rgba(168,232,255,0.55)';
    const numEl = wantNum
      ? `<span class="proj-node-label" style="top:${(d + 2).toFixed(0)}px;font-size:${(isEnd ? numF * 1.3 : numF).toFixed(0)}px;font-weight:700;color:${numColor}">${i}</span>`
      : '';

    // START / CÉL feliratok
    let tag = '';
    if (isStart) tag = `<span class="proj-node-label" style="top:${(-numF - 10).toFixed(0)}px;font-size:${numF.toFixed(0)}px;letter-spacing:0.1em;color:rgba(168,232,255,0.6)">START</span>`;
    else if (isEnd) tag = `<span class="proj-node-label" style="top:${(d + numF * 1.3 + 6).toFixed(0)}px;font-size:${numF.toFixed(0)}px;letter-spacing:0.1em;color:rgba(168,232,255,0.6)">CÉL</span>`;

    // Tokenek a csomópont közepén
    let tokens = '';
    const here = teamAt[i] || [];
    if (here.length) {
      tokens = `<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;gap:2px;z-index:10">`
        + here.map(ti => {
            const initial = teams[ti].name.charAt(0).toUpperCase();
            return `<div class="proj-token" style="position:static;width:${tokenD.toFixed(0)}px;height:${tokenD.toFixed(0)}px;font-size:${(tokenD*0.5).toFixed(0)}px;background:${TEAM_COLORS[ti]};color:${TEAM_COLORS[ti]}" title="${_esc(teams[ti].name)}"><span style="color:#fff">${initial}</span></div>`;
          }).join('')
        + `</div>`;
    }

    html += `<div class="${cls}" style="left:${left}px;top:${top}px;width:${d.toFixed(1)}px;height:${d.toFixed(1)}px;${delay}">${inner}${marker}${numEl}${tag}${tokens}</div>`;
  }

  boardArea.innerHTML = html;
}

// ── XSS védelem ───────────────────────────────────────────────
function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
