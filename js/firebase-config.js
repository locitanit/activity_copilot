/**
 * firebase-config.js
 * Firebase Realtime Database inicializálás + adatbázis segédfüggvények.
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getDatabase,
  ref,
  set,
  push,
  update,
  onValue,
  get,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

// ── Firebase konfiguráció ──────────────────────────────────────
const firebaseConfig = {
  apiKey:            'AIzaSyCPHAQppiZT2P51NWfPESwOikFT0sZUbm0',
  authDomain:        'rmg-activity-d57fd.firebaseapp.com',
  databaseURL:       'https://rmg-activity-d57fd-default-rtdb.europe-west1.firebasedatabase.app/',
  projectId:         'rmg-activity-d57fd',
  storageBucket:     'rmg-activity-d57fd.firebasestorage.app',
  messagingSenderId: '1084515363065',
  appId:             '1:1084515363065:web:743a3215c31a2ff3fb1a28',
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

// ── Segédfüggvények ────────────────────────────────────────────

/**
 * 6 karakteres, egyedi játékkódot generál (zavaros karakterek kihagyva).
 * @returns {string}
 */
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

/**
 * Új játékot hoz létre a Firebase-ben.
 * @param {Object} settings  A host beállítások (teamCount, teamNames, boardLength, …)
 * @returns {Promise<string>} A generált játékkód
 */
export async function createGame(settings) {
  let code;
  let attempts = 0;

  // Ütközéskerülés: addig generál új kódot, amíg egyedi nem lesz
  do {
    code = generateCode();
    const snap = await get(ref(db, `games/${code}`));
    if (!snap.exists()) break;
    attempts++;
  } while (attempts < 10);

  const teamCount  = Math.max(2, parseInt(settings.teamCount, 10) || 2);
  const teamNames  = (settings.teamNames || []).slice(0, teamCount);
  const boardLen   = Math.max(5,  parseInt(settings.boardLength, 10) || 30);
  const anomalyEvery = Math.max(2, parseInt(settings.anomalyEvery, 10) || 5); // anomália minden N. mezőn

  const gameData = {
    status: 'lobby',
    createdAt: serverTimestamp(),
    settings: {
      teamCount,
      assignmentType:   settings.assignmentType   || 'random',
      teamNames,
      boardLength:      boardLen,
      anomalyEvery,
      selectedTopics:   settings.selectedTopics   || [],
      allowedTaskTypes: settings.allowedTaskTypes || [],
    },
    players:       {},
    teams:         teamNames.map(name => ({ name, score: 0, inventory: [], skipNextTurn: false })),
    currentTurn:   null,
    upcomingTurns: [],
    turnHistory:   [],
    traps:         {},
    boostLog:      [],
  };

  await set(ref(db, `games/${code}`), gameData);
  return code;
}

/**
 * Csatlakoztatja a játékost egy meglévő játékhoz.
 * @param {string} code        Játékkód (nagybetűs)
 * @param {string} playerName  Játékos neve
 * @returns {Promise<{playerId: string, gameCode: string}>}
 * @throws Ha a játék nem létezik vagy már véget ért
 */
export async function joinGame(code, playerName) {
  const snap = await get(ref(db, `games/${code}`));
  if (!snap.exists()) throw new Error('Nem található ilyen kód!');

  const game = snap.val();
  if (game.status === 'finished') throw new Error('Ez a játék már véget ért.');

  const trimmedName = playerName.trim();
  const existingPlayers = game.players ? Object.values(game.players) : [];
  const nameTaken = existingPlayers.some(
    p => p.name.trim().toLowerCase() === trimmedName.toLowerCase()
  );
  if (nameTaken) throw new Error('Ez a név már foglalt ebben a játékban!');

  const newRef = push(ref(db, `games/${code}/players`));
  await set(newRef, {
    name:      trimmedName,
    teamIndex: -1,   // -1 = még nem osztottak csapatba
    turnCount: 0,
  });

  return { playerId: newRef.key, gameCode: code };
}

/**
 * Feliratkozik a játék valós idejű frissítéseire.
 * @param {string}   code      Játékkód
 * @param {function} callback  Hívódik a frissített game objektummal (vagy null-lal)
 * @returns {function} Leiratkozási (unsubscribe) függvény
 */
export function listenToGame(code, callback) {
  const gameRef = ref(db, `games/${code}`);
  return onValue(gameRef, snap => callback(snap.val()));
}

/**
 * Több adatbázis-mezőt egyszerre, atomikusan frissít a játékon belül.
 * @param {string} code     Játékkód
 * @param {Object} updates  Kulcs-érték párok, ahol a kulcs az adatbázis elérési útja
 *                          a games/{code}/ gyökér alól. Pl.:
 *                          { 'currentTurn/word': 'Alma', 'teams/0/score': 5 }
 * @returns {Promise<void>}
 */
export async function updateGameData(code, updates) {
  const prefixed = {};
  for (const [path, value] of Object.entries(updates)) {
    prefixed[`games/${code}/${path}`] = value;
  }
  await update(ref(db), prefixed);
}

/**
 * Egyszeri olvasás a játékról (nem real-time figyelő).
 * @param {string} code
 * @returns {Promise<Object|null>}
 */
export async function getGame(code) {
  const snap = await get(ref(db, `games/${code}`));
  return snap.val();
}

/**
 * Hozzáfűz egy bejegyzést az eseménynaplóhoz (boostLog).
 * A legfrissebb naplót olvassa be írás előtt, így a host által egy körön belül
 * sorosan kiadott több naplóírás nem írja felül egymást (stale-snapshot probléma).
 * @param {string} code   Játékkód
 * @param {Object} entry  Naplóbejegyzés ({ message, timestamp, ... })
 * @param {number} [cap=500]  Megőrzött bejegyzések maximuma
 */
export async function appendBoostLog(code, entry, cap = 500) {
  const snap = await get(ref(db, `games/${code}/boostLog`));
  const raw  = snap.val();
  const log  = Array.isArray(raw)
    ? [...raw]
    : (raw && typeof raw === 'object' ? Object.values(raw) : []);
  log.push(entry);
  if (log.length > cap) log.splice(0, log.length - cap);
  await update(ref(db), { [`games/${code}/boostLog`]: log });
}

/**
 * Egyszeri olvasás az eseménynaplóról (a torpedó atomi írásához kell).
 * @param {string} code
 * @returns {Promise<Array>}
 */
export async function getBoostLog(code) {
  const snap = await get(ref(db, `games/${code}/boostLog`));
  const raw = snap.val();
  return Array.isArray(raw) ? raw : (raw && typeof raw === 'object' ? Object.values(raw) : []);
}

/** Törli az összes játékot az adatbázisból. */
export async function deleteAllGames() {
  await set(ref(db, 'games'), null);
}

/**
 * Töröl egy adott játékot (a host fejezi be a küldetést).
 * A többi kliens listenere ekkor null-t kap, és visszatér a főmenübe.
 * @param {string} code  Játékkód
 */
export async function deleteGame(code) {
  await set(ref(db, `games/${code}`), null);
}

/**
 * Eltávolít egy játékost a játékból (a játékos kilép).
 * @param {string} code      Játékkód
 * @param {string} playerId  A játékos Firebase push-kulcsa
 */
export async function removePlayer(code, playerId) {
  if (!code || !playerId) return;
  await set(ref(db, `games/${code}/players/${playerId}`), null);
}

export { serverTimestamp };
