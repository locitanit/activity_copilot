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

  // Győztes(ek) meghatározása: legtöbb fényév (holtverseny esetén mindegyik)
  const maxScore = Math.max(...teams.map(t => t.score));
  const winners  = teams.map((t, i) => ({ ...t, index: i })).filter(t => t.score === maxScore);
  const winnerIndexes = new Set(winners.map(w => w.index));

  el.innerHTML = `
    <div class="winner-container">
      <div class="trophy">🏆</div>
      <h1>Küldetés teljesítve!</h1>
      <p class="text-muted" style="margin-bottom:0.5rem">${winners.length > 1 ? 'Győztes flották' : 'Győztes flotta'}</p>
      ${winners.map(w => `
        <div class="winner-team-name" style="color:${TEAM_COLORS[w.index] ?? '#fbbf24'}">
          ${_esc(w.name)}
        </div>
      `).join('')}

      <!-- Végeredmény -->
      <div class="final-scores">
        ${teams.map((t, i) => `
          <div class="card final-score-card" style="border-color:${winnerIndexes.has(i) ? TEAM_COLORS[i] : 'var(--border)'}">
            <div class="final-score-num" style="color:${TEAM_COLORS[i]}">${t.score}</div>
            <div class="final-score-name">${_esc(t.name)}</div>
          </div>
        `).join('')}
      </div>

      <!-- Újraindítás -->
      <button class="btn btn-primary btn-lg" id="btn-new-game-winner">
        🚀 Új misszió indítása
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
