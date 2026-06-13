/**
 * views/winner.js – View 5: Győztes Hirdetés (STAR COMMAND HUD)
 * Küldetés-jelentés: győztes-emelvény + teljes végső rangsor.
 * A kivetítő (projector.js) a saját, mozis lezárását játssza – ez a host/játékos
 * eredményképernyő.
 */

import { exitToMenu, state } from '../app.js';

const TEAM_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];

export function renderWinner(game, appState) {
  const el = document.getElementById('view-winner');

  const teams    = (game.teams || []).map((t, i) => ({ ...t, index: i, score: t.score || 0 }));
  const maxScore = teams.length ? Math.max(...teams.map(t => t.score)) : 0;
  const winners  = teams.filter(t => t.score === maxScore);
  const winnerIdx = new Set(winners.map(w => w.index));
  const ranked   = [...teams].sort((a, b) => b.score - a.score);
  const primary  = winners[0] || { index: 0, name: '–', score: 0 };
  const isTie    = winners.length > 1;
  // Döntetlen: semleges ARANY emelvény-akcentus + minden győztes a SAJÁT színét
  // kapja a nevén és a felső szegély színátmenetében (ne csak az első csapaté).
  const accent   = isTie ? '#feb528' : (TEAM_COLORS[primary.index] || '#feb528');
  const topBorder = isTie
    ? `border-image:linear-gradient(90deg, ${winners.map(w => TEAM_COLORS[w.index] || '#feb528').join(', ')}) 1`
    : `border-color:${accent}`;
  const code     = (appState && appState.gameCode) || state.gameCode || '';

  el.innerHTML = `
    <div class="min-h-screen w-full relative flex items-center justify-center p-6 sm:p-10">

      <!-- HUD sarokdíszek -->
      <div class="fixed top-6 left-6 w-14 h-14 border-t-2 border-l-2 border-primary/60 z-40 pointer-events-none"></div>
      <div class="fixed top-6 right-6 w-14 h-14 border-t-2 border-r-2 border-primary/60 z-40 pointer-events-none"></div>
      <div class="fixed bottom-6 left-6 w-14 h-14 border-b-2 border-l-2 border-primary/60 z-40 pointer-events-none"></div>
      <div class="fixed bottom-6 right-6 w-14 h-14 border-b-2 border-r-2 border-primary/60 z-40 pointer-events-none"></div>

      <main class="w-full max-w-6xl mx-auto flex flex-col lg:flex-row gap-8 lg:gap-12 items-center justify-center relative z-10">

        <!-- Bal: győztes-emelvény -->
        <section class="flex-1 flex flex-col items-center text-center gap-6 w-full">
          <div class="space-y-1">
            <h2 class="font-label-md text-label-md text-primary uppercase tracking-[0.2em] opacity-80">Küldetés jelentés</h2>
            <h1 class="font-display-md text-display-md text-white uppercase tracking-widest drop-shadow-[0_0_15px_rgba(0,212,255,0.5)]">Küldetés teljesítve</h1>
          </div>

          <div class="holographic-panel rounded-xl p-8 sm:p-10 w-full max-w-md flex flex-col items-center relative border-t-4"
               style="${topBorder};box-shadow:0 0 28px ${accent}44">
            <div class="relative mb-4">
              <span class="material-symbols-outlined" style="font-size:108px;color:${accent};text-shadow:0 0 22px ${accent}cc;font-variation-settings:'FILL' 1">military_tech</span>
              <span class="material-symbols-outlined text-white absolute -top-1 -right-1 animate-pulse" style="font-size:22px">spark</span>
            </div>

            <div class="font-label-md text-label-md uppercase tracking-widest mb-1" style="color:${accent}">
              ${isTie ? 'Győztes flották' : 'Győztes parancsnokság'}
            </div>
            ${winners.map(w => {
              const nc = isTie ? (TEAM_COLORS[w.index] || '#fff') : '#fff';
              return `<h3 class="font-headline-lg text-headline-lg uppercase tracking-wide" style="color:${nc}${isTie ? `;text-shadow:0 0 12px ${nc}66` : ''}">${_esc(w.name)}</h3>`;
            }).join('')}

            <div class="w-full bg-surface-container-low/60 rounded-lg p-4 mt-5 border flex justify-between items-center"
                 style="border-color:${accent}55">
              <span class="font-body-md text-body-md text-on-surface-variant">Megtett táv</span>
              <span class="font-headline-lg text-headline-lg font-bold" style="color:${accent}">${maxScore}
                <span class="text-sm font-normal text-on-surface-variant ml-1">fényév</span></span>
            </div>
          </div>

          <button id="btn-new-game-winner"
            class="mt-2 px-8 py-4 bg-primary-container text-on-primary-container font-label-md text-label-md uppercase tracking-wider
                   rounded clip-chamfer neon-glow-primary transition-all flex items-center gap-3 group
                   hover:shadow-[0_0_25px_rgba(0,212,255,0.7)]">
            <span class="material-symbols-outlined group-hover:rotate-180 transition-transform duration-500">autorenew</span>
            Új küldetés
          </button>
        </section>

        <!-- Jobb: teljes rangsor -->
        <section class="flex-1 w-full max-w-xl">
          <div class="holographic-panel rounded-xl p-6 flex flex-col border-r-4 border-primary/30">
            <div class="flex items-center justify-between border-b border-primary/20 pb-4 mb-5">
              <h3 class="font-headline-lg text-headline-lg-mobile text-primary flex items-center gap-3">
                <span class="material-symbols-outlined">leaderboard</span> Végső rangsor
              </h3>
              ${code ? `<span class="font-code-sm text-code-sm text-on-surface-variant border border-outline-variant px-2 py-1 rounded bg-surface-container tracking-widest">${_esc(code)}</span>` : ''}
            </div>

            <div class="flex flex-col gap-3">
              ${ranked.map((t, rank) => {
                const c = TEAM_COLORS[t.index] || '#888';
                const isWin = winnerIdx.has(t.index);
                return `
                  <div class="flex items-center p-4 rounded-lg border-l-4 relative overflow-hidden transition-all"
                       style="border-color:${c};background:${isWin ? c + '14' : 'rgba(255,255,255,0.02)'}">
                    ${isWin ? `<div class="absolute right-0 top-0 h-full w-32 pointer-events-none" style="background:linear-gradient(to left, ${c}24, transparent)"></div>` : ''}
                    <div class="w-8 ${isWin ? 'font-headline-lg text-headline-lg' : 'font-body-lg text-body-lg'} font-bold" style="color:${isWin ? c : '#bbc9cf'}">${rank + 1}</div>
                    <div class="w-10 h-10 rounded-full flex items-center justify-center mr-4 border shrink-0" style="background:${c}1f;border-color:${c}55">
                      <span class="material-symbols-outlined" style="font-size:20px;color:${c}">rocket_launch</span>
                    </div>
                    <div class="flex-1 min-w-0">
                      <h4 class="font-body-lg text-body-lg text-white font-semibold truncate">${_esc(t.name)}</h4>
                    </div>
                    <div class="text-right z-10 shrink-0">
                      <div class="${isWin ? 'font-headline-lg text-headline-lg' : 'font-body-lg text-body-lg'} font-bold" style="color:${c}">${t.score}</div>
                      <div class="font-code-sm text-code-sm text-on-surface-variant">fényév</div>
                    </div>
                  </div>`;
              }).join('')}
            </div>
          </div>
        </section>
      </main>
    </div>
  `;

  document.getElementById('btn-new-game-winner')?.addEventListener('click', () => exitToMenu());
}

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
