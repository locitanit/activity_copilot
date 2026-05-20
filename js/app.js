/**
 * app.js – Belépési pont
 * Globális kliens állapot, view-váltó, URL-param routing, Firebase game listener.
 */

import { listenToGame } from './firebase-config.js';
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

// ── Firebase game listener ─────────────────────────────────────
/**
 * Elindítja (vagy újraindítja) a Firebase real-time figyelőt a megadott játékra.
 * A game.status alapján a megfelelő view-t rendereli.
 * @param {string} code  Játékkód
 */
export function startGameListener(code) {
  // Korábbi listener leállítása
  if (state._unsubscribe) {
    state._unsubscribe();
    state._unsubscribe = null;
  }

  state._unsubscribe = listenToGame(code, (game) => {
    if (!game) {
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
  setTimeout(() => {
    _hideSplash();
    showView('view-landing');
    renderLanding();
  }, 4000);
}

// ── Exportok más view-moduloknak ──────────────────────────────
export { renderLanding, renderHostSetup };
