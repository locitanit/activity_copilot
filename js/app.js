/**
 * app.js – Belépési pont
 * Globális kliens állapot, view-váltó, URL-param routing, Firebase game listener.
 */

import { listenToGame, deleteGame, removePlayer } from './firebase-config.js';
import { renderLanding }    from './views/landing.js';
import { renderHostSetup }  from './views/host-setup.js';
import { renderLobby }      from './views/lobby.js';
import { renderProjector }  from './views/projector.js';
import { renderHostGame }   from './views/host-game.js';
import { renderPlayerGame } from './views/player-game.js';
import { renderWinner }     from './views/winner.js';

// ── Globális kliens állapot ────────────────────────────────────
export const state = {
  gameCode:    null,    // Aktív játék kódja
  playerId:    null,    // Firebase push-kulcs (játékosoknak)
  playerName:  null,    // Megjelenítési név
  isHost:      false,   // Host-e a kliens?
  _unsubscribe: null,   // Firebase onValue leiratkozó függvény
};
// ── Session persistence (reconnect támogatás) ──────────────────────
const _SESSION_KEY = 'rmg-session';

function saveSession() {
  if (!state.gameCode) return;
  localStorage.setItem(_SESSION_KEY, JSON.stringify({
    gameCode:    state.gameCode,
    playerId:    state.playerId,
    playerName:  state.playerName,
    isHost:      state.isHost,
  }));
}

export function clearSession() {
  localStorage.removeItem(_SESSION_KEY);
}
// ── View-váltó ─────────────────────────────────────────────────
/**
 * Pontosan egy view-t mutat meg, az összes többit elrejti.
 * @param {string} viewId  A megjelenítendő div id-ja
 */
export function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(viewId);
  if (target) target.classList.add('active');
}

// ── Toast értesítés ────────────────────────────────────────────
/**
 * Rövid, automatikusan eltűnő üzenetsáv.
 * @param {string} message
 * @param {number} [duration=3000]
 */
export function showToast(message, duration = 3000) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

// ── Kilépés a játékból / vissza a főmenübe ─────────────────────
/**
 * Leiratkozik a Firebase figyelőről, törli a mentett munkamenetet,
 * visszaállítja a kliens állapotot és visszatér a főmenüre.
 * Ez a központi "vissza a kezdőlapra" útvonal (rejoin csapda feloldása).
 */
export function exitToMenu() {
  if (state._unsubscribe) {
    state._unsubscribe();
    state._unsubscribe = null;
  }
  clearSession();
  state.gameCode   = null;
  state.playerId   = null;
  state.playerName = null;
  state.isHost     = false;
  showView('view-landing');
  renderLanding();
}

/**
 * A felhasználó kilép az aktuális játékból.
 * Host esetén megerősítés után törli a játékot (mindenki kilép),
 * játékos esetén eltávolítja magát a játékosok közül. Végül főmenü.
 */
export async function leaveCurrentGame() {
  const { gameCode, playerId, isHost } = state;

  const message = isHost
    ? 'Biztosan befejezed a küldetést? Minden asztronauta kilép, és a játék törlődik.'
    : 'Biztosan kilépsz a küldetésből?';
  if (!window.confirm(message)) return;

  // Előbb leiratkozunk, hogy a saját törlésünkre ne fussunk rá feleslegesen.
  if (state._unsubscribe) {
    state._unsubscribe();
    state._unsubscribe = null;
  }

  try {
    if (gameCode && isHost) {
      await deleteGame(gameCode);
    } else if (gameCode && playerId) {
      await removePlayer(gameCode, playerId);
    }
  } catch (err) {
    showToast('Hiba a kilépéskor: ' + (err.message || 'ismeretlen'));
  }

  exitToMenu();
}

/**
 * A játék-nézetekbe beilleszthető, rögzített "kilépés" gomb HTML-je.
 * A felirat a szereptől függ (host: befejezés, játékos: kilépés).
 * @returns {string}
 */
export function leaveBarHtml() {
  const label = state.isHost ? 'Kilépés a küldetésből' : 'Kilépés';
  return `<button type="button" id="btn-leave-game" title="Vissza a főmenübe"
            class="flex items-center gap-2 text-error hover:text-error-container transition-colors font-label-md text-label-md uppercase">
            <span class="material-symbols-outlined">logout</span>
            <span class="hidden sm:inline">${label}</span>
          </button>`;
}

/** Bekötí a kilépés gomb eseménykezelőjét (újrarendereléskor hívni kell). */
export function wireLeaveBar() {
  const btn = document.getElementById('btn-leave-game');
  if (btn) btn.addEventListener('click', () => leaveCurrentGame());
}

// ── Firebase game listener ─────────────────────────────────────
/**
 * Elindítja (vagy újraindítja) a Firebase real-time figyelőt a megadott játékra.
 * A game.status alapján a megfelelő view-t rendereli.
 * @param {string} code  Játékkód
 */
export function startGameListener(code) {
  saveSession();
  // Korábbi listener leállítása
  if (state._unsubscribe) {
    state._unsubscribe();
    state._unsubscribe = null;
  }

  state._unsubscribe = listenToGame(code, (game) => {
    if (!game) {
      clearSession();
      showToast('A játék nem található vagy törölve lett.');
      showView('view-landing');
      renderLanding();
      return;
    }

    if (state.isHost) {
      // ── Host routing ─────────────────────────────────────────
      switch (game.status) {
        case 'lobby':
          showView('view-lobby');
          renderLobby(game, state);
          break;
        case 'briefing':
          showView('view-host-game');
          renderHostGame(game, state);
          break;
        case 'playing':
          showView('view-host-game');
          renderHostGame(game, state);
          break;
        case 'finished':
          showView('view-winner');
          renderWinner(game, state);
          break;
        default:
          showView('view-lobby');
          renderLobby(game, state);
      }
    } else {
      // ── Játékos routing ───────────────────────────────────────
      switch (game.status) {
        case 'lobby':
          showView('view-lobby');
          renderLobby(game, state);
          break;
        case 'briefing':
          showView('view-player-game');
          renderPlayerGame(game, state);
          break;
        case 'playing':
          showView('view-player-game');
          renderPlayerGame(game, state);
          break;
        case 'finished':
          showView('view-winner');
          renderWinner(game, state);
          break;
        default:
          showView('view-lobby');
          renderLobby(game, state);
      }
    }
  });
}

// ── URL-param alapú bootstrap ──────────────────────────────────
const params  = new URLSearchParams(window.location.search);
const urlRole = params.get('role');
const urlRoom = params.get('room');

function _hideSplash() {
  const s = document.getElementById('splash');
  if (!s) return;
  s.classList.add('fade-out');
  setTimeout(() => s.remove(), 700);
}

if (urlRole === 'projector' && urlRoom) {
  // ── Kivetítő ablak ─────────────────────────────────────────
  document.getElementById('splash')?.remove();
  // Ezt a window.open() nyitja meg a host vezérlőpultjáról.
  const code = urlRoom.toUpperCase();
  state.gameCode = code;
  document.title = `Kivetítő – ${code}`;

  // Sötét háttér azonnal, még a Firebase válasz előtt
  showView('view-projector');
  document.getElementById('view-projector').innerHTML =
    '<p style="margin:auto;color:#444;font-size:1.5rem">Csatlakozás...</p>';

  listenToGame(code, (game) => {
    if (!game) {
      document.getElementById('view-projector').innerHTML =
        '<p style="margin:auto;color:#555;font-size:1.2rem">Játék nem található.</p>';
      return;
    }
    showView('view-projector');
    renderProjector(game);
  });

} else {
  // ── Normál alkalmazás ──────────────────────────────────────
  const _saved = localStorage.getItem(_SESSION_KEY);
  if (_saved) {
    try {
      const sess = JSON.parse(_saved);
      state.gameCode   = sess.gameCode;
      state.playerId   = sess.playerId   ?? null;
      state.playerName = sess.playerName ?? null;
      state.isHost     = !!sess.isHost;
      _hideSplash();
      startGameListener(sess.gameCode);
    } catch {
      clearSession();
      setTimeout(() => { _hideSplash(); showView('view-landing'); renderLanding(); }, 4000);
    }
  } else {
    setTimeout(() => {
      _hideSplash();
      showView('view-landing');
      renderLanding();
    }, 4000);
  }
}

// ── Exportok más view-moduloknak ──────────────────────────────
export { renderLanding, renderHostSetup };
