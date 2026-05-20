/**
 * views/host-game.js – View 4/B: Host Vezérlőpult (teljes implementáció)
 * ════════════════════════════════════════════════════════════════════════
 * - Titkos szó kártya + "Feladvány újrasorsolása"
 * - Timer: fázisszínes visszaszámlálás (helyi setInterval)
 * - Pontozó gombok (engedélyezve timer indítás után)
 * - Táblaállás sávdiagrammal
 * - Következő feladványok + Előzmények
 */

import { showToast }                                     from '../app.js';
import { updateGameData }                                from '../firebase-config.js';
import { rerollCurrentWord }                             from '../logic/turn-manager.js';
import { awardPoints, awardSharedPoints, endTurnNoScore } from '../logic/scoring.js';
import { getElapsedMs, getPhaseInfo, formatTime }        from '../logic/timer.js';

const TEAM_COLORS = ['#ef4444','#3b82f6','#22c55e','#f59e0b','#a855f7','#ec4899'];

// Modul-szintű interval – elkerüli a dupla tickeket re-render esetén
let _timerInterval = null;

export function renderHostGame(game, appState) {
  // Minden re-rendernél töröljük az előző intervalt
  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }

  const el = document.getElementById('view-host-game');

  if (!game || game.status !== 'playing') {
    el.innerHTML = `<div style="margin:auto;text-align:center">
      <p class="text-muted">Nincs aktív játék.</p>
    </div>`;
    return;
  }

  const currentTurn     = game.currentTurn || {};
  const teams           = game.teams       || [];
  const timerStartedAt  = currentTurn.timerStartedAt || null;
  const timerElapsedMs  = currentTurn.timerElapsedMs || 0;
  const timerRunning    = !!timerStartedAt;
  const elapsedMs       = getElapsedMs(timerStartedAt, timerElapsedMs);
  const timerHasValue   = elapsedMs > 0;
  const phaseInfo       = getPhaseInfo(timerStartedAt, timerElapsedMs);
  const timerExpired    = phaseInfo.phase >= 4;

  const scoringEnabled  = (!timerRunning && timerHasValue) || timerExpired;
  const startEnabled    = !timerRunning && !!currentTurn.word && phaseInfo.secondsLeft > 0;
  const canPause        = timerRunning && !timerExpired;
  const canReset        = (!timerRunning && timerHasValue) || timerExpired;

  const activeTeam      = teams[currentTurn.teamIndex] || {};
  const activeColor     = TEAM_COLORS[currentTurn.teamIndex] || '#888';

  el.innerHTML = `
    <div style="width:100%;max-width:1400px;margin:0 auto;padding:1rem">

      <!-- ── Fejléc ─────────────────────────────────────────── -->
      <div style="display:flex;justify-content:space-between;align-items:center;
                  margin-bottom:1rem;padding-bottom:0.75rem;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:1rem">
          <span style="font-size:0.8rem;color:var(--text-muted)">Kód:</span>
          <strong style="letter-spacing:0.15em">${appState.gameCode}</strong>
          <span style="display:flex;align-items:center;gap:0.4rem;font-size:0.88rem">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;
                         background:${activeColor}"></span>
            <strong style="color:${activeColor}">${_esc(activeTeam.name ?? '?')}</strong>
            köre
            ${currentTurn.activePlayerId && game.players?.[currentTurn.activePlayerId]
              ? `<span style="color:var(--text-muted)">
                   – ${_esc(game.players[currentTurn.activePlayerId].name)}
                 </span>`
              : ''}
          </span>
        </div>
        <button class="btn btn-secondary" id="btn-open-projector">📺 Kivetítő</button>
      </div>

      <div class="host-game-layout">

        <!-- ── BAL OSZLOP ───────────────────────────────────── -->
        <div class="host-main">

          <!-- Titkos szó -->
          <div class="card secret-word-card" style="border-color:${activeColor}">
            ${currentTurn.word
              ? `<div class="secret-word-label">Titkos szó</div>
                 <div class="secret-word">${_esc(currentTurn.word)}</div>
                 <div class="task-meta">
                   <span>🎯 ${_esc(currentTurn.taskType || '–')}</span>
                   <span>⭐ ${currentTurn.points ?? '–'} pont</span>
                 </div>`
              : `<p class="text-muted">Nincs aktív feladvány.</p>`
            }
          </div>

          <!-- Újrasorsolás (csak timer előtt) -->
          ${!timerHasValue && currentTurn.word ? `
            <div style="text-align:center">
              <button class="btn btn-secondary" id="btn-reroll">
                🔀 Feladvány újrasorsolása
              </button>
            </div>` : ''}

          <!-- Timer kártya -->
          <div class="card host-timer-section">
            <div id="hg-timer" class="host-timer-display ${phaseInfo.colorClass}">
              ${formatTime(phaseInfo.secondsLeft)}
            </div>
            <div id="hg-label" class="phase-label ${phaseInfo.colorClass}"
                 style="margin-top:0.6rem">
              ${timerRunning
                ? phaseInfo.label
                : (timerHasValue ? 'Timer szüneteltetve' : 'Nyomd meg az ▶ gombot a kör indításához')}
            </div>
            <div class="host-controls" style="margin-top:1rem">
              <button class="btn btn-success btn-lg" id="btn-start-timer"
                   ${startEnabled ? '' : 'disabled'}>
                ${timerHasValue ? '▶ Folytatás' : '▶ Idő indítása'}
              </button>
              <button class="btn btn-warning" id="btn-pause-timer"
                   ${canPause ? '' : 'disabled'}>
                ⏸ Szünet
              </button>
              <button class="btn btn-danger" id="btn-reset-timer"
                   ${canReset ? '' : 'disabled'}>
                ↺ Reset
              </button>
            </div>
          </div>

          <!-- Pontozó gombok -->
          <div class="card scoring-section">
            <h3>
              Pontozás
              ${!scoringEnabled
                ? '<span style="font-size:0.78rem;font-weight:400;margin-left:0.4rem">' +
                  '(timer indítása után aktív)</span>'
                : ''}
            </h3>
            <div class="scoring-btns">
              ${teams.map((t, i) => `
                <button class="btn ${i === currentTurn.teamIndex ? 'btn-success' : 'btn-secondary'}
                               score-btn"
                        data-team="${i}"
                        ${scoringEnabled ? '' : 'disabled'}>
                  ✅ ${_esc(t.name)} kitalálta
                  <span style="opacity:0.75;margin-left:0.3rem">
                    (+${currentTurn.points ?? '?'} pt)
                    ${i === currentTurn.teamIndex ? '⭐' : '⚡ rabolt'}
                  </span>
                </button>`).join('')}
              <button class="btn btn-danger score-btn-noscore"
                      id="btn-no-score" ${scoringEnabled ? '' : 'disabled'}>
                ❌ Senki sem találta ki
              </button>
            </div>

            <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border)">
              <div style="display:flex;align-items:baseline;gap:0.6rem;margin-bottom:0.7rem">
                <h4 style="font-size:0.92rem;margin:0">Osztozott pontozás</h4>
                <span style="font-size:0.78rem;color:var(--text-muted)">
                  A pontok a kijelölt csapatok között egyenlően oszlanak, lefelé kerekítve.
                </span>
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.8rem">
                ${teams.map((t, i) => `
                  <label style="display:flex;align-items:center;gap:0.45rem;padding:0.45rem 0.8rem;
                                 background:var(--surface-2);border:1px solid var(--border);
                                 border-radius:999px;cursor:pointer">
                    <input type="checkbox" class="shared-score-check" value="${i}" ${scoringEnabled ? '' : 'disabled'}>
                    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${TEAM_COLORS[i]}"></span>
                    ${_esc(t.name)}
                  </label>`).join('')}
              </div>
              <button class="btn btn-primary" id="btn-award-shared" ${scoringEnabled ? '' : 'disabled'}>
                🤝 Osztott pontozás könyvelése
              </button>
            </div>
          </div>

        </div><!-- /host-main -->

        <!-- ── JOBB OLDALSÁV ─────────────────────────────────── -->
        <div class="host-sidebar">

          <!-- Táblaállás -->
          <div class="card dashboard-section">
            <h3>Táblaállás</h3>
            ${teams.map((t, i) => {
              const boardLen = game.settings?.boardLength || 30;
              const pct = Math.min(100, Math.round((t.score / boardLen) * 100));
              return `
                <div style="margin-bottom:0.75rem">
                  <div style="display:flex;justify-content:space-between;
                              align-items:center;margin-bottom:0.3rem">
                    <span style="font-weight:600;color:${TEAM_COLORS[i]}">${_esc(t.name)}</span>
                    <span style="font-weight:800">${t.score}
                      <span style="color:var(--text-muted);font-size:0.8rem;font-weight:400">
                        / ${boardLen}
                      </span>
                    </span>
                  </div>
                  <div style="background:var(--border);border-radius:4px;
                              height:8px;overflow:hidden">
                    <div style="height:100%;width:${pct}%;background:${TEAM_COLORS[i]};
                                transition:width 0.5s"></div>
                  </div>
                </div>`;
            }).join('')}
          </div>

          <!-- Következő feladványok -->
          <div class="card dashboard-section">
            <h3>Következő feladványok</h3>
            <div class="upcoming-list">
              ${Array.isArray(game.upcomingTurns) && game.upcomingTurns.length > 0
                ? game.upcomingTurns.slice(0, 3).map(t => `
                    <div class="upcoming-item">
                      <span class="upcoming-word">${_esc(t.word)}</span>
                      <span class="upcoming-meta">${_esc(t.taskType)} · ${t.points} pt</span>
                    </div>`).join('')
                : '<p class="text-muted" style="font-size:0.85rem">Nincs előre generált feladvány</p>'
              }
            </div>
          </div>

          <!-- Előzmények -->
          <div class="card dashboard-section">
            <h3>Előzmények</h3>
            <div class="history-list">
              ${Array.isArray(game.turnHistory) && game.turnHistory.length > 0
                ? [...game.turnHistory].reverse().slice(0, 15).map(h => `
                    <div class="history-item">
                      <span class="history-word" title="${_esc(h.word)}">${_esc(h.word)}</span>
                      <span class="history-result ${h.result || 'unsolved'}">
                        ${h.result === 'solved'   ? '✓ kitalálva'
                        : h.result === 'stolen'   ? '⚡ rabolt'
                        : h.result === 'shared'   ? '🤝 megosztva'
                        :                           '✗ nem találta'}
                      </span>
                    </div>`).join('')
                : '<p class="text-muted" style="font-size:0.85rem">Még nincs lezárt kör</p>'
              }
            </div>
          </div>

        </div><!-- /host-sidebar -->
      </div>
    </div>
  `;

  // ── Event listeners ──────────────────────────────────────────

  document.getElementById('btn-open-projector')?.addEventListener('click', () => {
    const url = `index.html?role=projector&room=${encodeURIComponent(appState.gameCode)}`;
    const win = window.open(url, `projector_${appState.gameCode}`, 'width=1280,height=720');
    if (!win) showToast('⚠️ Engedélyezd a felugró ablakokat a böngészőben!');
  });

  document.getElementById('btn-reroll')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-reroll');
    if (btn) btn.disabled = true;
    try {
      await rerollCurrentWord(appState.gameCode, game);
    } catch (err) {
      showToast('Hiba: ' + err.message);
      const b = document.getElementById('btn-reroll');
      if (b) b.disabled = false;
    }
  });

  document.getElementById('btn-start-timer')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-start-timer');
    if (btn) btn.disabled = true;
    try {
      await updateGameData(appState.gameCode, {
        'currentTurn/timerStartedAt': Date.now(),
        'currentTurn/timerElapsedMs': timerElapsedMs,
      });
    } catch (err) {
      showToast('Hiba: ' + err.message);
      const b = document.getElementById('btn-start-timer');
      if (b) b.disabled = false;
    }
  });

  document.getElementById('btn-pause-timer')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-pause-timer');
    if (btn) btn.disabled = true;
    try {
      const currentElapsedMs = getElapsedMs(timerStartedAt, timerElapsedMs);
      await updateGameData(appState.gameCode, {
        'currentTurn/timerStartedAt': null,
        'currentTurn/timerElapsedMs': currentElapsedMs,
      });
    } catch (err) {
      showToast('Hiba: ' + err.message);
      const b = document.getElementById('btn-pause-timer');
      if (b) b.disabled = false;
    }
  });

  document.getElementById('btn-reset-timer')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-reset-timer');
    if (btn) btn.disabled = true;
    try {
      await updateGameData(appState.gameCode, {
        'currentTurn/timerStartedAt': null,
        'currentTurn/timerElapsedMs': 0,
      });
    } catch (err) {
      showToast('Hiba: ' + err.message);
      const b = document.getElementById('btn-reset-timer');
      if (b) b.disabled = false;
    }
  });

  document.getElementById('btn-no-score')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-no-score');
    if (btn) btn.disabled = true;
    try {
      await endTurnNoScore(appState.gameCode, game);
    } catch (err) {
      showToast('Hiba: ' + err.message);
      const b = document.getElementById('btn-no-score');
      if (b) b.disabled = false;
    }
  });

  document.querySelectorAll('.score-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const teamIdx = parseInt(btn.dataset.team, 10);
      document.querySelectorAll('.score-btn, .shared-score-check').forEach(b => b.disabled = true);
      const sharedBtn = document.getElementById('btn-award-shared');
      if (sharedBtn) sharedBtn.disabled = true;
      try {
        await awardPoints(appState.gameCode, game, teamIdx);
      } catch (err) {
        showToast('Hiba: ' + err.message);
        document.querySelectorAll('.score-btn, .shared-score-check').forEach(b => b.disabled = false);
        if (sharedBtn) sharedBtn.disabled = false;
      }
    });
  });

  document.getElementById('btn-award-shared')?.addEventListener('click', async () => {
    const selectedTeams = Array.from(document.querySelectorAll('.shared-score-check:checked'))
      .map(cb => parseInt(cb.value, 10))
      .filter(Number.isInteger);

    if (selectedTeams.length < 2) {
      showToast('Jelölj ki legalább két csapatot az osztott ponthoz!');
      return;
    }

    const btn = document.getElementById('btn-award-shared');
    if (btn) btn.disabled = true;
    document.querySelectorAll('.score-btn, .shared-score-check').forEach(b => b.disabled = true);

    try {
      await awardSharedPoints(appState.gameCode, game, selectedTeams);
    } catch (err) {
      showToast('Hiba: ' + err.message);
      if (btn) btn.disabled = false;
      document.querySelectorAll('.score-btn, .shared-score-check').forEach(b => b.disabled = false);
    }
  });

  // ── Helyi timer interval (csak UI frissítés, nem Firebase) ───
  if (timerRunning) {
    _timerInterval = setInterval(() => {
      const timerEl = document.getElementById('hg-timer');
      const labelEl = document.getElementById('hg-label');
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
