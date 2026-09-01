/**
 * logic/turn-manager.js – Körvezérlő logika
 * ═══════════════════════════════════════════
 * Feladványgenerálás, játékosválasztás, kör-indítás, újrasorsolás.
 * Boost integráció: skipNextTurn kezelés, hyperdriveActive / timeDilationActive reset.
 */

import { topics }          from '../data/topics.js';
import { updateGameData }  from '../firebase-config.js';
import { addBoostLog }     from './boosts.js';

// Pontérték-tartomány feladattípusonként. Modulszinten, mert a kényszerített
// feladattípusnál (📡 kommunikációs zavar) is ebből kell pontot húzni.
const POINTS_BY_TYPE = { 'körülírás': [2, 3], 'mutogatás': [4, 5, 6], 'rajzolás': [4, 5, 6] };

function _rollPoints(taskType) {
  const pool = POINTS_BY_TYPE[taskType] ?? [3, 4, 5];
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Segédfüggvény: szólista összeállítása ──────────────────────
function _buildWordPool(settings, excludeWords = []) {
  const selectedTopics  = settings.selectedTopics  || [];
  const excludeSet      = new Set(excludeWords);

  let available = [];
  for (const topicName of selectedTopics) {
    const words = topics[topicName];
    if (Array.isArray(words)) available.push(...words);
  }

  const filtered = available.filter(w => !excludeSet.has(w));
  // Ha minden szó ki van zárva (nagyon rövid lista), engedélyezzük az ismétlést
  return filtered.length > 0 ? filtered : available;
}

// ── Feladványadat generálása ───────────────────────────────────
/**
 * @param {Object}   settings     - game.settings
 * @param {string[]} [excludeWords=[]] - kizárandó szavak
 * @returns {{ word, taskType, points } | null}
 */
export function generateTurnData(settings, excludeWords = []) {
  const allowedTaskTypes = settings.allowedTaskTypes?.length
    ? settings.allowedTaskTypes
    : ['mutogatás', 'rajzolás', 'körülírás'];

  const pool = _buildWordPool(settings, excludeWords);
  if (pool.length === 0) return null;

  const word     = pool[Math.floor(Math.random() * pool.length)];
  const taskType = allowedTaskTypes[Math.floor(Math.random() * allowedTaskTypes.length)];
  const points   = _rollPoints(taskType);

  return { word, taskType, points };
}

// ── Következő játékos kiválasztása egy csapatból ──────────────
/**
 * A legkevesebb fordulót lejátszott játékost adja vissza.
 * @param {Object} players   - game.players objektum
 * @param {number} teamIndex
 * @returns {string | null} playerId
 */
export function selectNextPlayer(players, teamIndex) {
  const team = Object.entries(players)
    .filter(([, p]) => p.teamIndex === teamIndex)
    .sort((a, b) => (a[1].turnCount || 0) - (b[1].turnCount || 0));

  return team.length > 0 ? team[0][0] : null;
}

// ── Következő kör elindítása ───────────────────────────────────
/**
 * Kiszámolja a következő csapatot és játékost, feltölti az upcomingTurns sort,
 * majd atomikusan beírja Firebase-be.
 * Boost: kezeli a skipNextTurn-t (gravitációs csapda).
 *
 * @param {string} gameCode
 * @param {Object} game - teljes game snapshot
 */
export async function startNextTurn(gameCode, game) {
  const settings     = game.settings    || {};
  const players      = game.players     || {};
  const teams        = game.teams       || [];
  const teamCount    = teams.length;
  const turnHistory  = Array.isArray(game.turnHistory)   ? game.turnHistory   : [];
  const upcoming     = Array.isArray(game.upcomingTurns) ? [...game.upcomingTurns] : [];

  // Szavak, amelyeket lehetőleg kerülünk
  const usedWords = [
    ...turnHistory.map(h => h.word),
    ...(game.currentTurn?.word ? [game.currentTurn.word] : []),
    ...upcoming.map(u => u.word),
  ];

  // Következő csapat (skipNextTurn kezeléssel)
  let nextTeamIndex = 0;
  if (game.currentTurn && typeof game.currentTurn.teamIndex === 'number') {
    nextTeamIndex = (game.currentTurn.teamIndex + 1) % teamCount;
  }

  // skipNextTurn ellenőrzés: max teamCount iteráció (hogy ne legyen végtelen ciklus)
  const skipUpdates = {};
  let skippedAny = false;
  for (let attempts = 0; attempts < teamCount; attempts++) {
    const team = teams[nextTeamIndex];
    if (team && team.skipNextTurn) {
      // Ezt a csapatot átlépjük
      skipUpdates[`teams/${nextTeamIndex}/skipNextTurn`] = false;
      skipUpdates[`teams/${nextTeamIndex}/skipReason`]   = null;
      skippedAny = true;

      // Naplózzuk (a kimaradás oka: gravitációs csapda vagy fekete lyuk)
      try {
        const msg = team.skipReason === 'blackhole'
          ? `⚫ ${team.name} kimarad a köréből – az eseményhorizont időcsapdájában ragadt!`
          : `🕳️ ${team.name} kimarad a köréből a gravitációs csapda miatt!`;
        await addBoostLog(gameCode, game, msg);
      } catch (_) { /* silent */ }

      nextTeamIndex = (nextTeamIndex + 1) % teamCount;
    } else {
      break;
    }
  }

  if (Object.keys(skipUpdates).length > 0) {
    await updateGameData(gameCode, skipUpdates);
  }

  // Feladvány: elsőként az upcoming sort használjuk, különben generálunk
  let turnBase;
  if (upcoming.length > 0) {
    turnBase = upcoming.shift();
  } else {
    turnBase = generateTurnData(settings, usedWords);
  }

  if (!turnBase) {
    throw new Error('Nincs elérhető feladvány! Töltsd fel a topics.js fájlt.');
  }

  // 📡 Kommunikációs zavar anomália: a következő kör feladattípusa kényszerített.
  // A pontot az ÚJ típushoz igazítjuk (különben pl. körülírás-pont járna mutogatásért).
  if (game.forceNextTaskType) {
    turnBase = {
      ...turnBase,
      taskType: game.forceNextTaskType,
      points:   _rollPoints(game.forceNextTaskType),
    };
  }

  const activePlayerId = selectNextPlayer(players, nextTeamIndex);

  const newCurrentTurn = {
    word:                 turnBase.word,
    taskType:             turnBase.taskType,
    points:               turnBase.points,
    teamIndex:            nextTeamIndex,
    activePlayerId:       activePlayerId || null,
    timerStartedAt:       null,
    wordRevealed:         false,
    hyperdriveActive:     false,
    timeDilationActive:   false,
    commDisruptionActive: !!game.commDisruptionActive,
  };

  // upcomingTurns feltöltése max 3-ra
  while (upcoming.length < 3) {
    const allUsed = [
      ...usedWords,
      newCurrentTurn.word,
      ...upcoming.map(u => u.word),
    ];
    const next = generateTurnData(settings, allUsed);
    if (!next) break;
    upcoming.push(next);
  }

  await updateGameData(gameCode, {
    currentTurn:          newCurrentTurn,
    upcomingTurns:        upcoming,
    commDisruptionActive: false,
    forceNextTaskType:    null,     // elfogyasztottuk
    anomalyPending:       null,
    anomalyEvent:         null,
  });

  // ── Kör kezdete naplózása (titkos szó NÉLKÜL) ─────────────
  try {
    const startedTeamName = teams[nextTeamIndex]?.name ?? 'Csapat';
    const playerName = activePlayerId && players[activePlayerId]
      ? players[activePlayerId].name : '';
    const who = playerName ? ` · ${playerName} asztronauta` : '';
    const comms     = newCurrentTurn.commDisruptionActive ? ' · 🔓 Nyílt frekvencia' : '';
    const scrambled = game.forceNextTaskType ? ' · 📡 kommunikációs zavar' : '';
    await addBoostLog(gameCode, game,
      `🛰️ ${startedTeamName} köre${who} · ${newCurrentTurn.taskType} (${newCurrentTurn.points} fényév a tét)${comms}${scrambled}`);
  } catch (_) { /* silent */ }
}

// ── Aktív játékos váltása (másik asztronauta a flottából) ──────
/**
 * Átadja az aktuális kört az aktív flotta egy másik tagjának – akkor hasznos,
 * ha a kiválasztott asztronauta nem akar játszani. Csak a szó felfedése előtt
 * hívható. A kihagyott játékos turnCount-ja nő, így a sor végére kerül (nem őt
 * választja újra a következő kör), az új aktív játékos pedig a legrégebben
 * szerepelt csapattárs lesz.
 *
 * @param {string} gameCode
 * @param {Object} game
 * @returns {Promise<string>} az új aktív játékos id-je
 */
export async function switchToNextPlayer(gameCode, game) {
  const currentTurn = game.currentTurn;
  if (!currentTurn) throw new Error('Nincs aktív kör.');
  if (currentTurn.wordRevealed) {
    throw new Error('A szó már fel van fedve – nem váltható az asztronauta.');
  }
  if (currentTurn.timerStartedAt) {
    throw new Error('Az adatátvitel már elindult – nem váltható az asztronauta.');
  }

  const players   = game.players || {};
  const teamIndex = currentTurn.teamIndex;
  const currentId = currentTurn.activePlayerId || null;

  // A flotta többi tagja, a legrégebben szerepelttel az élen (turnCount, majd id)
  const others = Object.entries(players)
    .filter(([id, p]) => p.teamIndex === teamIndex && id !== currentId)
    .sort((a, b) =>
      (a[1].turnCount || 0) - (b[1].turnCount || 0) || (a[0] < b[0] ? -1 : 1));

  if (others.length === 0) {
    throw new Error('Nincs másik asztronauta ebben a flottában.');
  }

  const nextId  = others[0][0];
  const updates = { 'currentTurn/activePlayerId': nextId };

  // A kihagyott játékos a sor végére kerül
  if (currentId && players[currentId]) {
    updates[`players/${currentId}/turnCount`] = (players[currentId].turnCount || 0) + 1;
  }

  await updateGameData(gameCode, updates);

  // Napló (titkos szó NÉLKÜL)
  try {
    const teamName = game.teams?.[teamIndex]?.name ?? 'Csapat';
    const oldName  = currentId && players[currentId] ? players[currentId].name : '';
    const newName  = players[nextId]?.name ?? '';
    const suffix   = oldName ? ` (${oldName} helyett)` : '';
    await addBoostLog(gameCode, game, `🔄 ${teamName}: ${newName} veszi át az adást${suffix}`);
  } catch (_) { /* silent */ }

  return nextId;
}

// ── Aktuális szó/feladat újrasorsolása ─────────────────────────
/**
 * Csak a szót/feladatot/pontot cseréli – a csapat és a játékos marad.
 * Csak timerStartedAt === null állapotban hívható.
 *
 * @param {string} gameCode
 * @param {Object} game
 */
export async function rerollCurrentWord(gameCode, game) {
  if (game.currentTurn?.timerStartedAt) {
    throw new Error('Nem sorsolható újra: a timer már fut.');
  }

  const settings    = game.settings   || {};
  const turnHistory = Array.isArray(game.turnHistory)   ? game.turnHistory   : [];
  const upcoming    = Array.isArray(game.upcomingTurns) ? game.upcomingTurns : [];

  const usedWords = [
    ...turnHistory.map(h => h.word),
    ...upcoming.map(u => u.word),
  ];

  const newData = generateTurnData(settings, usedWords);
  if (!newData) throw new Error('Nincs elérhető feladvány!');

  await updateGameData(gameCode, {
    'currentTurn/word':     newData.word,
    'currentTurn/taskType': newData.taskType,
    'currentTurn/points':   newData.points,
  });
}
