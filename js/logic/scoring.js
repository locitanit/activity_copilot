/**
 * logic/scoring.js – Pontozási logika
 * ════════════════════════════════════
 * awardPoints      – pontot ítél egy csapatnak, lezárja a kört
 * awardSharedPoints – pontot oszt szet tobb csapat kozott
 * endTurnNoScore   – lezárja a kört pont nélkül
 *
 * Boost integráció:
 * - Fázis 1 helyes válasz → véletlenszerű boost a nyertes csapatnak
 * - Hiperhajtómű (hyperdriveActive) → dupla pont / -1 pont
 * - Csapda ellenőrzés score módosítás után
 */

import { updateGameData } from '../firebase-config.js';
import { startNextTurn }  from './turn-manager.js';
import { getCurrentPhase } from './timer.js';
import { addBoostToTeam, checkTraps } from './boosts.js';

// ── Belső segéd ────────────────────────────────────────────────
function _buildUpdatedPlayers(players, activePlayerId) {
  if (!activePlayerId || !players[activePlayerId]) return players;
  return {
    ...players,
    [activePlayerId]: {
      ...players[activePlayerId],
      turnCount: (players[activePlayerId].turnCount || 0) + 1,
    },
  };
}

// ── Pontszerzés ────────────────────────────────────────────────
/**
 * Pontot ítél a nyertes csapatnak és elindítja a következő kört.
 * @param {string} gameCode
 * @param {Object} game
 * @param {number} winnerTeamIndex
 */
export async function awardPoints(gameCode, game, winnerTeamIndex) {
  return awardSharedPoints(gameCode, game, [winnerTeamIndex]);
}

export async function awardSharedPoints(gameCode, game, winnerTeamIndexes) {
  const currentTurn = game.currentTurn;
  if (!currentTurn) return;

  const teams   = (game.teams || []).map(t => ({ ...t }));
  const players = game.players || {};
  let pts       = currentTurn.points || 0;
  const normalizedWinnerIndexes = [...new Set(
    (Array.isArray(winnerTeamIndexes) ? winnerTeamIndexes : [])
      .filter(idx => Number.isInteger(idx) && idx >= 0 && idx < teams.length)
  )];

  if (normalizedWinnerIndexes.length === 0) return;

  // ── Hiperhajtómű: dupla pont ───────────────────────────────
  const hyperdriveActive = !!currentTurn.hyperdriveActive;
  if (hyperdriveActive && normalizedWinnerIndexes.includes(currentTurn.teamIndex)) {
    pts = pts * 2;
  }

  const awardedPoints = Math.floor(pts / normalizedWinnerIndexes.length);
  normalizedWinnerIndexes.forEach(teamIndex => {
    teams[teamIndex].score = (teams[teamIndex].score || 0) + awardedPoints;
  });

  let result = 'shared';
  if (normalizedWinnerIndexes.length === 1) {
    result = normalizedWinnerIndexes[0] === currentTurn.teamIndex ? 'solved' : 'stolen';
  }

  const historyEntry = {
    word:            currentTurn.word,
    taskType:        currentTurn.taskType,
    points:          currentTurn.points,
    awardedPoints,
    teamIndex:       currentTurn.teamIndex,
    activePlayerId:  currentTurn.activePlayerId || null,
    winnerTeamIndex: normalizedWinnerIndexes.length === 1 ? normalizedWinnerIndexes[0] : null,
    winnerTeamIndexes: normalizedWinnerIndexes,
    result,
    hyperdriveActive,
    timestamp:       Date.now(),
  };
  const turnHistory = [
    ...(Array.isArray(game.turnHistory) ? game.turnHistory : []),
    historyEntry,
  ];

  const boardLength = game.settings?.boardLength || 30;
  const hasWinner   = teams.some(t => t.score >= boardLength);

  const updates = { teams, turnHistory };

  const activePlayerId = currentTurn.activePlayerId;
  if (activePlayerId && players[activePlayerId]) {
    updates[`players/${activePlayerId}/turnCount`] =
      (players[activePlayerId].turnCount || 0) + 1;
  }

  if (hasWinner) {
    updates.status = 'finished';
  }

  await updateGameData(gameCode, updates);

  // ── Boost szerzés: csak Fázis 1-ben ───────────────────────
  const timeDilation = !!currentTurn.timeDilationActive;
  const phase = getCurrentPhase(
    currentTurn.timerStartedAt,
    currentTurn.timerElapsedMs || 0,
    timeDilation
  );

  if (phase === 1 && normalizedWinnerIndexes.length === 1) {
    const winnerIdx = normalizedWinnerIndexes[0];
    if (winnerIdx === currentTurn.teamIndex) {
      // Frissített game-et kell átadni a boostLog miatt
      const updatedGame = { ...game, teams, turnHistory };
      try {
        await addBoostToTeam(gameCode, updatedGame, winnerIdx);
      } catch (_) { /* silent */ }
    }
  }

  if (!hasWinner) {
    // Csapda ellenőrzés az összes nyertes csapatra
    const updatedGame2 = { ...game, teams, turnHistory };
    for (const idx of normalizedWinnerIndexes) {
      try {
        const trapped = await checkTraps(gameCode, updatedGame2, idx, teams[idx].score);
        if (trapped) teams[idx].skipNextTurn = true;
      } catch (_) { /* silent */ }
    }

    await startNextTurn(gameCode, {
      ...game,
      teams,
      turnHistory,
      players: _buildUpdatedPlayers(players, activePlayerId),
    });
  }
}

// ── Kör lezárása pont nélkül ──────────────────────────────────
/**
 * Senki sem találta ki – lezárja a kört és elindítja a következőt.
 * @param {string} gameCode
 * @param {Object} game
 */
export async function endTurnNoScore(gameCode, game) {
  const currentTurn = game.currentTurn;
  if (!currentTurn) return;

  const players = game.players || {};
  const teams   = (game.teams || []).map(t => ({ ...t }));

  // ── Hiperhajtómű büntetés: -1 fényév ──────────────────────
  const hyperdriveActive = !!currentTurn.hyperdriveActive;
  if (hyperdriveActive) {
    const teamIdx = currentTurn.teamIndex;
    if (teamIdx >= 0 && teamIdx < teams.length) {
      teams[teamIdx].score = Math.max(0, (teams[teamIdx].score || 0) - 1);
    }
  }

  const historyEntry = {
    word:            currentTurn.word,
    taskType:        currentTurn.taskType,
    points:          currentTurn.points,
    teamIndex:       currentTurn.teamIndex,
    activePlayerId:  currentTurn.activePlayerId || null,
    winnerTeamIndex: null,
    result:          'unsolved',
    hyperdriveActive,
    timestamp:       Date.now(),
  };
  const turnHistory = [
    ...(Array.isArray(game.turnHistory) ? game.turnHistory : []),
    historyEntry,
  ];

  const updates = { turnHistory };

  if (hyperdriveActive) {
    updates.teams = teams;
  }

  const activePlayerId = currentTurn.activePlayerId;
  if (activePlayerId && players[activePlayerId]) {
    updates[`players/${activePlayerId}/turnCount`] =
      (players[activePlayerId].turnCount || 0) + 1;
  }

  await updateGameData(gameCode, updates);

  await startNextTurn(gameCode, {
    ...game,
    teams: hyperdriveActive ? teams : game.teams,
    turnHistory,
    players: _buildUpdatedPlayers(players, activePlayerId),
  });
}
