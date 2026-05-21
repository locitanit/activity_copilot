/**
 * views/landing.js – View 1: Főmenü
 * Gombok: "Új játék létrehozása (Host)" és "Csatlakozás kóddal".
 */

import { showView, showToast, state, startGameListener } from '../app.js';
import { joinGame } from '../firebase-config.js';

/** Inject randomly-placed star box-shadows on each visit */
function _genStars() {
  let s = document.getElementById('landing-stars-css');
  if (!s) {
    s = document.createElement('style');
    s.id = 'landing-stars-css';
    document.head.appendChild(s);
  }
  const W = Math.max(window.innerWidth, 1920);
  const H = Math.max(window.innerHeight, 1080);
  const ri = (n) => Math.floor(Math.random() * n);
  const ra = (lo, hi) => (Math.random() * (hi - lo) + lo).toFixed(2);
  const dots = (n, r, g, b) =>
    Array.from({ length: n }, () =>
      `${ri(W)}px ${ri(H)}px rgba(${r},${g},${b},${ra(0.4, 0.9)})`
    ).join(',');
  const bright = (n) =>
    Array.from({ length: n }, () => {
      const sp = ri(3) + 2;
      return `${ri(W)}px ${ri(H)}px ${sp}px 1px rgba(255,255,255,${ra(0.7, 1)})`;
    }).join(',');
  s.textContent = [
    `.sf1::before{box-shadow:${dots(260, 255, 255, 255)}}`,
    `.sf1::after{box-shadow:${dots(90, 220, 180, 255)}}`,
    `.sf2::before{box-shadow:${dots(220, 255, 255, 255)}}`,
    `.sf2::after{box-shadow:${dots(70, 180, 220, 255)}}`,
    `.sf3::before{box-shadow:${dots(320, 255, 255, 255)}}`,
    `.sf3::after{box-shadow:${dots(60, 220, 180, 255)}}`,
    `.sf4::before{box-shadow:${dots(150, 180, 220, 255)}}`,
    `.sf4::after{box-shadow:${bright(22)}}`,
  ].join('\n');
}

export function renderLanding() {
  const el = document.getElementById('view-landing');

  el.innerHTML = `
    <div class="star-field sf1" aria-hidden="true"></div>
    <div class="star-field sf2" aria-hidden="true"></div>
    <div class="star-field sf3" aria-hidden="true"></div>
    <div class="star-field sf4" aria-hidden="true"></div>

    <img class="landing-obj obj-blackhole" src="img/black_hole.png" alt="">
    <img class="landing-obj obj-station"   src="img/space_station.png" alt="">

    <h1>RMG ASTRO-ACTIVITY</h1>
    <p class="subtitle">Galaktikus csapatjáték</p>

    <div class="btn-group">
      <button class="btn btn-primary btn-lg" id="btn-new-game">
        Új küldetés
      </button>
      <button class="btn btn-secondary btn-lg" id="btn-join-game">
        Csatlakozás kóddal
      </button>
    </div>

    <!-- Csatlakozás overlay / modal -->
    <div class="overlay hidden" id="join-overlay">
      <div class="card modal">
        <h2>Belépés a küldetésbe</h2>

        <div class="form-group">
          <label for="join-code">Küldetés-kód</label>
          <input
            id="join-code"
            type="text"
            placeholder="A1B2"
            maxlength="4"
            autocomplete="off"
            spellcheck="false"
            style="text-transform:uppercase;letter-spacing:0.25em;font-size:1.4rem;text-align:center"
          />
        </div>

        <div class="form-group">
          <label for="join-name">Asztronauta neve</label>
          <input id="join-name" type="text" placeholder="Pl. Commandante" maxlength="30" autocomplete="off" />
        </div>

        <div class="modal-actions">
          <button class="btn btn-primary btn-full" id="btn-join-confirm">Belépés →</button>
          <button class="btn btn-secondary" id="btn-join-cancel">Mégse</button>
        </div>
      </div>
    </div>
  `;

  _genStars();

  // ── Eseménykezelők ──────────────────────────────────────────

  document.getElementById('btn-new-game').addEventListener('click', () => {
    // Lazy import: host-setup.js-t csak akkor töltjük, ha kell
    import('./host-setup.js').then(({ renderHostSetup }) => {
      showView('view-host-setup');
      renderHostSetup();
    });
  });

  document.getElementById('btn-join-game').addEventListener('click', () => {
    document.getElementById('join-overlay').classList.remove('hidden');
    document.getElementById('join-code').focus();
  });

  document.getElementById('btn-join-cancel').addEventListener('click', _closeJoinOverlay);

  // Overlay-en kívülre kattintás → bezárás
  document.getElementById('join-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('join-overlay')) _closeJoinOverlay();
  });

  document.getElementById('btn-join-confirm').addEventListener('click', _handleJoin);

  // Enter billentyű az input mezőkön
  ['join-code', 'join-name'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', (e) => {
      if (e.key === 'Enter') _handleJoin();
    });
  });

  // Automatikus nagybetűsítés a kód mezőben
  document.getElementById('join-code').addEventListener('input', (e) => {
    const pos = e.target.selectionStart;
    e.target.value = e.target.value.toUpperCase();
    e.target.setSelectionRange(pos, pos);
  });
}

// ── Privát segédfüggvények ─────────────────────────────────────

function _closeJoinOverlay() {
  document.getElementById('join-overlay').classList.add('hidden');
}

async function _handleJoin() {
  const code = document.getElementById('join-code').value.trim().toUpperCase();
  const name = document.getElementById('join-name').value.trim();

  if (!code || code.length < 4) { showToast('Add meg a játékkódot!'); return; }
  if (!name)                     { showToast('Add meg a nevedet!'); return; }

  const btn = document.getElementById('btn-join-confirm');
  btn.disabled = true;
  btn.textContent = 'Csatlakozás...';

  try {
    const { playerId, gameCode } = await joinGame(code, name);
    state.gameCode   = gameCode;
    state.playerId   = playerId;
    state.playerName = name;
    state.isHost     = false;
    _closeJoinOverlay();
    startGameListener(gameCode);
  } catch (err) {
    showToast(err.message || 'Hiba történt. Próbáld újra!');
    btn.disabled = false;
    btn.textContent = 'Csatlakozás →';
  }
}
