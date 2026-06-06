/**
 * views/projector.js – View 4/A: Kivetítő (STAR COMMAND HUD)
 * Publikus nézet az osztályterem falára vetítve. SOHA NEM mutatja a titkos szót.
 * Megnyitja: host via window.open('?role=projector&room=KÓD').
 * Holografikus HUD dizájn (Tailwind + Material Symbols).
 */

import { state }                    from '../app.js';
import { getElapsedMs, getPhaseInfo, getTotalSeconds, formatTime } from '../logic/timer.js';

const TEAM_COLORS = ['#ef4444','#3b82f6','#22c55e','#f59e0b','#a855f7','#ec4899'];
const PHASE_HEX = { 'phase-0': '#bbc9cf', 'phase-1': '#00e676', 'phase-2': '#ffd600', 'phase-3': '#ff1744' };

let _timerInterval = null;

// ── Fő export ─────────────────────────────────────────────────
export function renderProjector(game) {
  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }

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
    <div class="fixed top-4 left-4 w-16 h-16 border-t-4 border-l-4 border-primary/40 z-50 pointer-events-none"></div>
    <div class="fixed top-4 right-4 w-16 h-16 border-t-4 border-r-4 border-primary/40 z-50 pointer-events-none"></div>
    <div class="fixed bottom-4 left-4 w-16 h-16 border-b-4 border-l-4 border-primary/40 z-50 pointer-events-none"></div>
    <div class="fixed bottom-4 right-4 w-16 h-16 border-b-4 border-r-4 border-primary/40 z-50 pointer-events-none"></div>`;
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
  const totalSeconds   = getTotalSeconds(timeDilationActive, commDisruptionActive) || 1;
  const timerColor     = PHASE_HEX[phaseInfo.colorClass] || '#feb528';
  const barPct         = Math.max(0, Math.min(100, (phaseInfo.secondsLeft / totalSeconds) * 100));
  const boardLength    = game.settings?.boardLength || 30;
  const gameCode       = state.gameCode || '';

  const activeTeam    = teams[currentTurn.teamIndex] || {};
  const activeColor   = TEAM_COLORS[currentTurn.teamIndex] || '#888';
  const activePlayer  = currentTurn.activePlayerId ? (players[currentTurn.activePlayerId]?.name ?? '') : '';

  const labelText = timerStartedAt ? phaseInfo.label
    : (timerHasValue ? 'Adatátvitel szünetel' : (commDisruptionActive ? '📡 Kommunikációs zavar' : 'Várakozás...'));

  el.innerHTML = `
    ${_hudOrnaments()}
    <div class="h-screen flex flex-col p-6 pb-0 gap-5">

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
        <div class="glass-panel px-6 py-3 flex flex-col items-end flex-shrink-0">
          <div class="font-code-sm text-code-sm text-primary/60 uppercase tracking-widest">SESSION ID</div>
          <div class="font-display-md text-display-md text-primary tracking-[0.2em] drop-shadow-[0_0_10px_rgba(0,212,255,0.6)]">${_esc(gameCode)}</div>
        </div>
      </header>

      <!-- Main split: board + sidebar -->
      <div class="flex-1 flex gap-6 min-h-0">

        <!-- Board -->
        <div class="flex-1 glass-panel relative p-6 flex items-center justify-center overflow-hidden">
          <div class="proj-hud-corner proj-hud-corner-tl"></div>
          <div class="proj-hud-corner proj-hud-corner-tr"></div>
          <div class="proj-hud-corner proj-hud-corner-bl"></div>
          <div class="proj-hud-corner proj-hud-corner-br"></div>
          ${_renderSnakeBoard(teams, boardLength, game.traps || {})}
        </div>

        <!-- Sidebar -->
        <div class="w-80 flex-shrink-0 flex flex-col gap-5">

          <!-- Timer -->
          <div class="glass-panel p-6 flex flex-col items-center justify-center border-t-4 relative overflow-hidden" style="border-color:${timerColor}">
            <div id="proj-label" class="font-code-sm text-code-sm uppercase tracking-[0.2em] mb-2 ${timerStartedAt ? 'animate-pulse' : ''}" style="color:${timerColor}">${_esc(labelText)}</div>
            <div id="proj-timer" class="font-display-lg text-[64px] leading-none tracking-widest font-bold" style="color:${timerColor};text-shadow:0 0 15px ${timerColor}99">${formatTime(phaseInfo.secondsLeft)}</div>
            <div class="w-full h-2 mt-4 bg-surface-container rounded-sm overflow-hidden">
              <div id="proj-bar" class="h-full rounded-sm" style="width:${barPct}%;background:${timerColor};box-shadow:0 0 6px ${timerColor};transition:width 1s linear"></div>
            </div>
          </div>

          ${game.anomalyEvent ? `
          <div class="glass-panel p-5 text-center border border-error/40">
            <div class="text-4xl mb-1">${_esc(game.anomalyEvent.emoji)}</div>
            <div class="font-headline-lg-mobile text-headline-lg-mobile text-error">${_esc(game.anomalyEvent.name)}</div>
            <div class="font-body-md text-body-md text-on-surface-variant mt-1">${_esc(game.anomalyEvent.specificDescription || '')}</div>
            <div class="font-label-md text-label-md mt-1" style="color:${TEAM_COLORS[game.anomalyEvent.triggeredByTeamIndex] || '#888'}">
              ${_esc((teams[game.anomalyEvent.triggeredByTeamIndex] || {}).name || '')}
            </div>
          </div>` : ''}

          <!-- Turn info -->
          <div class="glass-panel p-6 flex-1 flex flex-col border-l-4" style="border-color:${activeColor}">
            <div class="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest mb-5 pb-2 border-b border-primary/20 flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-sm">radar</span> Jelenlegi forduló
            </div>
            <div class="flex flex-col gap-5">
              <div>
                <div class="font-code-sm text-code-sm text-primary/60 uppercase mb-1">Aktív flotta</div>
                <div class="font-display-md text-display-md uppercase" style="color:${activeColor};text-shadow:0 0 8px ${activeColor}">${_esc(activeTeam.name || '–')}</div>
              </div>
              ${activePlayer ? `
              <div>
                <div class="font-code-sm text-code-sm text-primary/60 uppercase mb-1">Asztronauta</div>
                <div class="font-body-lg text-body-lg text-white flex items-center gap-2">
                  <span class="material-symbols-outlined text-primary/70">person</span> ${_esc(activePlayer)}
                </div>
              </div>` : ''}
              <div class="mt-auto bg-surface-container/50 p-4 rounded border border-primary/10">
                <div class="font-code-sm text-code-sm text-primary/60 uppercase mb-1">Feladat típusa</div>
                ${currentTurn.taskType && currentTurn.wordRevealed
                  ? `<div class="flex justify-between items-center">
                       <div class="font-headline-lg-mobile text-headline-lg-mobile" style="color:${activeColor}">${_esc(currentTurn.taskType)}</div>
                       <div class="px-2 py-1 bg-primary/10 rounded text-primary text-sm font-bold border border-primary/30">${currentTurn.points ?? '–'} FÉNYÉV</div>
                     </div>
                     <!-- A titkos szó SOSEM jelenik meg -->
                     <div class="mt-4 h-8 bg-surface-container-highest rounded flex items-center justify-center opacity-50">
                       <span class="material-symbols-outlined text-outline-variant text-sm">visibility_off</span>
                     </div>`
                  : currentTurn.word && !currentTurn.wordRevealed
                    ? `<div class="font-body-lg text-body-lg text-primary/70 mt-1">Adatcsomag betöltése...</div>`
                    : `<div class="font-body-lg text-body-lg text-on-surface-variant mt-1">Kör hamarosan indul...</div>`
                }
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Ticker -->
      ${Array.isArray(game.boostLog) && game.boostLog.length > 0 ? `
      <div class="h-12 glass-panel flex items-center overflow-hidden border-t border-b border-primary/20 relative -mx-6 w-screen flex-shrink-0">
        <div class="px-4 bg-primary text-on-primary font-label-md text-label-md flex items-center h-full shadow-[4px_0_10px_rgba(0,0,0,0.5)] whitespace-nowrap tracking-wider z-10">BOOST LOG</div>
        <div class="flex-1 overflow-hidden h-full relative">
          <div class="absolute inset-0 flex items-center whitespace-nowrap animate-marquee font-code-sm text-code-sm">
            ${[...game.boostLog].reverse().slice(0, 8).map(e => `<span class="mx-8 text-primary/80">◆ ${_esc(e.message || '')}</span>`).join('')}
          </div>
        </div>
      </div>` : '<div class="h-6 flex-shrink-0"></div>'}
    </div>
  `;

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
      const barEl   = document.getElementById('proj-bar');
      if (!timerEl) { clearInterval(_timerInterval); _timerInterval = null; return; }

      const info = getPhaseInfo(timerStartedAt, timerElapsedMs, timeDilationActive, commDisruptionActive);
      const col  = PHASE_HEX[info.colorClass] || '#feb528';
      timerEl.innerHTML = formatTime(info.secondsLeft);
      timerEl.style.color = col;
      timerEl.style.textShadow = `0 0 15px ${col}99`;
      if (labelEl) { labelEl.textContent = info.label; labelEl.style.color = col; }
      if (barEl) {
        barEl.style.width = Math.max(0, Math.min(100, (info.secondsLeft / totalSeconds) * 100)) + '%';
        barEl.style.background = col;
        barEl.style.boxShadow = `0 0 6px ${col}`;
      }
      if (info.phase >= 4) { clearInterval(_timerInterval); _timerInterval = null; }
    }, 1000);
  }
}

// ── Kígyótábla renderelés (hex cellák) ────────────────────────
function _renderSnakeBoard(teams, boardLength, traps = {}) {
  let cols;
  if      (boardLength <= 12) cols = 4;
  else if (boardLength <= 20) cols = 5;
  else if (boardLength <= 32) cols = 6;
  else if (boardLength <= 49) cols = 7;
  else                        cols = 8;

  const teamAt = {};
  teams.forEach((t, i) => {
    const cellNum = Math.min(Math.max(t.score, 0), boardLength);
    if (!teamAt[cellNum]) teamAt[cellNum] = [];
    teamAt[cellNum].push(i);
  });

  const totalRows = Math.ceil((boardLength + 1) / cols);
  let html = '<div class="flex flex-col gap-2 items-stretch">';

  for (let d = 0; d < totalRows; d++) {
    const r = totalRows - 1 - d;       // board row (0 = start at bottom)
    const ltr = r % 2 === 0;           // even rows left→right
    const align = d % 2 === 0 ? 'justify-end pr-6' : 'justify-start pl-6';
    html += `<div class="flex gap-1.5 ${align}">`;
    for (let c = 0; c < cols; c++) {
      const cellNum = ltr ? r * cols + c : r * cols + (cols - 1 - c);
      if (cellNum > boardLength) continue;

      const isStart   = cellNum === 0;
      const isEnd     = cellNum === boardLength;
      const isAnomaly = cellNum % 5 === 0 && cellNum > 0 && cellNum < boardLength;
      const isTrap    = traps[String(cellNum)] !== undefined;
      const tokens    = teamAt[cellNum] || [];

      let cls = 'proj-hex';
      if (isStart)        cls += ' proj-hex--start';
      else if (isEnd)     cls += ' proj-hex--end';
      else if (isAnomaly) cls += ' proj-hex--anomaly';
      else if (isTrap)    cls += ' proj-hex--trap';

      html += `<div class="${cls}">`;
      if (isTrap)    html += '<span class="proj-hex-mark">🕳️</span>';
      if (isAnomaly) html += '<span class="proj-hex-mark">🌀</span>';
      if (isStart)      html += '<span class="proj-hex-num">🚀</span>';
      else if (isEnd)   html += '<span class="proj-hex-num">⭐</span>';
      else              html += `<span class="proj-hex-num">${cellNum}</span>`;
      if (tokens.length) {
        html += '<div class="proj-token-row">';
        for (const ti of tokens) {
          const initial = teams[ti].name.charAt(0).toUpperCase();
          html += `<div class="proj-token" style="background:${TEAM_COLORS[ti]};color:${TEAM_COLORS[ti]}" title="${_esc(teams[ti].name)}"><span style="color:#fff">${initial}</span></div>`;
        }
        html += '</div>';
      }
      html += '</div>';
    }
    html += '</div>';
  }
  html += '</div>';
  return html;
}

// ── XSS védelem ───────────────────────────────────────────────
function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
