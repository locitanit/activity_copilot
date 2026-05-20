/**
 * views/winner.js – View 5: Győztes Hirdetés
 * Megmutatja a győztes csapatot és a végeredményt.
 *
 * Step 1: teljes implementáció (egyszerű, nincs Firebase-függő logika).
 */

import { showView } from '../app.js';

const TEAM_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];

export function renderWinner(game, appState) {
  const el = document.getElementById('view-winner');

  const teams = game.teams || [];

  // Győztes meghatározása: legtöbb pont
  const winner = teams.reduce(
    (best, t, i) => (t.score > best.score ? { ...t, index: i } : best),
    { ...teams[0], index: 0 }
  );

  el.innerHTML = `
    <div class="winner-container">
      <div class="trophy">🏆</div>
      <h1>Játék vége!</h1>
      <p class="text-muted" style="margin-bottom:0.5rem">Győztes csapat</p>
      <div class="winner-team-name" style="color:${TEAM_COLORS[winner.index] ?? '#fbbf24'}">
        ${_esc(winner.name)}
      </div>

      <!-- Végeredmény -->
      <div class="final-scores">
        ${teams.map((t, i) => `
          <div class="card final-score-card ${i === winner.index ? 'style="border-color:' + TEAM_COLORS[i] + '"' : ''}">
            <div class="final-score-num" style="color:${TEAM_COLORS[i]}">${t.score}</div>
            <div class="final-score-name">${_esc(t.name)}</div>
          </div>
        `).join('')}
      </div>

      <!-- Újraindítás -->
      <button class="btn btn-primary btn-lg" id="btn-new-game-winner">
        🎮 Új játék indítása
      </button>
    </div>
  `;

  document.getElementById('btn-new-game-winner').addEventListener('click', () => {
    // Állapot törlése és visszatérés a főmenüre
    import('../app.js').then(({ state, renderLanding }) => {
      state.gameCode   = null;
      state.playerId   = null;
      state.playerName = null;
      state.isHost     = false;
      if (state._unsubscribe) {
        state._unsubscribe();
        state._unsubscribe = null;
      }
      showView('view-landing');
      renderLanding();
    });
  });
}

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
