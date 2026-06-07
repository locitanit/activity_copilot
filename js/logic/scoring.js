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
import { addBoostToTeam, checkTraps, addBoostLog } from './boosts.js';
import { isAnomalyCell, triggerAnomalyEvent } from './anomaly.js';

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
  const prevScores = teams.map(t => t.score || 0);   // pont előtti pozíciók (naplóhoz)
  const players = game.players || {};
  let pts       = currentTurn.points || 0;
  const normalizedWinnerIndexes = [...new Set(
    (Array.isArray(winnerTeamIndexes) ? winnerTeamIndexes : [])
      .filter(idx => Number.isInteger(idx) && idx >= 0 && idx < teams.length)
  )];

  if (normalizedWinnerIndexes.length === 0) return;

  // ── Hiperhajtómű: dupla pont csak az aktiváló csapatnak ───
  const hyperdriveActive = !!currentTurn.hyperdriveActive;
  const warpTeamIdx = hyperdriveActive ? currentTurn.teamIndex : -1;

  const basePoints = Math.floor(pts / normalizedWinnerIndexes.length);
  normalizedWinnerIndexes.forEach(teamIndex => {
    const awarded = (teamIndex === warpTeamIdx) ? basePoints * 2 : basePoints;
    teams[teamIndex].score = (teams[teamIndex].score || 0) + awarded;
  });
  const awardedPoints = basePoints;

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

  // ── Eredmény + mozgás naplózása (titkos szó NÉLKÜL) ───────
  try {
    const taskLabel = currentTurn.taskType ? ` (${currentTurn.taskType})` : '';
    const move = idx => `${prevScores[idx]}→${teams[idx].score}`;
    const delta = idx => teams[idx].score - prevScores[idx];
    if (result === 'solved') {
      const idx = normalizedWinnerIndexes[0];
      const dbl = hyperdriveActive ? ' ⚡dupla' : '';
      await addBoostLog(gameCode, game,
        `✅ ${teams[idx].name} megfejtette az adatcsomagot${taskLabel} → +${delta(idx)}${dbl} fényév (${move(idx)})`);
    } else if (result === 'stolen') {
      const idx = normalizedWinnerIndexes[0];
      const robbedName = teams[currentTurn.teamIndex]?.name ?? 'a másik flotta';
      await addBoostLog(gameCode, game,
        `🛰️ ${teams[idx].name} ELLOPTA a megfejtést ${robbedName} elől${taskLabel} → +${delta(idx)} fényév (${move(idx)})`);
    } else {
      const parts = normalizedWinnerIndexes
        .map(idx => `${teams[idx].name} +${delta(idx)} (${move(idx)})`)
        .join(', ');
      await addBoostLog(gameCode, game,
        `🤝 Megosztott siker${taskLabel}: ${parts}`);
    }
  } catch (_) { /* silent */ }

  if (hasWinner) {
    try {
      const finisher = teams.find(t => (t.score || 0) >= boardLength);
      await addBoostLog(gameCode, game,
        `🏁 ${finisher?.name ?? 'A győztes flotta'} elérte a Proxima bázist – küldetés teljesítve!`);
    } catch (_) { /* silent */ }
  }

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

    // ── Anomália ellenőrzés ──────────────────────────────────
    // Rögzítjük, melyik csapatok léptek anomáliára a feladványból szerzett pont alapján
    // (az anomáliák hatása előtt). Előrébb lévők kerülnek előre a sorban.
    // Ha anomália hatására kerül valaki anomáliamezőre, az nem érvényesül.
    const anomalyEvery = game.settings?.anomalyEvery || 5;
    const anomalyCandidates = normalizedWinnerIndexes
      .filter(idx => isAnomalyCell(teams[idx].score, boardLength, anomalyEvery))
      .sort((a, b) => teams[b].score - teams[a].score);
    let postAnomalyTeams        = teams;
    let commDisruptionTriggered = false;
    for (const idx of anomalyCandidates) {
      try {
        const result = await triggerAnomalyEvent(
          gameCode,
          { ...game, teams: postAnomalyTeams },
          idx
        );
        postAnomalyTeams = result.updatedTeams;
        if (result.commDisruptionActive) commDisruptionTriggered = true;
      } catch (_) { /* silent */ }
    }

    // Ha az anomália hatás miatt valaki elérte a célt
    const anomalyHasWinner = postAnomalyTeams.some(t => t.score >= boardLength);
    if (anomalyHasWinner) {
      await updateGameData(gameCode, { status: 'finished', teams: postAnomalyTeams });
      try {
        const finisher = postAnomalyTeams.find(t => (t.score || 0) >= boardLength);
        await addBoostLog(gameCode, game,
          `🏁 ${finisher?.name ?? 'A győztes flotta'} egy anomália révén elérte a Proxima bázist – küldetés teljesítve!`);
      } catch (_) { /* silent */ }
      return;
    }

    await startNextTurn(gameCode, {
      ...game,
      teams:                postAnomalyTeams,
      commDisruptionActive: game.commDisruptionActive || commDisruptionTriggered,
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
  const penaltyTeamIdx   = currentTurn.teamIndex;
  const prevPenaltyScore = teams[penaltyTeamIdx]?.score || 0;
  if (hyperdriveActive) {
    if (penaltyTeamIdx >= 0 && penaltyTeamIdx < teams.length) {
      teams[penaltyTeamIdx].score = Math.max(0, (teams[penaltyTeamIdx].score || 0) - 1);
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

  // ── Sikertelen kör naplózása (titkos szó NÉLKÜL) ──────────
  try {
    const teamName  = game.teams?.[currentTurn.teamIndex]?.name ?? 'Csapat';
    const taskLabel = currentTurn.taskType ? ` (${currentTurn.taskType})` : '';
    await addBoostLog(gameCode, game,
      `❌ ${teamName} nem fejtette meg az adatcsomagot${taskLabel} – senki sem szerzett pontot`);
    if (hyperdriveActive) {
      await addBoostLog(gameCode, game,
        `⚡ Hiperhajtómű kudarc: ${teamName} −1 fényév (${prevPenaltyScore}→${teams[penaltyTeamIdx]?.score})`);
    }
  } catch (_) { /* silent */ }

  await startNextTurn(gameCode, {
    ...game,
    teams: hyperdriveActive ? teams : game.teams,
    turnHistory,
    players: _buildUpdatedPlayers(players, activePlayerId),
  });
}
