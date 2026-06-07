/**
 * logic/boosts.js – Fejlesztések (Boost) rendszer
 * ═══════════════════════════════════════════════════
 * Boost típusok, szerzés, aktiválás, csapda- és pajzslogika.
 */

import { updateGameData, appendBoostLog, getBoostLog } from '../firebase-config.js';

// ── Boost definíciók ──────────────────────────────────────────
export const BOOST_TYPES = {
  torpedo: {
    id:    'torpedo',
    name:  'Foton torpedó',
    emoji: '💥',
    description: 'Támadó fegyver. Célpont csapat: 30%: -1, 15%: -2, 5%: -3 fényév. 50% nem talál.',
    playerActivated: true,
  },
  trap: {
    id:    'trap',
    name:  'Gravitációs csapda',
    emoji: '🕳️',
    description: 'Lerakod egy mezőre. Ha egy hajó rálép, a következő köréből kimarad.',
    playerActivated: true,
  },
  warp: {
    id:    'warp',
    name:  'Hiperhajtómű',
    emoji: '⚡',
    description: 'Ha kitalálják a feladványt dupla fényév. Ha nem, hátralép egy fényévet.',
    playerActivated: true,
  },
  shield: {
    id:    'shield',
    name:  'Kvantum pajzs',
    emoji: '🛡️',
    description: 'Automatikusan véd a következő torpedó vagy csapda ellen, majd törlődik.',
    playerActivated: false,
  },
  timewarp: {
    id:    'timewarp',
    name:  'Időtágulás',
    emoji: '⏳',
    description: 'A következő feladatnál az 1. fázis 30 mp helyett 45 mp-ig tart.',
    playerActivated: true,
  },
};

const BOOST_IDS = Object.keys(BOOST_TYPES);

// ── Véletlenszerű boost generálás (torpedo 40%, többi 15%) ────
const _BOOST_WEIGHTS = { torpedo: 40, trap: 15, warp: 15, shield: 15, timewarp: 15 };
const _BOOST_POOL = Object.entries(_BOOST_WEIGHTS).flatMap(([id, w]) => Array(w).fill(id));

export function getRandomBoost() {
  return _BOOST_POOL[Math.floor(Math.random() * _BOOST_POOL.length)];
}

// ── Boost hozzáadás csapat inventory-hoz ──────────────────────
export async function addBoostToTeam(gameCode, game, teamIndex) {
  const boostId = getRandomBoost();
  const teams = game.teams || [];
  const inventory = [...(teams[teamIndex]?.inventory || []), boostId];

  const logMsg = `${BOOST_TYPES[boostId].emoji} ${teams[teamIndex]?.name ?? 'Csapat'} fejlesztést kapott: ${BOOST_TYPES[boostId].name}!`;

  await updateGameData(gameCode, {
    [`teams/${teamIndex}/inventory`]: inventory,
  });

  await addBoostLog(gameCode, game, logMsg, { kind: 'boost_gain', team: teamIndex });

  return boostId;
}

// ── Boost eltávolítása inventory-ból (index alapján) ──────────
export async function removeBoostFromInventory(gameCode, game, teamIndex, boostIndex) {
  const teams = game.teams || [];
  const inventory = [...(teams[teamIndex]?.inventory || [])];
  if (boostIndex < 0 || boostIndex >= inventory.length) return;
  inventory.splice(boostIndex, 1);
  await updateGameData(gameCode, {
    [`teams/${teamIndex}/inventory`]: inventory,
  });
}

// ── Pajzs eltávolítása (az első shield-et veszi ki) ──────────
function _removeShield(inventory) {
  const idx = inventory.indexOf('shield');
  if (idx === -1) return { removed: false, newInventory: inventory };
  const newInv = [...inventory];
  newInv.splice(idx, 1);
  return { removed: true, newInventory: newInv };
}

// ── Foton Torpedó aktiválás ──────────────────────────────────
/**
 * @param {string} gameCode
 * @param {Object} game
 * @param {number} firingTeamIndex – Ki lő
 * @param {number} targetTeamIndex – Kire lő
 * @param {number} boostIndex – Melyik inventory slot-ból
 * @returns {Promise<{hit: boolean, damage: number, shielded: boolean}>}
 */
export async function activateTorpedo(gameCode, game, firingTeamIndex, targetTeamIndex, boostIndex) {
  const teams = game.teams || [];
  const firingTeam = teams[firingTeamIndex];
  const targetTeam = teams[targetTeamIndex];
  if (!firingTeam || !targetTeam) throw new Error('Érvénytelen csapat.');

  // Eltávolítjuk a torpedót az inventory-ból
  const firingInv = [...(firingTeam.inventory || [])];
  firingInv.splice(boostIndex, 1);

  // Esélyszámítás
  const roll = Math.random();
  let damage = 0;
  if (roll < 0.05) damage = 3;
  else if (roll < 0.20) damage = 2;
  else if (roll < 0.50) damage = 1;
  // 50% → damage = 0 (nem talál)

  const updates = {
    [`teams/${firingTeamIndex}/inventory`]: firingInv,
  };

  let shielded = false;
  let logMsg;

  if (damage > 0) {
    // Pajzs ellenőrzés a célponton
    const targetInv = [...(targetTeam.inventory || [])];
    const shieldResult = _removeShield(targetInv);

    if (shieldResult.removed) {
      // Pajzs kivédte!
      shielded = true;
      damage = 0;
      updates[`teams/${targetTeamIndex}/inventory`] = shieldResult.newInventory;
      logMsg = `🛡️ ${targetTeam.name} kvantum pajzsa kivédte ${firingTeam.name} torpedóját!`;
    } else {
      // Találat!
      const newScore = Math.max(0, (targetTeam.score || 0) - damage);
      updates[`teams/${targetTeamIndex}/score`] = newScore;
      logMsg = `🚀 ${firingTeam.name} torpedót lőtt ${targetTeam.name} flottájára → -${damage} fényév!`;
    }
  } else {
    logMsg = `🚀 ${firingTeam.name} torpedója elkerülte ${targetTeam.name} flottáját – nem talált!`;
  }

  // ── Atomi írás: a pont-/inventory-változás ÉS a napló-bejegyzés EGY
  //    snapshotban érkezzen a kivetítőhöz, hogy a célpont hátralépését
  //    az explózió utánra tudja halasztani (előbb robbanás, aztán mozgás).
  const fx = {
    kind: 'torpedo',
    team: firingTeamIndex,
    target: targetTeamIndex,
    outcome: shielded ? 'shielded' : (damage > 0 ? 'hit' : 'miss'),
  };
  const freshLog = await getBoostLog(gameCode);                 // friss napló (clobber-véd, mint appendBoostLog)
  const newLog = [...freshLog, { message: logMsg, timestamp: Date.now(), fx }];
  if (newLog.length > 500) newLog.splice(0, newLog.length - 500);
  updates.boostLog = newLog;

  await updateGameData(gameCode, updates);

  return { hit: damage > 0, damage, shielded };
}

// ── Gravitációs csapda lerakás ───────────────────────────────
/**
 * @param {string} gameCode
 * @param {Object} game
 * @param {number} teamIndex – Ki rakja le
 * @param {number} cellNumber – Melyik mezőre (1-indexed)
 * @param {number} boostIndex – Melyik inventory slot-ból
 */
export async function activateTrap(gameCode, game, teamIndex, cellNumber, boostIndex) {
  const teams = game.teams || [];
  const team = teams[teamIndex];
  if (!team) throw new Error('Érvénytelen csapat.');

  const existingTraps = game.traps || {};
  if (existingTraps[String(cellNumber)] !== undefined) {
    throw new Error(`A ${cellNumber}. mezőn már van csapda!`);
  }

  const inventory = [...(team.inventory || [])];
  inventory.splice(boostIndex, 1);

  const traps = { ...(game.traps || {}) };
  traps[String(cellNumber)] = true;

  const logMsg = `🕳️ ${team.name} gravitációs csapdát rakott le a ${cellNumber}. mezőre!`;

  await updateGameData(gameCode, {
    [`teams/${teamIndex}/inventory`]: inventory,
    traps,
  });
  await addBoostLog(gameCode, game, logMsg, { kind: 'trap_place', team: teamIndex, cell: cellNumber });
}

// ── Hiperhajtómű aktiválás ───────────────────────────────────
/**
 * Bekapcsolja a currentTurn.hyperdriveActive flaget.
 */
export async function activateHyperdrive(gameCode, game, teamIndex, boostIndex) {
  if (game.currentTurn?.hyperdriveActive) {
    throw new Error('Ebben a körben már aktív a hiperhajtómű!');
  }
  const teams = game.teams || [];
  const team = teams[teamIndex];
  if (!team) throw new Error('Érvénytelen csapat.');

  const inventory = [...(team.inventory || [])];
  inventory.splice(boostIndex, 1);

  const logMsg = `⚡ ${team.name} aktiválta a hiperhajtóművet! Dupla pont siker esetén, -1 kudarc esetén!`;

  await updateGameData(gameCode, {
    [`teams/${teamIndex}/inventory`]: inventory,
    'currentTurn/hyperdriveActive': true,
  });
  await addBoostLog(gameCode, game, logMsg, { kind: 'warp', team: teamIndex });
}

// ── Időtágulás aktiválás ─────────────────────────────────────
/**
 * Bekapcsolja a currentTurn.timeDilationActive flaget.
 */
export async function activateTimeDilation(gameCode, game, teamIndex, boostIndex) {
  const teams = game.teams || [];
  const team = teams[teamIndex];
  if (!team) throw new Error('Érvénytelen csapat.');

  const inventory = [...(team.inventory || [])];
  inventory.splice(boostIndex, 1);

  const logMsg = `⏳ ${team.name} aktiválta az időtágulást! Az 1. fázis 45 mp-ig tart!`;

  await updateGameData(gameCode, {
    [`teams/${teamIndex}/inventory`]: inventory,
    'currentTurn/timeDilationActive': true,
  });
  await addBoostLog(gameCode, game, logMsg, { kind: 'timewarp', team: teamIndex });
}

// ── Csapda ellenőrzés (score módosítás után hívandó) ─────────
/**
 * Ellenőrzi, hogy az adott csapat rálépett-e csapdára az új score-jával.
 * @returns {Promise<boolean>} true ha csapdába lépett
 */
export async function checkTraps(gameCode, game, teamIndex, newScore) {
  const teams = game.teams || [];
  const team = teams[teamIndex];
  if (!team) return false;

  const boardLength = game.settings?.boardLength || 30;
  const cellNum = Math.min(Math.max(newScore, 0), boardLength);
  const traps = game.traps || {};

  const hasTrap = traps[String(cellNum)] !== undefined;
  if (!hasTrap) return false;

  // Pajzs ellenőrzés
  const inventory = [...(team.inventory || [])];
  const shieldResult = _removeShield(inventory);

  const updates = {};

  if (shieldResult.removed) {
    // Pajzs véd, csapda is eltűnik
    updates[`teams/${teamIndex}/inventory`] = shieldResult.newInventory;
    updates[`traps/${cellNum}`] = null;
    const logMsg = `🛡️ ${team.name} pajzsa kivédte a gravitációs csapdát a ${cellNum}. mezőn!`;
    await updateGameData(gameCode, updates);
    await addBoostLog(gameCode, game, logMsg, { kind: 'shield_block', team: teamIndex, cell: cellNum });
    return false;
  }

  // Csapdába lépett! Kimarad a következő kör, csapda törlődik
  updates[`teams/${teamIndex}/skipNextTurn`] = true;
  updates[`traps/${cellNum}`] = null;

  const logMsg = `🕳️ ${team.name} gravitációs csapdába lépett a ${cellNum}. mezőn! Kimarad a következő köréből!`;
  await updateGameData(gameCode, updates);
  await addBoostLog(gameCode, game, logMsg, { kind: 'trap_trigger', team: teamIndex, cell: cellNum });
  return true;
}

// ── Eseménynapló ─────────────────────────────────────────────
/**
 * Hozzáad egy bejegyzést az eseménynaplóhoz (kivetítőhöz).
 * A `game` paramétert kompatibilitásból tartjuk meg – a legfrissebb naplót
 * az appendBoostLog olvassa be írás előtt, hogy az egy körön belüli több
 * naplóírás ne írja felül egymást.
 *
 * @param {Object} [fx] – Opcionális strukturált animációs metaadat a kivetítőnek:
 *   { kind:'boost_gain'|'torpedo'|'trap_place'|'trap_trigger'|'shield_block'|'warp'|'timewarp',
 *     team?:number, target?:number, cell?:number, outcome?:'hit'|'miss'|'shielded' }
 *   A kivetítő ebből indítja a megfelelő FX-et (a magyar szöveg elemzése nélkül).
 */
export async function addBoostLog(gameCode, game, message, fx) {
  await appendBoostLog(gameCode, { message, timestamp: Date.now(), ...(fx ? { fx } : {}) });
}
