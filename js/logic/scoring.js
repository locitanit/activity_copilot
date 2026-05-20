/**
 * logic/scoring.js – Pontozási logika
 * ════════════════════════════════════
 * awardPoints      – pontot ítél egy csapatnak, lezárja a kört
 * awardSharedPoints – pontot oszt szet tobb csapat kozott
 * endTurnNoScore   – lezárja a kört pont nélkül
 */

import { updateGameData } from '../firebase-config.js';
import { startNextTurn }  from './turn-manager.js';

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
  const pts     = currentTurn.points || 0;
  const normalizedWinnerIndexes = [...new Set(
    (Array.isArray(winnerTeamIndexes) ? winnerTeamIndexes : [])
      .filter(idx => Number.isInteger(idx) && idx >= 0 && idx < teams.length)
  )];

  if (normalizedWinnerIndexes.length === 0) return;

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
    points:          pts,
    awardedPoints,
    teamIndex:       currentTurn.teamIndex,
    activePlayerId:  currentTurn.activePlayerId || null,
    winnerTeamIndex: normalizedWinnerIndexes.length === 1 ? normalizedWinnerIndexes[0] : null,
    winnerTeamIndexes: normalizedWinnerIndexes,
    result,
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

  if (!hasWinner) {
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
  const historyEntry = {
    word:            currentTurn.word,
    taskType:        currentTurn.taskType,
    points:          currentTurn.points,
    teamIndex:       currentTurn.teamIndex,
    activePlayerId:  currentTurn.activePlayerId || null,
    winnerTeamIndex: null,
    result:          'unsolved',
    timestamp:       Date.now(),
  };
  const turnHistory = [
    ...(Array.isArray(game.turnHistory) ? game.turnHistory : []),
    historyEntry,
  ];

  const updates = { turnHistory };
  const activePlayerId = currentTurn.activePlayerId;
  if (activePlayerId && players[activePlayerId]) {
    updates[`players/${activePlayerId}/turnCount`] =
      (players[activePlayerId].turnCount || 0) + 1;
  }

  await updateGameData(gameCode, updates);

  await startNextTurn(gameCode, {
    ...game,
    turnHistory,
    players: _buildUpdatedPlayers(players, activePlayerId),
  });
}
