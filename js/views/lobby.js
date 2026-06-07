/**
 * views/lobby.js – View 3: Váróterem
 * Host nézet: nagy kódkijelzés + valós idejű játékoslista.
 * Játékos nézet: csapatválasztás (manual mód) vagy várakozás.
 * Holografikus dizájn (Tailwind + Material Symbols).
 */

import { showToast, leaveBarHtml, wireLeaveBar } from '../app.js';
import { updateGameData, appendBoostLog } from '../firebase-config.js';
import { generateTurnData, selectNextPlayer } from '../logic/turn-manager.js';

const TEAM_COLORS_HEX = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];

// Közös felső sáv (kilépés + session kód)
function _topBar(gameCode) {
  return `
    <header class="flex justify-between items-center w-full px-margin-mobile py-3 border-b border-primary/20">
      ${leaveBarHtml()}
      <div class="glass-panel px-3 py-1 border border-primary/20 rounded font-code-sm text-code-sm">
        <span class="text-primary opacity-70">SESSION: </span>
        <span class="text-primary-container font-bold tracking-widest">${_esc(gameCode || '')}</span>
      </div>
    </header>`;
}

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

  wireLeaveBar();
}

// ── Host nézet ─────────────────────────────────────────────────
function _renderHostLobby(el, game, playerEntries, teams, appState) {
  const isManualAllAssigned = game.settings?.assignmentType !== 'manual' ||
    playerEntries.every(([, p]) => p.teamIndex >= 0);
  const canStart = playerEntries.length >= 1 && isManualAllAssigned;

  el.innerHTML = `
    <div class="min-h-screen w-full flex flex-col">
      ${_topBar(appState.gameCode)}

      <div class="flex-1 w-full max-w-4xl mx-auto px-margin-mobile py-8 flex flex-col gap-gutter">

        <div class="text-center">
          <p class="font-label-md text-label-md text-on-surface-variant uppercase tracking-[0.2em] mb-3">
            Oszd meg a küldetés-kódot az asztronautákkal
          </p>
          <div class="holographic-panel clip-chamfer inline-block px-12 py-4">
            <span class="font-display-lg text-display-lg text-primary tracking-[0.3em]
                         drop-shadow-[0_0_20px_rgba(0,212,255,0.6)]">${_esc(appState.gameCode)}</span>
          </div>
        </div>

        <div class="holographic-panel rounded-xl p-6 flex flex-col gap-4">
          <div class="flex justify-between items-center">
            <h3 class="font-headline-lg text-headline-lg-mobile text-primary flex items-center gap-2">
              <span class="material-symbols-outlined">groups</span> Regisztrált asztronauták
              <span class="text-on-surface-variant font-body-md">(${playerEntries.length})</span>
            </h3>
            <span class="font-label-md text-label-md text-on-surface-variant">
              ${game.settings.assignmentType === 'manual' ? '🤝 Manuális beosztás' : '🎲 Véletlenszerű'}
            </span>
          </div>

          ${playerEntries.length === 0
            ? `<p class="text-on-surface-variant font-body-md text-body-md">Még egyetlen asztronauta sem érkezett...</p>`
            : `<div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                 ${teams.map((team, idx) => {
                    const teamPlayers = playerEntries.filter(([, p]) => p.teamIndex === idx);
                    return `
                      <div class="bg-surface-container rounded-lg p-3 border-t-2" style="border-color:${TEAM_COLORS_HEX[idx]}">
                        <h4 class="font-label-md text-label-md mb-2 flex items-center gap-2" style="color:${TEAM_COLORS_HEX[idx]}">
                          <span class="w-2 h-2 rounded-full" style="background:${TEAM_COLORS_HEX[idx]}"></span>
                          ${_esc(team.name)}
                        </h4>
                        <div class="flex flex-col gap-1">
                          ${teamPlayers.length === 0
                            ? `<p class="text-on-surface-variant font-code-sm text-code-sm">Nincs asztronauta</p>`
                            : teamPlayers.map(([, p]) => `
                                <div class="flex items-center gap-2 text-on-surface font-body-md text-body-md">
                                  <span class="material-symbols-outlined text-sm">person</span> ${_esc(p.name)}
                                </div>`).join('')}
                        </div>
                      </div>`;
                 }).join('')}
                 ${(() => {
                    const unassigned = playerEntries.filter(([, p]) => p.teamIndex < 0);
                    if (unassigned.length === 0) return '';
                    return `
                      <div class="bg-surface-container rounded-lg p-3 border-t-2 border-outline-variant">
                        <h4 class="font-label-md text-label-md text-on-surface-variant mb-2">Besorolatlan</h4>
                        <div class="flex flex-col gap-1">
                          ${unassigned.map(([, p]) => `
                            <div class="flex items-center gap-2 text-on-surface font-body-md text-body-md">
                              <span class="material-symbols-outlined text-sm">person</span> ${_esc(p.name)}
                            </div>`).join('')}
                        </div>
                      </div>`;
                 })()}
               </div>`
          }
        </div>

        <button id="btn-start-game" ${canStart ? '' : 'disabled'}
          class="bg-primary-container text-on-primary-container font-label-md text-label-md uppercase
                 px-8 py-4 rounded clip-chamfer neon-glow-primary transition-all
                 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none">
          <span class="material-symbols-outlined">play_arrow</span> Küldetés indítása
        </button>
        ${!canStart
          ? `<p class="text-on-surface-variant text-center font-body-md text-body-md">
               ${playerEntries.length === 0
                 ? 'Legalább 1 asztronauta szükséges'
                 : 'Minden asztronautának flottában kell lennie (kézi mód)'}
             </p>`
          : ''}
      </div>
    </div>
  `;

  document.getElementById('btn-start-game').addEventListener('click', async () => {
    const btn = document.getElementById('btn-start-game');
    btn.disabled = true;
    btn.textContent = 'Indítás...';
    try {
      await _handleStartGame(game, playerEntries, appState);
    } catch (err) {
      showToast('❌ Hiba a küldetés indításakor: ' + err.message);
      const b = document.getElementById('btn-start-game');
      if (b) { b.disabled = false; b.textContent = 'Küldetés indítása →'; }
    }
  });
}

// ── Játék indítása: csapatelosztás + első kör generálása ───────
async function _handleStartGame(game, playerEntries, appState) {
  const settings  = game.settings || {};
  const teams     = game.teams    || [];
  const teamCount = teams.length;
  const updates   = {};

  let effectivePlayers = Object.fromEntries(
    playerEntries.map(([id, p]) => [id, { ...p }])
  );

  if (settings.assignmentType === 'random') {
    playerEntries.forEach(([id], idx) => {
      const ti = idx % teamCount;
      updates[`players/${id}/teamIndex`] = ti;
      effectivePlayers[id].teamIndex = ti;
    });
  } else {
    const unassigned = playerEntries.filter(([, p]) => p.teamIndex < 0);
    if (unassigned.length > 0) {
      showToast(`⚠️ ${unassigned.length} asztronauta még nincs flottában!`);
      return;
    }
  }

  const generatedTurns = [];
  for (let i = 0; i < 4; i++) {
    const used = generatedTurns.map(g => g.word);
    const t = generateTurnData(settings, used);
    if (t) generatedTurns.push(t);
    else break;
  }

  if (generatedTurns.length === 0) {
    showToast('⚠️ Nincs küldets! Töltsd fel a topics.js fájlt szavakkal.');
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

  updates['status']       = 'briefing';
  updates['currentTurn']  = currentTurn;
  updates['upcomingTurns'] = upcomingTurns;
  updates['turnHistory']  = [];
  updates['boostLog']      = [];

  await updateGameData(appState.gameCode, updates);

  // ── Küldetés indulása + első kör naplózása (titkos szó NÉLKÜL) ──
  try {
    const firstTeamName = teams[0]?.name ?? 'Csapat';
    const firstPlayerName = firstActivePlayerId && effectivePlayers[firstActivePlayerId]
      ? effectivePlayers[firstActivePlayerId].name : '';
    const who = firstPlayerName ? ` · ${firstPlayerName} asztronauta` : '';
    await appendBoostLog(appState.gameCode,
      { message: '🚀 Küldetés indul – jó utat a Proxima bázisig!', timestamp: Date.now() });
    await appendBoostLog(appState.gameCode,
      { message: `🛰️ ${firstTeamName} köre${who} · ${firstTurn.taskType} (${firstTurn.points} fényév a tét)`, timestamp: Date.now() });
  } catch (_) { /* silent */ }
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
    <div class="min-h-screen w-full flex flex-col">
      ${_topBar(appState.gameCode)}

      <div class="flex-1 w-full max-w-md mx-auto px-margin-mobile py-8 flex flex-col gap-gutter text-center">

        <div>
          <p class="font-label-md text-label-md text-on-surface-variant uppercase tracking-[0.2em] mb-3">Küldetés-kód</p>
          <div class="holographic-panel clip-chamfer inline-block px-10 py-4">
            <span class="font-display-lg text-display-lg text-primary tracking-[0.3em]
                         drop-shadow-[0_0_20px_rgba(0,212,255,0.6)]">${_esc(appState.gameCode)}</span>
          </div>
        </div>

        ${isManual && myTeamIdx < 0
          ? `<div class="holographic-panel rounded-xl p-5">
               <p class="font-label-md text-label-md text-on-surface-variant uppercase mb-4">Válassz flottát</p>
               <div class="flex flex-col gap-3">
                 ${teams.map((team, idx) => {
                    const count = playerEntries.filter(([, p]) => p.teamIndex === idx).length;
                    return `
                      <button class="team-join-btn glass-panel rounded-lg px-4 py-3 flex justify-between items-center
                                     border-l-4 hover:bg-primary/5 transition-all font-body-lg text-body-lg"
                              data-team="${idx}" style="border-color:${TEAM_COLORS_HEX[idx]}">
                        <span>${_esc(team.name)}</span>
                        <span class="text-on-surface-variant font-code-sm text-code-sm">(${count})</span>
                      </button>`;
                 }).join('')}
               </div>
             </div>`
          : myTeam
            ? `<div class="holographic-panel rounded-xl p-6" style="border-color:${TEAM_COLORS_HEX[myTeamIdx]}">
                 <p class="font-label-md text-label-md text-on-surface-variant uppercase mb-1">A flottád</p>
                 <p class="font-display-md text-display-md" style="color:${TEAM_COLORS_HEX[myTeamIdx]}">${_esc(myTeam.name)}</p>
                 ${teammates.length > 0
                   ? `<p class="text-on-surface-variant font-body-md text-body-md mt-3">
                        Flottábeli asztronauták: ${teammates.map(([, p]) => _esc(p.name)).join(', ')}
                      </p>`
                   : `<p class="text-on-surface-variant font-body-md text-body-md mt-3">Egyedüli asztronauta a flottában</p>`}
               </div>`
            : `<div class="holographic-panel rounded-xl p-6">
                 <p class="text-on-surface-variant font-body-md text-body-md">Flottabeosztás folyamatban...</p>
               </div>`
        }

        <p class="font-label-md text-label-md text-primary-fixed-dim uppercase tracking-wider animate-pulse">
          Várakozás az Irányítóközpontra...
        </p>
      </div>
    </div>
  `;

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
