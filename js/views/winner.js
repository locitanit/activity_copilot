/**
 * views/winner.js – View 5: Győztes Hirdetés
 * Holografikus dizájn (Tailwind + Material Symbols).
 */

import { exitToMenu } from '../app.js';

const TEAM_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];

export function renderWinner(game, appState) {
  const el = document.getElementById('view-winner');

  const teams = game.teams || [];
  const maxScore = teams.length ? Math.max(...teams.map(t => t.score)) : 0;
  const winners  = teams.map((t, i) => ({ ...t, index: i })).filter(t => t.score === maxScore);
  const winnerIndexes = new Set(winners.map(w => w.index));

  el.innerHTML = `
    <div class="min-h-screen w-full flex flex-col items-center justify-center px-margin-mobile py-12 text-center">

      <div class="text-7xl mb-4 drop-shadow-[0_0_25px_rgba(254,181,40,0.6)]" style="animation:bh-pulse 4s ease-in-out infinite">🏆</div>
      <h1 class="font-display-md text-display-md text-tertiary-container uppercase tracking-widest
                 drop-shadow-[0_0_15px_rgba(254,181,40,0.4)]">Küldetés teljesítve!</h1>
      <p class="font-label-md text-label-md text-on-surface-variant uppercase tracking-[0.2em] mt-3 mb-2">
        ${winners.length > 1 ? 'Győztes flották' : 'Győztes flotta'}
      </p>

      <div class="flex flex-col items-center gap-1 mb-8">
        ${winners.map(w => `
          <div class="font-display-lg text-display-lg uppercase tracking-widest"
               style="color:${TEAM_COLORS[w.index] ?? '#fbbf24'};text-shadow:0 0 20px ${TEAM_COLORS[w.index] ?? '#fbbf24'}80">
            ${_esc(w.name)}
          </div>`).join('')}
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full max-w-2xl mb-10">
        ${teams.map((t, i) => `
          <div class="holographic-panel rounded-lg p-4 flex flex-col items-center gap-1"
               style="border-color:${winnerIndexes.has(i) ? TEAM_COLORS[i] : 'rgba(60,215,255,0.2)'}">
            <div class="font-display-md text-display-md" style="color:${TEAM_COLORS[i]}">${t.score}</div>
            <div class="font-body-md text-body-md text-on-surface-variant">${_esc(t.name)}</div>
          </div>`).join('')}
      </div>

      <button id="btn-new-game-winner"
        class="bg-primary-container text-on-primary-container font-label-md text-label-md uppercase
               px-8 py-4 rounded clip-chamfer neon-glow-primary transition-all
               flex items-center justify-center gap-2">
        <span class="material-symbols-outlined">rocket_launch</span> Új küldetés
      </button>
    </div>
  `;

  document.getElementById('btn-new-game-winner').addEventListener('click', () => {
    exitToMenu();
  });
}

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
