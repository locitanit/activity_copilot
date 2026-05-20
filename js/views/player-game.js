/**
 * views/player-game.js – View 4/C: Játékos nézet játék közben (teljes implementáció)
 * ─────────────────────────────────────────────────────────────────────────────────
 * Aktív játékos : látja a titkos szót (arany), timer, táblaállás
 * Passzív játékos: NEM látja a szót, csak feladattípust, timert, táblaállást
 */

import { getElapsedMs, getPhaseInfo, formatTime } from '../logic/timer.js';

const TEAM_COLORS = ['#ef4444','#3b82f6','#22c55e','#f59e0b','#a855f7','#ec4899'];

let _timerInterval = null;

export function renderPlayerGame(game, appState) {
  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }

  const el = document.getElementById('view-player-game');

  if (!game || game.status !== 'playing') {
    el.style.background = '';
    el.innerHTML = `<div class="player-game-container">
      <p class="text-muted">Várakozás a játékra...</p>
    </div>`;
    return;
  }

  const currentTurn    = game.currentTurn || {};
  const teams          = game.teams       || [];
  const players        = game.players     || {};
  const timerStartedAt = currentTurn.timerStartedAt || null;
  const timerElapsedMs = currentTurn.timerElapsedMs || 0;
  const phaseInfo      = getPhaseInfo(timerStartedAt, timerElapsedMs);
  const timerHasValue  = getElapsedMs(timerStartedAt, timerElapsedMs) > 0;

  const isActive      = currentTurn.activePlayerId === appState.playerId;
  const me             = players[appState.playerId];
  const myTeamIdx      = me?.teamIndex ?? -1;
  const myTeam         = myTeamIdx >= 0 ? teams[myTeamIdx] : null;
  const myColor        = myTeamIdx >= 0 ? TEAM_COLORS[myTeamIdx] : '#888';
  const isTeamActive   = !isActive && currentTurn.teamIndex === myTeamIdx && myTeamIdx >= 0;
  const role           = isActive ? 'active' : (isTeamActive ? 'guesser' : 'passive');
  const roleLabel      = isActive ? '🏖 Soron vagy!' : (isTeamActive ? '🔍 Kitaláló' : '👀 Néző');

  const activeTeam  = teams[currentTurn.teamIndex] || {};
  const activeColor = TEAM_COLORS[currentTurn.teamIndex] || '#888';

  // Háttérszín a csapat színe alapján
  el.style.background = `linear-gradient(180deg, ${myColor}EE 0%, ${myColor}BB 18%, ${myColor}50 50%, var(--bg) 78%)`;

  el.innerHTML = `
    <div class="player-game-container">

      <!-- Szerep badge -->
      <span class="player-role-badge ${role}">
        ${roleLabel}
      </span>

      <!-- Aktív csapat / feladat fejléc -->
      <div class="card text-center" style="width:100%;border-color:${isActive ? myColor : activeColor}">
        ${isActive
          ? `<p class="text-muted" style="font-size:0.82rem;margin-bottom:0.25rem">A te feladatod</p>
             <p style="font-size:1.1rem;font-weight:700;color:${myColor}">${_esc(myTeam?.name ?? '')}</p>`
          : `<p class="text-muted" style="font-size:0.82rem;margin-bottom:0.25rem">Soron lévő csapat</p>
             <p style="font-size:1.1rem;font-weight:700;color:${activeColor}">${_esc(activeTeam.name ?? '?')}</p>
             ${currentTurn.activePlayerId && players[currentTurn.activePlayerId]
               ? `<p class="text-muted" style="font-size:0.85rem;margin-top:0.2rem">
                    ${_esc(players[currentTurn.activePlayerId].name)} teljesít
                  </p>`
               : ''}
          `
        }
        <div class="task-meta" style="justify-content:center;margin-top:0.6rem">
          <span>🎯 ${_esc(currentTurn.taskType ?? '–')}</span>
          <span>⭐ ${currentTurn.points ?? '–'} pont</span>
        </div>
      </div>

      <!-- Titkos szó (csak aktív játékosnak) -->
      ${isActive && currentTurn.word
        ? `<div class="card" style="width:100%;text-align:center;border-color:#fbbf24">
             <p class="secret-word-label">🤫 Titkos szó – csak te látod!</p>
             <p class="player-word-reveal">${_esc(currentTurn.word)}</p>
           </div>`
        : `<div class="card text-center" style="width:100%">
             <p class="player-word-hidden">🙈 A titkos szó rejtve van</p>
           </div>`
      }

      <!-- Timer -->
      <div class="card text-center" style="width:100%;padding:1.25rem">
        <div id="pg-timer" class="host-timer-display ${phaseInfo.colorClass}">
          ${formatTime(phaseInfo.secondsLeft)}
        </div>
        <div id="pg-label" class="phase-label ${phaseInfo.colorClass}" style="margin-top:0.5rem">
          ${timerStartedAt ? phaseInfo.label : (timerHasValue ? 'Timer szüneteltetve' : 'Timer még nem indult el')}
        </div>
      </div>

      <!-- Táblaállás (kompakt) -->
      <div class="card" style="width:100%">
        <h3 style="font-size:0.8rem;color:var(--text-muted);text-transform:uppercase;
                   letter-spacing:0.08em;margin-bottom:0.6rem">Állás</h3>
        ${teams.map((t, i) => {
          const boardLen = game.settings?.boardLength || 30;
          const pct = Math.min(100, Math.round((t.score / boardLen) * 100));
          return `
            <div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.45rem">
              <span style="width:8px;height:8px;border-radius:50%;background:${TEAM_COLORS[i]};
                           flex-shrink:0"></span>
              <span style="flex:1;font-size:0.88rem;
                           ${i === myTeamIdx ? 'font-weight:700' : ''}">${_esc(t.name)}</span>
              <div style="flex:2;background:var(--border);border-radius:3px;height:6px;overflow:hidden">
                <div style="height:100%;width:${pct}%;background:${TEAM_COLORS[i]};
                            transition:width 0.5s"></div>
              </div>
              <span style="font-weight:700;min-width:1.5rem;text-align:right">${t.score}</span>
            </div>`;
        }).join('')}
      </div>

    </div>
  `;

  // ── Helyi timer interval ──────────────────────────────────────
  if (timerStartedAt) {
    _timerInterval = setInterval(() => {
      const timerEl = document.getElementById('pg-timer');
      const labelEl = document.getElementById('pg-label');
      if (!timerEl) { clearInterval(_timerInterval); _timerInterval = null; return; }

      const info = getPhaseInfo(timerStartedAt, timerElapsedMs);
      timerEl.className = `host-timer-display ${info.colorClass}`;
      timerEl.textContent = formatTime(info.secondsLeft);

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

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
