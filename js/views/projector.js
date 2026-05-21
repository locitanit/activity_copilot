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
        Csatlakozz a misszióhoz a kóddal:
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
        🛸 Várakozás a misszió kezdetére...
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

          <p class="briefing-waiting">🛸 Várakozás az Irányítóközpont parancsára...</p>
        </div>
      </div>
    </div>
  `;
}

// ── Győztes nézet ─────────────────────────────────────────────
function _renderFinished(el, game) {
  const teams = game.teams || [];
  const winner = teams.reduce(
    (best, t) => (t.score >= best.score ? t : best),
    teams[0] || { name: '–', score: 0 }
  );
  const winnerIdx = teams.indexOf(winner);

  el.innerHTML = `
    <div style="margin:auto;text-align:center;color:#fff;width:100%;max-width:900px">
      <div style="font-size:6rem;margin-bottom:1rem">🏆</div>
      <div style="font-size:1.2rem;color:#3d6a8a;margin-bottom:0.5rem;text-transform:uppercase;
                  letter-spacing:0.15em">Győztes flotta</div>
      <div style="font-size:4.5rem;font-weight:900;
                  color:${TEAM_COLORS[winnerIdx] || '#fbbf24'};margin-bottom:2.5rem;
                  text-shadow:0 0 50px ${TEAM_COLORS[winnerIdx] || '#fbbf24'}80">
        ${_esc(winner.name)}
      </div>
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
  const phaseInfo      = getPhaseInfo(timerStartedAt, timerElapsedMs);
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

    <!-- ── Fő terület: bal sáv + kígyótábla ─────────────── -->
    <div style="flex:1;display:flex;gap:1.5rem;min-height:0;width:100%;overflow:visible">

      <!-- Bal oldal: timer + kör info -->
      <div class="projector-sidebar">
        <div class="timer-block">
          <div id="proj-timer" class="timer-display ${phaseInfo.colorClass}">
            ${formatTime(phaseInfo.secondsLeft)}
          </div>
          <div id="proj-label" class="phase-label ${phaseInfo.colorClass}"
               style="margin-top:0.75rem;font-size:1.1rem">
            ${timerStartedAt ? phaseInfo.label : (timerHasValue ? 'Adatátvitel szünetel' : 'Várakozás...')}
          </div>
        </div>

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
              ? '<div class="projector-prepare-badge">🚀 Adatcsomag betöltése...</div>'
              : '<div class="task-points" style="color:#444">Kör hamarosan indul...</div>'
          }
        </div>
      </div>

      <!-- Jobb oldal: kígyótábla -->
      <div style="flex:1;min-width:0;display:flex;overflow:hidden;align-items:stretch;justify-content:center">
        ${_renderSnakeBoard(teams, boardLength)}
      </div>
    </div>
  `;

  // ── Helyi timer interval (UI frissítés) ───────────────────
  if (timerStartedAt) {
    _timerInterval = setInterval(() => {
      const timerEl = document.getElementById('proj-timer');
      const labelEl = document.getElementById('proj-label');
      if (!timerEl) { clearInterval(_timerInterval); _timerInterval = null; return; }

      const info = getPhaseInfo(timerStartedAt, timerElapsedMs);
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
function _renderSnakeBoard(teams, boardLength) {
  // Oszlopszám a tábla hossza alapján
  let cols;
  if      (boardLength <= 12) cols = 4;
  else if (boardLength <= 20) cols = 5;
  else if (boardLength <= 32) cols = 6;
  else if (boardLength <= 49) cols = 7;
  else                        cols = 8;

  // Csapatok mezőre leképezése: cellNum (1-indexed) → [teamIdx, ...]
  const teamAt = {};
  teams.forEach((t, i) => {
    const cellNum = Math.min(Math.max(t.score, 0), boardLength - 1) + 1;
    if (!teamAt[cellNum]) teamAt[cellNum] = [];
    teamAt[cellNum].push(i);
  });

  const totalRows = Math.ceil(boardLength / cols);
  let html = '<div class="snake-board">';

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
      const cellNum = cellIdx + 1;

      if (cellNum > boardLength) {
        html += '<div class="snake-cell snake-cell-ghost"></div>';
        continue;
      }

      const isStart = cellNum === 1;
      const isEnd   = cellNum === boardLength;
      const tokens  = teamAt[cellNum] || [];
      let cls = 'snake-cell';
      if (isStart)       cls += ' snake-cell-start';
      else if (isEnd)    cls += ' snake-cell-end';
      if (tokens.length) cls += ' has-token';

      html += `<div class="${cls}">`;
      html += `<span class="snake-num">${isStart ? '🏁' : isEnd ? '🏆' : cellNum}</span>`;
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

