/**
 * logic/anomaly.js – Űranomália rendszer
 * ══════════════════════════════════════════
 * Minden N. mező anomália-mező (N = settings.anomalyEvery, alapért. 5).
 * Ha egy csapat ide lép a pontszerzés után, súlyozott sorsolással esemény indul.
 *
 * Tervezési elv: a NÉVBŐL következzen a HATÁS, és alapból azt érje, aki rálépett.
 *
 * Események (súly / hatás):
 *   🌀 Féreglyuk         14  a rálépő: 50% +3, 50% −2
 *   💥 Szupernóva        11  lökéshullám: a mezőtől ±2-n belül mindenki −2
 *   ⚫ Fekete lyuk        9  idődilatáció: a rálépő kimarad a következő köréből
 *   📦 Roncsmező         14  a rálépő véletlen fejlesztést (boostot) talál
 *   🌠 Hintamanőver      12  a leghátul állók +2
 *   🧲 Vontatósugár       9  a leghátul állók behozzák a lemaradás felét
 *   ☄️ Meteorraj          8  az élen állók −2
 *   📡 Komm. zavar        9  a következő kör feladattípusa kényszerítve mutogatás
 *   🔓 Nyílt frekvencia  14  a következő kör azonnal a 3. fázisban indul (rabolható)
 */

import { updateGameData, appendBoostLog } from '../firebase-config.js';
import { getRandomBoost, BOOST_TYPES }    from './boosts.js';

const TEAM_COLORS = ['#ef4444','#3b82f6','#22c55e','#f59e0b','#a855f7','#ec4899'];

// A szupernóva lökéshullámának hatósugara mezőben (a ±2 mezős szabály).
const SHOCKWAVE_RADIUS = 2;

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * targeting:   'lander' | 'area' | 'last' | 'leader' | 'global'
 * weight:      sorsolási súly (összeg = 100)
 * physicsNote: egymondatos valós fizikai magyarázat (modalban és kivetítőn is látszik)
 */
export const ANOMALY_EVENTS = {
  // ── Csoport 1: aki rálép, azt éri ───────────────────────────
  wormhole: {
    id:                 'wormhole',
    name:               'Féreglyuk',
    emoji:              '🌀',
    weight:             14,
    targeting:          'lander',
    physicsNote:        'A féreglyuk átjáró a téridőben – csak azt nem tudod előre, hol jössz ki.',
    generalDescription: 'Kvantumugrás – 50% eséllyel +3, 50% eséllyel −2 fényév az anomáliára lépő flottának!',
  },
  supernova: {
    id:                 'supernova',
    name:               'Szupernóva',
    emoji:              '💥',
    weight:             11,
    targeting:          'area',
    physicsNote:        'Egy felrobbanó csillag lökéshulláma másodpercek alatt söpri el a közeli hajókat.',
    generalDescription: 'Lökéshullám! Az anomáliától 2 fényéven belül álló MINDEN flotta 2 fényévet hátravetődik.',
  },
  blackhole: {
    id:                 'blackhole',
    name:               'Fekete lyuk – eseményhorizont',
    emoji:              '⚫',
    weight:             9,
    targeting:          'lander',
    physicsNote:        'Az eseményhorizont közelében lelassul az idő – amíg nektek egy pillanat, addig kint eltelik egy teljes kör.',
    generalDescription: 'Idődilatáció: az anomáliára lépő flotta kimarad a következő köréből. Pontváltozás nincs.',
  },
  salvage: {
    id:                 'salvage',
    name:               'Roncsmező',
    emoji:              '📦',
    weight:             14,
    targeting:          'lander',
    physicsNote:        'A régi expedíciók elhagyott konténerei évszázadokig sodródnak a mélyűrben.',
    generalDescription: 'Elhagyott konténer! Az anomáliára lépő flotta véletlenszerű fejlesztést talál.',
  },

  // ── Csoport 2: felzárkóztatás ───────────────────────────────
  slingshot: {
    id:                 'slingshot',
    name:               'Gravitációs hintamanőver',
    emoji:              '🌠',
    weight:             12,
    targeting:          'last',
    physicsNote:        'Egy bolygó gravitációja körbelendíti és felgyorsítja az arra járó űrhajót – üzemanyag nélkül.',
    generalDescription: 'A leghátul álló flotta(k) 2 fényévet előrelendülnek!',
  },
  tractorbeam: {
    id:                 'tractorbeam',
    name:               'Vontatósugár',
    emoji:              '🧲',
    weight:             9,
    targeting:          'last',
    physicsNote:        'Az irányított energianyaláb megfogja és maga után húzza a lemaradt hajót.',
    generalDescription: 'Houston vontatósugarat küld: az utolsó flotta(k) behozzák a lemaradásuk felét.',
  },

  // ── Csoport 3: a következő kört befolyásolja ────────────────
  comms: {
    id:                 'comms',
    name:               'Kommunikációs zavar',
    emoji:              '📡',
    weight:             9,
    targeting:          'global',
    physicsNote:        'A csillagközi zaj megeszi a hangot és a képet – marad a kézjel.',
    generalDescription: 'Megszakadt a kommunikáció: a következő körben CSAK mutogatni lehet – se beszéd, se rajz.',
  },
  openfreq: {
    id:                 'openfreq',
    name:               'Nyílt frekvencia',
    emoji:              '🔓',
    weight:             14,
    targeting:          'global',
    physicsNote:        'Ha a titkosítás összeomlik, az adást a galaxis fele hallja.',
    generalDescription: 'Összeomlott a titkosítás: a következő kör azonnal Nyílt Frekvencia – bárki ellophatja!',
  },

  // ── Csoport 4: élboly-fékezés ───────────────────────────────
  meteor: {
    id:                 'meteor',
    name:               'Meteorraj',
    emoji:              '☄️',
    weight:             8,
    targeting:          'leader',
    physicsNote:        'A törmelékmező az útvonal elején álló hajókat találja el először.',
    generalDescription: 'Törmelékmező! Az élen álló flotta(k) 2 fényévet hátraesnek.',
  },
};

// ── Súlyozott sorsolás ─────────────────────────────────────────
const _ANOMALY_POOL = Object.values(ANOMALY_EVENTS)
  .flatMap(e => Array(e.weight ?? 10).fill(e.id));

/**
 * Súlyozott húzás úgy, hogy ugyanaz az esemény ne jöjjön kétszer egymás után.
 * @param {string|null} lastId – az előző anomália id-je (game.lastAnomalyId)
 */
function _rollAnomalyId(lastId) {
  for (let i = 0; i < 12; i++) {                 // max 12 próba
    const id = _ANOMALY_POOL[Math.floor(Math.random() * _ANOMALY_POOL.length)];
    if (id !== lastId) return id;                // ne ismétlődjön közvetlenül
  }
  return _ANOMALY_POOL[Math.floor(Math.random() * _ANOMALY_POOL.length)];
}

// ── Segédfüggvények ────────────────────────────────────────────

/**
 * Igaz, ha cellNum anomália-mező (minden N., a START és END kivételével).
 * @param {number} cellNum
 * @param {number} boardLength
 * @param {number} [every=5] – anomália-sűrűség (settings.anomalyEvery); érvénytelen érték → 5
 */
export function isAnomalyCell(cellNum, boardLength, every = 5) {
  const n = (Number.isInteger(every) && every >= 1) ? every : 5;
  return cellNum > 0 && cellNum < boardLength && cellNum % n === 0;
}

// A host-modalok közös törzse (a gomb feliratát a hívó adja meg).
function _modalInnerHTML(teamName, teamColor, event, generalDescription, specificDescription, btnLabel) {
  return `
      <div class="anomaly-modal">
        <div class="anomaly-modal-emoji">${_esc(event.emoji)}</div>
        <div class="anomaly-modal-header">⚠ Űranomália észlelve</div>
        <div class="anomaly-modal-title">${_esc(event.name)}</div>
        <div class="anomaly-modal-team" style="color:${_esc(teamColor)}">
          ${_esc(teamName)} flotta anomáliára lépett
        </div>
        <div class="anomaly-modal-general">${_esc(generalDescription)}</div>
        ${specificDescription ? `<div class="anomaly-modal-body">${_esc(specificDescription)}</div>` : ''}
        ${event.physicsNote ? `<div class="anomaly-modal-note">🔭 ${_esc(event.physicsNote)}</div>` : ''}
        <button class="anomaly-modal-btn">${_esc(btnLabel)}</button>
      </div>
  `;
}

/**
 * Felugró ablak (host) – megvárja az OK gombot.
 * @returns {Promise<void>}
 */
function _showAnomalyModal(teamName, teamColor, event, generalDescription, specificDescription) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'anomaly-modal-overlay';
    overlay.innerHTML = _modalInnerHTML(
      teamName, teamColor, event, generalDescription, specificDescription, 'Hatás alkalmazása →');
    document.body.appendChild(overlay);
    overlay.querySelector('.anomaly-modal-btn').addEventListener('click', () => {
      overlay.remove();
      resolve();
    });
  });
}

/**
 * Féreglyuk 1. lépés: általános leírás + Sorsolás gomb.
 * Resolve-ol { lucky, delta } értékkel a gomb megnyomásakor.
 */
function _showWormholeStep1Modal(teamName, teamColor, event, generalDescription) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'anomaly-modal-overlay';
    overlay.innerHTML = _modalInnerHTML(
      teamName, teamColor, event, generalDescription, '', '🎲 Sorsolás');
    document.body.appendChild(overlay);
    overlay.querySelector('.anomaly-modal-btn').addEventListener('click', () => {
      const lucky = Math.random() < 0.5;
      const delta = lucky ? 3 : -2;
      overlay.remove();
      resolve({ lucky, delta });
    });
  });
}

/**
 * Féreglyuk 2. lépés: konkrét eredmény + Hatás alkalmazása gomb.
 */
function _showWormholeStep2Modal(teamName, teamColor, event, generalDescription, specificDescription) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'anomaly-modal-overlay';
    overlay.innerHTML = _modalInnerHTML(
      teamName, teamColor, event, generalDescription, specificDescription, 'Hatás alkalmazása →');
    document.body.appendChild(overlay);
    overlay.querySelector('.anomaly-modal-btn').addEventListener('click', () => {
      overlay.remove();
      resolve();
    });
  });
}

// ── Fő trigger ────────────────────────────────────────────────

/**
 * Súlyozott sorsolással anomáliát húzunk, alkalmazzuk, és írjuk Firebase-be.
 *
 * @param {string} gameCode
 * @param {Object} game      – aktuális game snapshot (teams már tartalmazza az új pozíciót)
 * @param {number} landingTeamIndex – a csapat indexe, aki anomáliára lépett
 * @returns {{ event, updatedTeams, commDisruptionActive, forceNextTaskType }}
 */
export async function triggerAnomalyEvent(gameCode, game, landingTeamIndex) {
  const teams       = (game.teams || []).map(t => ({ ...t }));
  const boardLength = game.settings?.boardLength || 30;
  const teamColor   = TEAM_COLORS[landingTeamIndex] || '#888';
  const teamName    = teams[landingTeamIndex]?.name || '';
  const anomalyCell = teams[landingTeamIndex]?.score || 0;   // ahol az anomália történik

  // ── 1. Súlyozott sorsolás (nincs közvetlen ismétlés) ───────
  const eventId = _rollAnomalyId(game.lastAnomalyId || null);
  const event   = ANOMALY_EVENTS[eventId];
  const generalDescription = event.generalDescription;

  // updates: csak célzott mezők (NEM az egész teams tömb, hogy a boost inventory ne íródjon felül)
  const updates              = {};
  let   specificDescription  = '';
  let   commDisruptionActive = false;
  let   forceNextTaskType    = null;
  let   affected             = null;  // [{teamIndex, from, to}] – a kivetítő animációjához
  let   boostId              = null;  // csak roncsmezőnél

  updates.lastAnomalyId = eventId;    // a következő sorsolás ismétlés-tiltásához

  // A projektornak átadott közös payload-részek
  const pendingBase = {
    type:                 eventId,
    name:                 event.name,
    emoji:                event.emoji,
    physicsNote:          event.physicsNote || '',
    generalDescription,
    triggeredByTeamIndex: landingTeamIndex,
    focusCell:            anomalyCell,
  };

  // ── Féreglyuk: kétlépéses modal ────────────────────────────
  if (eventId === 'wormhole') {
    // 1. lépés: projektor értesítés (specifikus leírás még ismeretlen)
    await updateGameData(gameCode, {
      anomalyPending: { ...pendingBase, specificDescription: '' },
    });

    // 2. lépés: host sorsolás gomb → eredmény kiszámítása
    const { lucky, delta } = await _showWormholeStep1Modal(teamName, teamColor, event, generalDescription);

    const prev     = teams[landingTeamIndex].score;
    const newScore = Math.max(0, Math.min(boardLength, prev + delta));
    teams[landingTeamIndex] = { ...teams[landingTeamIndex], score: newScore };
    updates[`teams/${landingTeamIndex}/score`] = newScore;
    affected = [{ teamIndex: landingTeamIndex, from: prev, to: newScore }];
    specificDescription = lucky
      ? `Szerencse! ${teamName}: ${prev} → ${newScore} (+3 fényév)`
      : `Balszerencse! ${teamName}: ${prev} → ${newScore} (−2 fényév)`;

    // 3. lépés: projektor frissítése konkrét leírással
    await updateGameData(gameCode, {
      'anomalyPending/specificDescription': specificDescription,
    });

    // 4. lépés: host hatás alkalmazása gomb
    await _showWormholeStep2Modal(teamName, teamColor, event, generalDescription, specificDescription);

    // 5. lépés: hatás érvényesítése
    updates.anomalyPending = null;
    updates.anomalyEvent   = {
      type:                 eventId,
      name:                 event.name,
      emoji:                event.emoji,
      physicsNote:          event.physicsNote || '',
      specificDescription,
      triggeredByTeamIndex: landingTeamIndex,
      focusCell:            anomalyCell,
      affected,
      boostId:              null,
      timestamp:            Date.now(),
    };
    await updateGameData(gameCode, updates);
    try {
      await appendBoostLog(gameCode, {
        message: `${event.emoji} ${event.name} anomália (${teamName} lépett rá): ${specificDescription}`,
        timestamp: Date.now(),
      });
    } catch (_) { /* silent */ }
    return { event, updatedTeams: teams, commDisruptionActive, forceNextTaskType };
  }

  // ── 2. Többi esemény: hatás kiszámítása előre ──────────────
  switch (eventId) {
    // Lökéshullám: az anomália-mezőtől ±2-n belül MINDENKI hátravetődik.
    case 'supernova': {
      const movedNames = [];
      affected = [];
      teams.forEach((t, i) => {
        const s = t.score || 0;
        if (Math.abs(s - anomalyCell) > SHOCKWAVE_RADIUS) return;
        const ns = Math.max(0, s - 2);
        if (ns === s) return;                          // a 0-n álló flotta nem mozdul
        movedNames.push(t.name);
        affected.push({ teamIndex: i, from: s, to: ns });
        teams[i] = { ...t, score: ns };
        updates[`teams/${i}/score`] = ns;
      });
      specificDescription = movedNames.length
        ? `A lökéshullám hátraveti: ${movedNames.join(', ')} −2 fényév`
        : 'A lökéshullám senkit sem ért el.';
      break;
    }

    // Idődilatáció: a rálépő kimarad a következő köréből.
    case 'blackhole': {
      updates[`teams/${landingTeamIndex}/skipNextTurn`] = true;
      updates[`teams/${landingTeamIndex}/skipReason`]   = 'blackhole';
      teams[landingTeamIndex] = {
        ...teams[landingTeamIndex],
        skipNextTurn: true,
        skipReason:   'blackhole',
      };
      specificDescription = `${teamName} beleragadt az eseményhorizontba – kimarad a következő köréből!`;
      break;
    }

    // Roncsmező: véletlen boost a rálépőnek.
    // FONTOS: nem addBoostToTeam()-mel, mert az azonnal írna a DB-be –
    // itt a hatás csak a modal OK gombja után érvényesülhet.
    case 'salvage': {
      boostId = getRandomBoost();
      const inv = [...(teams[landingTeamIndex].inventory || []), boostId];
      teams[landingTeamIndex] = { ...teams[landingTeamIndex], inventory: inv };
      updates[`teams/${landingTeamIndex}/inventory`] = inv;
      const b = BOOST_TYPES[boostId];
      specificDescription = `${teamName} fejlesztést talált a roncsok között: ${b.emoji} ${b.name}!`;
      break;
    }

    // Hintamanőver: a leghátul állók +2 (a régi „szupernóva” hatás, helyes névvel).
    case 'slingshot': {
      const minScore   = Math.min(...teams.map(t => t.score || 0));
      const newScore   = Math.min(boardLength, minScore + 2);
      const movedNames = [];
      affected = [];
      teams.forEach((t, i) => {
        if ((t.score || 0) === minScore) {
          movedNames.push(t.name);
          affected.push({ teamIndex: i, from: minScore, to: newScore });
          teams[i] = { ...t, score: newScore };
          updates[`teams/${i}/score`] = newScore;
        }
      });
      specificDescription = `Gravitációs lendület: ${movedNames.join(' és ')} előrelép ${minScore} → ${newScore}`;
      break;
    }

    // Vontatósugár: a leghátul állók behozzák a lemaradás felét
    // (a régi „fekete lyuk” hatás, helyes névvel).
    case 'tractorbeam': {
      let maxScore = -Infinity, minScore = Infinity;
      teams.forEach(t => {
        const s = t.score || 0;
        if (s > maxScore) maxScore = s;
        if (s < minScore) minScore = s;
      });
      const advance = Math.floor((maxScore - minScore) / 2);
      if (advance > 0) {
        const movedNames = [];
        const newScore   = Math.min(boardLength, minScore + advance);   // a TÉNYLEGESEN beírt érték
        affected = [];
        teams.forEach((t, i) => {
          if ((t.score || 0) === minScore) {
            movedNames.push(t.name);
            affected.push({ teamIndex: i, from: minScore, to: newScore });
            teams[i] = { ...t, score: newScore };
            updates[`teams/${i}/score`] = newScore;
          }
        });
        specificDescription =
          `A vontatósugár behúzza: ${movedNames.join(' és ')} ${minScore} → ${newScore}`;
      } else {
        specificDescription = 'A flották egyenlő helyzetben vannak – nincs mit behozni.';
      }
      break;
    }

    // Meteorraj: az élen állók −2.
    case 'meteor': {
      const maxScore   = Math.max(...teams.map(t => t.score || 0));
      const movedNames = [];
      affected = [];
      teams.forEach((t, i) => {
        if ((t.score || 0) !== maxScore) return;
        const ns = Math.max(0, maxScore - 2);
        movedNames.push(t.name);
        affected.push({ teamIndex: i, from: maxScore, to: ns });
        teams[i] = { ...t, score: ns };
        updates[`teams/${i}/score`] = ns;
      });
      specificDescription = `${movedNames.join(' és ')} törmelékmezőbe futott: −2 fényév`;
      break;
    }

    // Kommunikációs zavar: a következő kör kényszerítve mutogatás.
    case 'comms': {
      forceNextTaskType = 'mutogatás';
      updates.forceNextTaskType = forceNextTaskType;
      specificDescription = 'A csatorna zajos! A következő körben csak mutogatni lehet – se beszéd, se rajz.';
      break;
    }

    // Nyílt frekvencia: a következő kör azonnal a 3. fázisban indul.
    // (A commDisruptionActive ADATMEZŐ neve marad – több modul is használja.)
    case 'openfreq': {
      updates.commDisruptionActive = true;
      commDisruptionActive = true;
      specificDescription = 'A titkosítás összeomlott – a következő kör teljes egészében rabolható!';
      break;
    }
  }

  // ── 3. Projektor értesítése ────────────────────────────────
  await updateGameData(gameCode, {
    anomalyPending: { ...pendingBase, specificDescription },
  });

  // ── 4. Host felugró ablak ──────────────────────────────────
  await _showAnomalyModal(teamName, teamColor, event, generalDescription, specificDescription);

  // ── 5. Hatás érvényesítése ────────────────────────────────
  updates.anomalyPending = null;
  updates.anomalyEvent   = {
    type:                 eventId,
    name:                 event.name,
    emoji:                event.emoji,
    physicsNote:          event.physicsNote || '',
    specificDescription,
    triggeredByTeamIndex: landingTeamIndex,
    focusCell:            anomalyCell,
    affected:             affected || null,
    boostId:              boostId || null,
    timestamp:            Date.now(),
  };
  await updateGameData(gameCode, updates);
  try {
    await appendBoostLog(gameCode, {
      message: `${event.emoji} ${event.name} anomália (${teamName} lépett rá): ${specificDescription}`,
      timestamp: Date.now(),
    });
  } catch (_) { /* silent */ }

  return { event, updatedTeams: teams, commDisruptionActive, forceNextTaskType };
}
