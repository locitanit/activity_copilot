/**
 * views/projector.js – View 4/A: Kivetítő (teljes implementáció)
 * ────────────────────────────────────────────────────────────────
 * Publikus nézet az osztályterem falára vetítve.
 * SOHA NEM mutatja a titkos szót.
 * Megnyitja: host via window.open('?role=projector&room=KÓD')
 *
 * Layout (1280×720):
 *   ┌─────────────────────────────────────────────────┐
 *   │  [Piros:3] [Kék:1] [Zöld:0]        KÓD: ABCDEF │  ← header
 *   │                                                 │
 *   │   01:23          🎭 Kék csapat                  │  ← main
 *   │  (timer)         Péter                          │
 *   │                  [ Mutogatás ]                  │
 *   │                  ⭐ 4 pont                       │
 *   │                                                 │
 *   │  ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━●     │  ← board
 *   └─────────────────────────────────────────────────┘
 */

import { state }                    from '../app.js';
import { getElapsedMs, getPhaseInfo, formatTime } from '../logic/timer.js';

const TEAM_COLORS = ['#ef4444','#3b82f6','#22c55e','#f59e0b','#a855f7','#ec4899'];

let _timerInterval = null;

// ── Fő export ─────────────────────────────────────────────────
export function renderProjector(game) {
  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }

  const el = document.getElementById('view-projector');

  if (!game) {
    el.innerHTML = '<p style="margin:auto;color:#555;font-size:1.5rem">Játék nem található.</p>';
    return;
  }

  if (game.status === 'lobby')    { _renderLobby(el, game);    return; }
  if (game.status === 'briefing') { _renderBriefing(el, game);  return; }
  if (game.status === 'finished') { _renderFinished(el, game); return; }

  _renderPlaying(el, game);
}

// ── Lobby nézet ───────────────────────────────────────────────
function _renderLobby(el, game) {
  const teams    = game.teams || [];
  const gameCode = state.gameCode || '';

  el.innerHTML = `
    <div style="margin:auto;text-align:center;color:#fff;width:100%;max-width:900px;padding:2rem">
      <div style="font-size:1rem;color:#333;text-transform:uppercase;
                  letter-spacing:0.2em;margin-bottom:1.5rem">
        RMG Astro-Activity
      </div>
      <div style="font-size:1.1rem;color:#3d6a8a;margin-bottom:0.75rem">
        Csatlakozz a küldetéshez a kóddal:
      </div>
      <div style="font-size:5rem;font-weight:900;letter-spacing:0.7rem;
                  color:var(--primary);margin-bottom:2.5rem;
                  text-shadow:0 0 40px rgba(0,212,255,0.6)">
        ${_esc(gameCode)}
      </div>
      <div style="display:flex;gap:1.5rem;justify-content:center;flex-wrap:wrap">
        ${teams.map((t, i) => `
          <div style="background:${TEAM_COLORS[i]};border-radius:12px;
                      padding:0.75rem 1.75rem;font-size:1.3rem;font-weight:700;color:#fff">
            ${_esc(t.name)}
          </div>`).join('')}
      </div>
      <div style="margin-top:2.5rem;color:#3d6a8a;font-size:1rem">
        Várakozás a küldetés kezdetére...
      </div>
    </div>
  `;
}

// ── Briefing nézet (kivetítő) ─────────────────────────────────
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
    <div style="margin:auto;text-align:center;color:#fff;width:100%;max-width:900px">
      <div style="font-size:6rem;margin-bottom:1rem">🏆</div>
      <div style="font-size:1.2rem;color:#3d6a8a;margin-bottom:0.5rem;text-transform:uppercase;
                  letter-spacing:0.15em">${winners.length > 1 ? 'Győztes flották' : 'Győztes flotta'}</div>
      ${winners.map(w => `
        <div style="font-size:4.5rem;font-weight:900;
                    color:${TEAM_COLORS[w._idx] || '#fbbf24'};margin-bottom:${winners.length > 1 ? '0.5rem' : '2.5rem'};
                    text-shadow:0 0 50px ${TEAM_COLORS[w._idx] || '#fbbf24'}80">
          ${_esc(w.name)}
        </div>`).join('')}
      <div style="margin-bottom:2rem"></div>
      <div style="display:flex;gap:1.5rem;justify-content:center;flex-wrap:wrap">
        ${teams.map((t, i) => `
          <div style="background:var(--surface);border:2px solid ${TEAM_COLORS[i]};
                      border-radius:12px;padding:1rem 2rem;text-align:center">
            <div style="font-size:2.5rem;font-weight:900;color:${TEAM_COLORS[i]}">${t.score}</div>
            <div style="font-size:1rem;color:#3d6a8a;margin-top:0.25rem">${_esc(t.name)}</div>
          </div>`).join('')}
      </div>
    </div>
  `;
}

// ── Játék közbeni nézet ────────────────────────────────────────
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
  const boardLength    = game.settings?.boardLength || 30;
  const gameCode       = state.gameCode || '';

  const activeTeam    = teams[currentTurn.teamIndex] || {};
  const activeColor   = TEAM_COLORS[currentTurn.teamIndex] || '#888';
  const activePlayer  = currentTurn.activePlayerId
    ? (players[currentTurn.activePlayerId]?.name ?? '')
    : '';

  el.innerHTML = `
    <!-- ── Fejléc: pontszámok + kód ──────────────────────── -->
    <div class="projector-header">
      <div class="projector-scores">
        ${teams.map((t, i) => `
          <div class="score-badge" style="background:${TEAM_COLORS[i]}">
            ${_esc(t.name)}&nbsp;
            <span style="font-size:1.3rem">${t.score}</span>
          </div>`).join('')}
      </div>
      <div style="color:#444;font-size:0.9rem;letter-spacing:0.15em;font-weight:600">
        ${_esc(gameCode)}
      </div>
    </div>
    ${Array.isArray(game.boostLog) && game.boostLog.length > 0 ? `
    <div class="boost-log-strip">
      ${[...game.boostLog].reverse().slice(0, 3).map(e =>
        `<div class="boost-log-entry">${_esc(e.message || '')}</div>`
      ).join('')}
    </div>` : ''}
    <!-- ── Fő terület: bal sáv + kígyótábla ─────────────── -->
    <div class="proj-main-area">

      <!-- Bal oldal: timer + kör info -->
      <div class="projector-sidebar">
        <div class="timer-block">
          <div id="proj-timer" class="timer-display ${phaseInfo.colorClass}">
            ${formatTime(phaseInfo.secondsLeft)}
          </div>
          <div id="proj-label" class="phase-label ${phaseInfo.colorClass}">
            ${timerStartedAt ? phaseInfo.label : (timerHasValue ? 'Adatátvitel szünetel' : (commDisruptionActive ? '📡 Kommunikációs zavar' : 'Várakozás...'))}
          </div>
        </div>

        ${game.anomalyEvent ? `
        <div class="anomaly-event-box">
          <div class="anomaly-event-emoji">${_esc(game.anomalyEvent.emoji)}</div>
          <div class="anomaly-event-name">${_esc(game.anomalyEvent.name)}</div>
          <div class="anomaly-event-desc">${_esc(game.anomalyEvent.specificDescription || '')}</div>
          <div class="anomaly-event-team" style="color:${TEAM_COLORS[game.anomalyEvent.triggeredByTeamIndex] || '#888'}">
            ${_esc((teams[game.anomalyEvent.triggeredByTeamIndex] || {}).name || '')}
          </div>
        </div>` : ''}

        <div class="turn-info">
          <div class="turn-team" style="color:${activeColor}">
            ${_esc(activeTeam.name || '–')}
          </div>
          ${activePlayer
            ? `<div class="turn-player">${_esc(activePlayer)} teljesíti a küldetést</div>`
            : ''}
          ${currentTurn.taskType && currentTurn.wordRevealed
            ? `<div class="task-type-badge"
                    style="color:${activeColor};border:2px solid ${activeColor}40">
                 ${_esc(currentTurn.taskType)}
               </div>
               <div class="task-points">⭐ ${currentTurn.points ?? '–'} fényév</div>`
            : currentTurn.word && !currentTurn.wordRevealed
              ? '<div class="projector-prepare-badge">Adatcsomag betöltése...</div>'
              : '<div class="task-points" style="color:#444">Kör hamarosan indul...</div>'
          }
        </div>
      </div>

      <!-- Jobb oldal: kígyótábla -->
      <div style="flex:1;min-width:0;display:flex;overflow:hidden;align-items:stretch;justify-content:center">
        ${_renderSnakeBoard(teams, boardLength, game.traps || {})}
      </div>
    </div>
  `;
  // ── Anomália pending overlay (projektor nézet) ────────────────────
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
      timerEl.className = `timer-display ${info.colorClass}`;
      timerEl.innerHTML = formatTime(info.secondsLeft);

      if (labelEl) {
        labelEl.className = `phase-label ${info.colorClass}`;
        labelEl.textContent = info.label;
      }

      if (info.phase >= 4) {
        clearInterval(_timerInterval);
        _timerInterval = null;
      }
    }, 1000);
  }
}

// ── Kígyótábla renderelés ────────────────────────────────────
function _renderSnakeBoard(teams, boardLength, traps = {}) {
  // Oszlopszám a tábla hossza alapján
  let cols;
  if      (boardLength <= 12) cols = 4;
  else if (boardLength <= 20) cols = 5;
  else if (boardLength <= 32) cols = 6;
  else if (boardLength <= 49) cols = 7;
  else                        cols = 8;

  // Csapatok mezőre leképezése: cellNum (0-indexed) → [teamIdx, ...]
  const teamAt = {};
  teams.forEach((t, i) => {
    const cellNum = Math.min(Math.max(t.score, 0), boardLength);
    if (!teamAt[cellNum]) teamAt[cellNum] = [];
    teamAt[cellNum].push(i);
  });

  const totalRows = Math.ceil((boardLength + 1) / cols);
  let html = '<div class="snake-board">';

  const ghostsInLastRow = totalRows * cols - (boardLength + 1);

  // Sorok felülről lefelé (legfelső sor = legmagasabb cellaszámok)
  for (let d = 0; d < totalRows; d++) {
    const r = totalRows - 1 - d; // board row (0=start alul, totalRows-1=cél felül)

    // Összekötő sáv az előző és az aktuális sor között
    if (d > 0) {
      // r a LOWER board row; jobb oldalon van az összekötés ha r páros, bal oldalon ha páratlan
      const connRight = r % 2 === 0;
      html += '<div class="snake-connrow">';
      for (let c = 0; c < cols; c++) {
        const isConn = (connRight && c === cols - 1) || (!connRight && c === 0);
        html += `<div class="${isConn ? 'snake-conn-cell' : 'snake-conn-spacer'}"></div>`;
      }
      html += '</div>';
    }

    html += '<div class="snake-row">';
    for (let c = 0; c < cols; c++) {
      // Páros sor (0, 2...): bal→jobb; páratlan (1, 3...): jobb→bal
      const cellIdx = r % 2 === 0 ? r * cols + c : r * cols + (cols - 1 - c);
      const cellNum = cellIdx;

      if (cellNum > boardLength) {
        // Ghost cellák kihagyva – a célmező kitölti helyüket
        continue;
      }

      const isStart   = cellNum === 0;
      const isEnd     = cellNum === boardLength;
      const isAnomaly = cellNum % 5 === 0 && cellNum > 0 && cellNum < boardLength;
      const tokens    = teamAt[cellNum] || [];
      let cls = 'snake-cell';
      if (isStart)       cls += ' snake-cell-start';
      else if (isEnd)    cls += ' snake-cell-end';
      else if (isAnomaly) cls += ' snake-cell--anomaly';
      if (tokens.length) cls += ' has-token';

      // Célmező: flex-span a sor végéig
      const flexStyle = isEnd && ghostsInLastRow > 0
        ? ` style="flex:${ghostsInLastRow + 1}"`
        : '';

      html += `<div class="${cls}"${flexStyle}>`;
      if (traps[String(cellNum)] !== undefined) html += '<span class="trap-marker">🕳️</span>';
      if (isAnomaly) html += '<span class="anomaly-marker">🌀</span>';
      if (isStart) {
        html += `<span class="snake-num">🚀</span><span class="snake-label">START</span>`;
      } else if (isEnd) {
        html += `<span class="snake-num">⭐</span><span class="snake-label">Proxima<br>bázis</span>`;
      } else {
        html += `<span class="snake-num">${cellNum}</span>`;
      }
      if (tokens.length) {
        html += '<div class="snake-tokens">';
        for (const ti of tokens) {
          const initial = teams[ti].name.charAt(0).toUpperCase();
          html += `<div class="snake-token" style="background:${TEAM_COLORS[ti]};box-shadow:0 0 10px ${TEAM_COLORS[ti]}99" title="${_esc(teams[ti].name)}">${initial}</div>`;
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

