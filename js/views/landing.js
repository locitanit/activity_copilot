/**
 * views/landing.js – View 1: Főmenü
 * Gombok: "Új küldetés (Host)" és "Csatlakozás kóddal".
 * Holografikus / űr-HUD dizájn (Tailwind + Material Symbols).
 */

import { showView, showToast } from '../app.js';
import { deleteAllGames } from '../firebase-config.js';

export function renderLanding() {
  const el = document.getElementById('view-landing');

  el.innerHTML = `
    <div class="min-h-screen w-full flex flex-col items-center justify-center px-margin-mobile py-12 relative">

      <!-- HUD sarokdíszek -->
      <div class="fixed top-4 left-4 w-10 h-10 border-t-2 border-l-2 border-primary/30 pointer-events-none"></div>
      <div class="fixed top-4 right-4 w-10 h-10 border-t-2 border-r-2 border-primary/30 pointer-events-none"></div>
      <div class="fixed bottom-4 right-4 w-10 h-10 border-b-2 border-r-2 border-primary/30 pointer-events-none"></div>

      <img src="img/black_hole.png" alt=""
           class="w-[min(320px,72vw,38vh)] h-auto mb-8 drop-shadow-[0_0_55px_rgba(100,0,200,0.6)]"
           style="animation:bh-pulse 6s ease-in-out infinite">

      <h1 class="font-display-lg text-display-lg text-primary text-center tracking-[0.18em]
                 drop-shadow-[0_0_20px_rgba(0,212,255,0.6)]">
        RMG ASTRO-ACTIVITY
      </h1>
      <p class="font-label-md text-label-md text-primary-fixed-dim uppercase tracking-[0.3em] mt-3 mb-10">
        Galaktikus csapatjáték
      </p>

      <div class="flex flex-col gap-4 w-full max-w-sm">
        <button id="btn-new-game"
          class="bg-primary-container text-on-primary-container font-label-md text-label-md uppercase
                 px-6 py-4 rounded clip-chamfer neon-glow-primary transition-all
                 flex items-center justify-center gap-2">
          <span class="material-symbols-outlined">rocket_launch</span> Új küldetés
        </button>
        <button id="btn-join-game"
          class="holographic-panel text-primary font-label-md text-label-md uppercase
                 px-6 py-4 rounded clip-chamfer hover:border-primary/50 transition-all
                 flex items-center justify-center gap-2">
          <span class="material-symbols-outlined">login</span> Csatlakozás kóddal
        </button>
      </div>

      <!-- Rejtett admin (állomásra kattintás) – telefonon elrejtve -->
      <img id="admin-station" src="img/space_station.png" alt=""
           class="hidden sm:block fixed bottom-6 left-6 w-32 h-auto opacity-60 cursor-default select-none pointer-events-auto"
           style="animation:orbit-wobble 20s ease-in-out infinite">
    </div>
  `;

  // ── Eseménykezelők ──────────────────────────────────────────
  document.getElementById('btn-new-game').addEventListener('click', () => {
    import('./host-setup.js').then(({ renderHostSetup }) => {
      showView('view-host-setup');
      renderHostSetup();
    });
  });

  document.getElementById('btn-join-game').addEventListener('click', () => {
    import('./join.js').then(({ renderJoin }) => {
      showView('view-join');
      renderJoin();
    });
  });

  // ── Rejtett admin funkció: állomásra kattintás ─────────────
  el.querySelector('#admin-station').addEventListener('click', async () => {
    const code = window.prompt('');
    if (code !== 'SUDO_RM_RF_GALAXY') return;
    try {
      await deleteAllGames();
      showToast('Összes játék törölve.');
    } catch (err) {
      showToast('Hiba: ' + (err.message || 'ismeretlen'));
    }
  });
}
