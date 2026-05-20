/**
 * logic/scoring.js – Pontozási logika
 * ════════════════════════════════════
 * awardPoints    – pontot ítél egy csapatnak, lezárja a kört
 * endTurnNoScore – lezárja a kört pont nélkül
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
  const currentTurn = game.currentTurn;
  if (!currentTurn) return;

  const teams   = (game.teams || []).map(t => ({ ...t }));
  const players = game.players || {};
  const pts     = currentTurn.points || 0;

  const isSameTeam = winnerTeamIndex === currentTurn.teamIndex;
  const result     = isSameTeam ? 'solved' : 'stolen';

  teams[winnerTeamIndex].score = (teams[winnerTeamIndex].score || 0) + pts;

  const historyEntry = {
    word:            currentTurn.word,
    taskType:        currentTurn.taskType,
    points:          pts,
    teamIndex:       currentTurn.teamIndex,
    activePlayerId:  currentTurn.activePlayerId || null,
    winnerTeamIndex,
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
