/**
 * views/lobby.js – View 3: Váróterem
 * Host nézet: nagy kódkijelzés + valós idejű játékoslista.
 * Játékos nézet: csapatválasztás (manual mód) vagy várakozás.
 *
 * Teljes implementáció: Step 2
 * Step 1: alapvető megjelenítés + valós idejű játékoslista működik.
 */

import { showToast, state }           from '../app.js';
import { updateGameData }              from '../firebase-config.js';
import { generateTurnData, selectNextPlayer } from '../logic/turn-manager.js';

// Csapatszínek (CSS osztályok)
const TEAM_COLORS_HEX = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];

export function renderLobby(game, appState) {
  const el = document.getElementById('view-lobby');
  const players = game.players || {};
  const teams   = game.teams   || [];
  const playerEntries = Object.entries(players);

  if (appState.isHost) {
    _renderHostLobby(el, game, playerEntries, teams, appState);
  } else {
    _renderPlayerLobby(el, game, playerEntries, teams, appState);
  }
}

// ── Host nézet ─────────────────────────────────────────────────
function _renderHostLobby(el, game, playerEntries, teams, appState) {
  const isManualAllAssigned = game.settings?.assignmentType !== 'manual' ||
    playerEntries.every(([, p]) => p.teamIndex >= 0);
  const canStart = playerEntries.length >= 1 && isManualAllAssigned;

  el.innerHTML = `
    <div class="lobby-container">
      <p class="text-muted text-center" style="margin-bottom:0.5rem;font-size:0.9rem">
        Oszd meg ezt a kódot a játékosokkal:
      </p>
      <div class="join-code-display">${appState.gameCode}</div>

      <div class="card" style="margin-bottom:1.25rem">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
          <h3 style="font-size:1rem;font-weight:600">
            Csatlakozott játékosok
            <span style="color:var(--text-muted);font-weight:400">(${playerEntries.length})</span>
          </h3>
          <span style="font-size:0.82rem;color:var(--text-muted)">
            ${game.settings.assignmentType === 'manual' ? '🤝 Kézi csapatkiosztás' : '🎲 Véletlenszerű kiosztás'}
          </span>
        </div>

        ${playerEntries.length === 0
          ? `<p class="text-muted" style="font-size:0.9rem">Még senki sem csatlakozott...</p>`
          : `<div class="players-grid">
               ${teams.map((team, idx) => {
                  const teamPlayers = playerEntries.filter(([, p]) => p.teamIndex === idx);
                  return `
                    <div class="team-column">
                      <h3 style="color:${TEAM_COLORS_HEX[idx]}">
                        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${TEAM_COLORS_HEX[idx]};margin-right:0.4rem"></span>
                        ${team.name}
                      </h3>
                      <div class="player-list">
                        ${teamPlayers.length === 0
                          ? `<p class="text-muted" style="font-size:0.82rem">Nincs játékos</p>`
                          : teamPlayers.map(([id, p]) => `
                              <div class="player-chip">
                                <span>👤</span> ${_esc(p.name)}
                              </div>`).join('')
                        }
                      </div>
                    </div>
                  `;
               }).join('')}

               <!-- Nem osztott be játékosok -->
               ${(() => {
                  const unassigned = playerEntries.filter(([, p]) => p.teamIndex < 0);
                  if (unassigned.length === 0) return '';
                  return `
                    <div class="team-column">
                      <h3 style="color:var(--text-muted)">⏳ Várakozó</h3>
                      <div class="player-list">
                        ${unassigned.map(([, p]) => `
                          <div class="player-chip">
                            <span>👤</span> ${_esc(p.name)}
                          </div>`).join('')}
                      </div>
                    </div>
                  `;
               })()}
             </div>`
        }
      </div>

      <div style="display:flex;gap:1rem">
        <button class="btn btn-primary btn-lg btn-full" id="btn-start-game"
          ${canStart ? '' : 'disabled'}>
          Játék indítása →
        </button>
      </div>
      ${!canStart
        ? `<p class="text-muted text-center mt-1" style="font-size:0.85rem">
             ${ playerEntries.length === 0
               ? 'Legalább 1 játékos szükséges'
               : 'Minden játékosnak csapatban kell lennie (kézi mód)'}
           </p>`
        : ''}
    </div>
  `;

  document.getElementById('btn-start-game').addEventListener('click', async () => {
    const btn = document.getElementById('btn-start-game');
    btn.disabled = true;
    btn.textContent = 'Indítás...';

    try {
      await _handleStartGame(game, playerEntries, appState);
      // Ha sikeres, a Firebase listener automatikusan átváltja a nézetet
    } catch (err) {
      showToast('❌ Hiba a játék indításakor: ' + err.message);
      const b = document.getElementById('btn-start-game');
      if (b) { b.disabled = false; b.textContent = 'Játék indítása →'; }
    }
  });
}

// ── Játék indítása: csapatelosztás + első kör generálása ───────
async function _handleStartGame(game, playerEntries, appState) {
  const settings  = game.settings || {};
  const teams     = game.teams    || [];
  const teamCount = teams.length;
  const updates   = {};

  // Másolatot készítünk a players-ről, hogy lokálisan alkalmazzuk a kiosztást
  let effectivePlayers = Object.fromEntries(
    playerEntries.map(([id, p]) => [id, { ...p }])
  );

  if (settings.assignmentType === 'random') {
    // Véletlenszerű kiosztás: körözéssel egyenletes eloszlás
    playerEntries.forEach(([id], idx) => {
      const ti = idx % teamCount;
      updates[`players/${id}/teamIndex`] = ti;
      effectivePlayers[id].teamIndex = ti;
    });
  } else {
    // Kézi mód: ellenőrzés – mindenki csapatban van-e?
    const unassigned = playerEntries.filter(([, p]) => p.teamIndex < 0);
    if (unassigned.length > 0) {
      showToast(`⚠️ ${unassigned.length} játékos még nincs csapatban!`);
      return;
    }
  }

  // 4 feladványt generálunk előre (1 current + 3 upcoming)
  const generatedTurns = [];
  for (let i = 0; i < 4; i++) {
    const used = generatedTurns.map(g => g.word);
    const t = generateTurnData(settings, used);
    if (t) generatedTurns.push(t);
    else break;
  }

  if (generatedTurns.length === 0) {
    showToast('⚠️ Nincs feladvány! Töltsd fel a topics.js fájlt szavakkal.');
    return;
  }

  const firstTurn    = generatedTurns[0];
  const upcomingTurns = generatedTurns.slice(1);

  const firstActivePlayerId = selectNextPlayer(effectivePlayers, 0);

  const currentTurn = {
    word:           firstTurn.word,
    taskType:       firstTurn.taskType,
    points:         firstTurn.points,
    teamIndex:      0,
    activePlayerId: firstActivePlayerId || null,
    timerStartedAt: null,
    wordRevealed:   false,
  };

  // Atomikus Firebase írás: csapat-kiosztás + játékstátusz + első kör
  updates['status']       = 'playing';
  updates['currentTurn']  = currentTurn;
  updates['upcomingTurns'] = upcomingTurns;
  updates['turnHistory']  = [];

  await updateGameData(appState.gameCode, updates);
}

// ── Játékos nézet ──────────────────────────────────────────────
function _renderPlayerLobby(el, game, playerEntries, teams, appState) {
  const me       = appState.playerId ? (game.players || {})[appState.playerId] : null;
  const myTeamIdx = me?.teamIndex ?? -1;
  const myTeam   = myTeamIdx >= 0 ? teams[myTeamIdx] : null;
  const isManual = game.settings?.assignmentType === 'manual';

  const teammates = playerEntries
    .filter(([id, p]) => p.teamIndex === myTeamIdx && myTeamIdx >= 0 && id !== appState.playerId);

  el.innerHTML = `
    <div class="lobby-container text-center">
      <p class="text-muted" style="margin-bottom:0.5rem;font-size:0.9rem">Játékkód</p>
      <div class="join-code-display">${appState.gameCode}</div>

      ${isManual && myTeamIdx < 0
        ? `<!-- Csapatválasztó gombok (manual mód, még nem osztottak be) -->
           <div class="card" style="margin-bottom:1rem">
             <p style="margin-bottom:0.75rem;font-weight:600">Válassz csapatot:</p>
             <div class="team-select-btns">
               ${teams.map((team, idx) => {
                  const count = playerEntries.filter(([, p]) => p.teamIndex === idx).length;
                  return `
                    <button class="btn btn-secondary team-join-btn" data-team="${idx}"
                      style="border-left:4px solid ${TEAM_COLORS_HEX[idx]}">
                      ${_esc(team.name)}
                      <span style="color:var(--text-muted);font-size:0.82rem;margin-left:0.4rem">(${count})</span>
                    </button>`;
               }).join('')}
             </div>
           </div>`
        : myTeam
          ? `<!-- Csapat megjelenítés -->
             <div class="card" style="margin-bottom:1rem;border-color:${TEAM_COLORS_HEX[myTeamIdx]}">
               <p class="text-muted" style="font-size:0.82rem;margin-bottom:0.3rem">A csapatod</p>
               <p style="font-size:1.5rem;font-weight:700;color:${TEAM_COLORS_HEX[myTeamIdx]}">${_esc(myTeam.name)}</p>
               ${teammates.length > 0
                 ? `<p class="text-muted mt-1" style="font-size:0.85rem">
                      Csapattársak: ${teammates.map(([, p]) => _esc(p.name)).join(', ')}
                    </p>`
                 : `<p class="text-muted mt-1" style="font-size:0.82rem">Egyedül vagy ebben a csapatban</p>`}
             </div>`
          : `<div class="card" style="margin-bottom:1rem">
               <p class="text-muted">Csapatba osztás folyamatban...</p>
             </div>`
      }

      <p class="lobby-status">⏳ Várakozás a Hostra...</p>
    </div>
  `;

  // Csapat-kiválasztó gombok (manual mód)
  document.querySelectorAll('.team-join-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const teamIndex = parseInt(btn.dataset.team, 10);
      btn.disabled = true;
      try {
        await updateGameData(appState.gameCode, {
          [`players/${appState.playerId}/teamIndex`]: teamIndex,
        });
      } catch (err) {
        showToast('Hiba: ' + err.message);
        btn.disabled = false;
      }
    });
  });
}

// ── Segédfüggvény: HTML entitás escapelés ─────────────────────
function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
