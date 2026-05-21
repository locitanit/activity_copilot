/**
 * logic/anomaly.js – Űranomália rendszer
 * ══════════════════════════════════════════
 * Minden 5. mező (5, 10, 15, …) anomália-mező.
 * Ha egy csapat ide lép a pontszerzés után, véletlenszerű esemény indul.
 *
 * Események (egyforma valószínűség):
 *   💥 Szupernóva           – az utolsó csapat +2 fényév
 *   🌀 Féreglyuk            – a lépő csapat: 50% +3, 50% −2
 *   ⚫ Fekete lyuk horizont – az utolsó csapat a lemaradás felét behozza
 *   📡 Kommunikációs zavar  – a következő körben azonnal Nyílt Frekvencia (30 mp)
 */

import { updateGameData } from '../firebase-config.js';

const TEAM_COLORS = ['#ef4444','#3b82f6','#22c55e','#f59e0b','#a855f7','#ec4899'];

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const ANOMALY_EVENTS = {
  supernova: {
    id:                 'supernova',
    name:               'Szupernóva',
    emoji:              '💥',
    generalDescription: 'Az utolsó helyen lévő flotta(k) előrelépnek 2 fényévet!',
  },
  wormhole: {
    id:                 'wormhole',
    name:               'Féreglyuk',
    emoji:              '🌀',
    generalDescription: 'Kvantumugrás – 50% eséllyel +3, 50% eséllyel −2 fényév az anomáliára lépő csapatnak!',
  },
  blackhole: {
    id:                 'blackhole',
    name:               'Fekete lyuk eseményhorizont',
    emoji:              '⚫',
    generalDescription: 'Az első és utolsó csapat közötti távolság megfeleződik – az utolsó helyezett flotta/flották előrehúzódnak.',
  },
  comms: {
    id:                 'comms',
    name:               'Kommunikációs zavar',
    emoji:              '📡',
    generalDescription: 'A következő körben nincs Titkosított csatorna – azonnal Nyílt Frekvencia aktiválódik!',
  },
};

// ── Segédfüggvények ────────────────────────────────────────────

/** Igaz, ha cellNum anomália-mező (minden 5., a START és END kivételével). */
export function isAnomalyCell(cellNum, boardLength) {
  return cellNum > 0 && cellNum < boardLength && cellNum % 5 === 0;
}

/**
 * Felugró ablak (host) – megvárja az OK gombot.
 * @returns {Promise<void>}
 */
function _showAnomalyModal(teamName, teamColor, event, generalDescription, specificDescription) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'anomaly-modal-overlay';

    overlay.innerHTML = `
      <div class="anomaly-modal">
        <div class="anomaly-modal-emoji">${_esc(event.emoji)}</div>
        <div class="anomaly-modal-header">⚠ Űranomália észlelve</div>
        <div class="anomaly-modal-title">${_esc(event.name)}</div>
        <div class="anomaly-modal-team" style="color:${_esc(teamColor)}">
          ${_esc(teamName)} flotta anomáliára lépett
        </div>
        <div class="anomaly-modal-general">${_esc(generalDescription)}</div>
        <div class="anomaly-modal-body">${_esc(specificDescription)}</div>
        <button class="anomaly-modal-btn">Hatás alkalmazása →</button>
      </div>
    `;

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
    overlay.innerHTML = `
      <div class="anomaly-modal">
        <div class="anomaly-modal-emoji">${_esc(event.emoji)}</div>
        <div class="anomaly-modal-header">⚠ Űranomália észlelve</div>
        <div class="anomaly-modal-title">${_esc(event.name)}</div>
        <div class="anomaly-modal-team" style="color:${_esc(teamColor)}">
          ${_esc(teamName)} flotta anomáliára lépett
        </div>
        <div class="anomaly-modal-general">${_esc(generalDescription)}</div>
        <button class="anomaly-modal-btn">🎲 Sorsolás</button>
      </div>
    `;
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
    overlay.innerHTML = `
      <div class="anomaly-modal">
        <div class="anomaly-modal-emoji">${_esc(event.emoji)}</div>
        <div class="anomaly-modal-header">⚠ Űranomália észlelve</div>
        <div class="anomaly-modal-title">${_esc(event.name)}</div>
        <div class="anomaly-modal-team" style="color:${_esc(teamColor)}">
          ${_esc(teamName)} flotta anomáliára lépett
        </div>
        <div class="anomaly-modal-general">${_esc(generalDescription)}</div>
        <div class="anomaly-modal-body">${_esc(specificDescription)}</div>
        <button class="anomaly-modal-btn">Hatás alkalmazása →</button>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('.anomaly-modal-btn').addEventListener('click', () => {
      overlay.remove();
      resolve();
    });
  });
}

// ── Fő trigger ────────────────────────────────────────────────

/**
 * Véletlenszerű anomália eseményt sorsolunk, alkalmazzuk, és írjuk Firebase-be.
 *
 * @param {string} gameCode
 * @param {Object} game      – aktuális game snapshot (teams már tartalmazza az új pozíciót)
 * @param {number} landingTeamIndex – a csapat indexe, aki anomáliára lépett
 * @returns {{ event: Object, updatedTeams: Array, commDisruptionActive: boolean }}
 */
export async function triggerAnomalyEvent(gameCode, game, landingTeamIndex) {
  const teams       = (game.teams || []).map(t => ({ ...t }));
  const boardLength = game.settings?.boardLength || 30;
  const teamColor   = TEAM_COLORS[landingTeamIndex] || '#888';
  const teamName    = teams[landingTeamIndex]?.name || '';

  // ── 1. Sorsolás ────────────────────────────────────────────
  const eventKeys = Object.keys(ANOMALY_EVENTS);
  const eventId   = eventKeys[Math.floor(Math.random() * eventKeys.length)];
  const event     = ANOMALY_EVENTS[eventId];
  const generalDescription = event.generalDescription;

  // updates: csak célzott mezők (NEM az egész teams tömb, hogy a boost inventory ne íródjon felül)
  const updates              = {};
  let   specificDescription  = '';
  let   commDisruptionActive = false;

  // ── Féreglyuk: kétlépéses modal ────────────────────────────
  if (eventId === 'wormhole') {
    // 1. lépés: projektor értesítés (specifikus leírás még ismeretlen)
    await updateGameData(gameCode, {
      anomalyPending: {
        type:                 'wormhole',
        name:                 event.name,
        emoji:                event.emoji,
        generalDescription,
        specificDescription:  '',
        triggeredByTeamIndex: landingTeamIndex,
      },
    });

    // 2. lépés: host sorsolás gomb → eredmény kiszámítása
    const { lucky, delta } = await _showWormholeStep1Modal(teamName, teamColor, event, generalDescription);

    const prev     = teams[landingTeamIndex].score;
    const newScore = Math.max(0, Math.min(boardLength, prev + delta));
    teams[landingTeamIndex] = { ...teams[landingTeamIndex], score: newScore };
    updates[`teams/${landingTeamIndex}/score`] = newScore;
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
      type:                 'wormhole',
      name:                 event.name,
      emoji:                event.emoji,
      specificDescription,
      triggeredByTeamIndex: landingTeamIndex,
      timestamp:            Date.now(),
    };
    await updateGameData(gameCode, updates);
    return { event, updatedTeams: teams, commDisruptionActive };
  }

  // ── 2. Többi esemény: hatás kiszámítása előre ──────────────
  switch (eventId) {
    case 'supernova': {
      const minScore   = Math.min(...teams.map(t => t.score));
      const newScore   = Math.min(boardLength, minScore + 2);
      const movedNames = [];
      teams.forEach((t, i) => {
        if (t.score === minScore) {
          movedNames.push(t.name);
          teams[i] = { ...t, score: newScore };
          updates[`teams/${i}/score`] = newScore;
        }
      });
      specificDescription = `${movedNames.join(' és ')} előrelép: ${minScore} → ${newScore}`;
      break;
    }

    case 'blackhole': {
      let maxScore = -Infinity, minScore = Infinity;
      teams.forEach(t => {
        if (t.score > maxScore) maxScore = t.score;
        if (t.score < minScore) minScore = t.score;
      });
      const gap     = maxScore - minScore;
      const advance = Math.floor(gap / 2);
      if (advance > 0) {
        const movedNames = [];
        teams.forEach((t, i) => {
          if (t.score === minScore) {
            movedNames.push(t.name);
            const ns = Math.min(boardLength, t.score + advance);
            teams[i] = { ...t, score: ns };
            updates[`teams/${i}/score`] = ns;
          }
        });
        specificDescription = `${movedNames.join(' és ')} előrehúzódik ${advance} fényévet: ${minScore} → ${minScore + advance}`;
      } else {
        specificDescription = 'A flották egyenlő helyzetben vannak – nincs hatás.';
      }
      break;
    }

    case 'comms': {
      updates.commDisruptionActive = true;
      commDisruptionActive = true;
      specificDescription = 'A következő kör azonnal Nyílt Frekvencia – a teljes kör rabolható!';
      break;
    }
  }

  // ── 3. Projektor értesítése ────────────────────────────────
  await updateGameData(gameCode, {
    anomalyPending: {
      type:                 eventId,
      name:                 event.name,
      emoji:                event.emoji,
      generalDescription,
      specificDescription,
      triggeredByTeamIndex: landingTeamIndex,
    },
  });

  // ── 4. Host felugró ablak ──────────────────────────────────
  await _showAnomalyModal(teamName, teamColor, event, generalDescription, specificDescription);

  // ── 5. Hatás érvényesítése ────────────────────────────────
  updates.anomalyPending = null;
  updates.anomalyEvent   = {
    type:                 eventId,
    name:                 event.name,
    emoji:                event.emoji,
    specificDescription,
    triggeredByTeamIndex: landingTeamIndex,
    timestamp:            Date.now(),
  };
  await updateGameData(gameCode, updates);

  return { event, updatedTeams: teams, commDisruptionActive };
}
