/**
 * views/landing.js – View 1: Főmenü
 * Gombok: "Új játék létrehozása (Host)" és "Csatlakozás kóddal".
 */

import { showView, showToast, state, startGameListener } from '../app.js';
import { joinGame } from '../firebase-config.js';

export function renderLanding() {
  const el = document.getElementById('view-landing');

  el.innerHTML = `
    <div class="logo">🎲</div>
    <h1>Activity</h1>
    <p class="subtitle">Valós idejű oktatási csapatjáték</p>

    <div class="btn-group">
      <button class="btn btn-primary btn-lg" id="btn-new-game">
        ✨ Új játék létrehozása (Host)
      </button>
      <button class="btn btn-secondary btn-lg" id="btn-join-game">
        🔑 Csatlakozás kóddal
      </button>
    </div>

    <!-- Csatlakozás overlay / modal -->
    <div class="overlay hidden" id="join-overlay">
      <div class="card modal">
        <h2>Csatlakozás játékhoz</h2>

        <div class="form-group">
          <label for="join-code">Játékkód</label>
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
          <label for="join-name">A neved</label>
          <input id="join-name" type="text" placeholder="Béla" maxlength="30" autocomplete="off" />
        </div>

        <div class="modal-actions">
          <button class="btn btn-primary btn-full" id="btn-join-confirm">Csatlakozás →</button>
          <button class="btn btn-secondary" id="btn-join-cancel">Mégse</button>
        </div>
      </div>
    </div>
  `;

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
