/**
 * views/join.js – View 1/B: Csatlakozás kóddal (dedikált oldal)
 * Holografikus dizájn (Tailwind + Material Symbols).
 */

import { showView, showToast, state, startGameListener } from '../app.js';
import { joinGame } from '../firebase-config.js';

export function renderJoin() {
  const el = document.getElementById('view-join');

  el.innerHTML = `
    <div class="min-h-screen w-full flex flex-col items-center justify-center px-margin-mobile py-12">
      <div class="holographic-panel rounded-xl p-8 w-full max-w-md flex flex-col gap-6 relative">

        <div class="absolute top-0 right-0 p-3 opacity-20 pointer-events-none">
          <span class="material-symbols-outlined text-5xl">login</span>
        </div>

        <div>
          <h2 class="font-headline-lg text-headline-lg text-primary uppercase tracking-wider flex items-center gap-2">
            <span class="material-symbols-outlined">satellite_alt</span> Belépés a küldetésbe
          </h2>
          <p class="font-body-md text-body-md text-on-surface-variant mt-2">
            Add meg az Irányítóközponttól kapott küldetés-kódot és a neved.
          </p>
        </div>

        <div class="flex flex-col gap-2">
          <label for="join-code" class="font-label-md text-label-md text-on-surface-variant uppercase">Küldetés-kód</label>
          <input id="join-code" type="text" placeholder="A1B2" maxlength="4" autocomplete="off" spellcheck="false"
            class="bg-surface-container border border-outline-variant rounded-lg text-on-surface
                   text-center font-display-md text-display-md tracking-[0.3em] uppercase py-3
                   focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all">
        </div>

        <div class="flex flex-col gap-2">
          <label for="join-name" class="font-label-md text-label-md text-on-surface-variant uppercase">Asztronauta neve</label>
          <input id="join-name" type="text" placeholder="Pl. Commandante" maxlength="30" autocomplete="off"
            class="bg-surface-container border border-outline-variant rounded-lg text-on-surface
                   font-body-lg text-body-lg px-4 py-3
                   focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all">
        </div>

        <div class="flex flex-col gap-3 mt-2">
          <button id="btn-join-confirm"
            class="bg-primary-container text-on-primary-container font-label-md text-label-md uppercase
                   px-6 py-3 rounded clip-chamfer neon-glow-primary transition-all
                   flex items-center justify-center gap-2">
            <span class="material-symbols-outlined">arrow_forward</span> Belépés
          </button>
          <button id="btn-join-back"
            class="text-on-surface-variant hover:text-primary font-label-md text-label-md uppercase
                   px-6 py-3 transition-colors flex items-center justify-center gap-2">
            <span class="material-symbols-outlined">arrow_back</span> Vissza
          </button>
        </div>
      </div>
    </div>
  `;

  const codeInput = document.getElementById('join-code');
  codeInput.focus();

  codeInput.addEventListener('input', (e) => {
    const pos = e.target.selectionStart;
    e.target.value = e.target.value.toUpperCase();
    e.target.setSelectionRange(pos, pos);
  });

  ['join-code', 'join-name'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', (e) => {
      if (e.key === 'Enter') _handleJoin();
    });
  });

  document.getElementById('btn-join-confirm').addEventListener('click', _handleJoin);

  document.getElementById('btn-join-back').addEventListener('click', () => {
    import('./landing.js').then(({ renderLanding }) => {
      showView('view-landing');
      renderLanding();
    });
  });
}

// ── Belépés kezelése ───────────────────────────────────────────
async function _handleJoin() {
  const code = document.getElementById('join-code').value.trim().toUpperCase();
  const name = document.getElementById('join-name').value.trim();

  if (!code || code.length < 4) { showToast('Add meg a küldetés-kódot!'); return; }
  if (!name)                     { showToast('Add meg a neved!'); return; }

  const btn = document.getElementById('btn-join-confirm');
  btn.disabled = true;
  btn.textContent = 'Csatlakozás...';

  try {
    const { playerId, gameCode } = await joinGame(code, name);
    state.gameCode   = gameCode;
    state.playerId   = playerId;
    state.playerName = name;
    state.isHost     = false;
    startGameListener(gameCode);
  } catch (err) {
    showToast(err.message || 'Hiba történt. Próbáld újra!');
    btn.disabled = false;
    btn.textContent = 'Belépés →';
  }
}
