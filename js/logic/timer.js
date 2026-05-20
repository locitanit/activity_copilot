/**
 * logic/timer.js – Időzítő segédfüggvények
 * ══════════════════════════════════════════
 * Fázisok (90 másodperc összesen):
 *   Phase 1 –  0–30s : Csak a saját csapat!
 *   Phase 2 – 30–60s : Órai jegyzet használható!
 *   Phase 3 – 60–90s : RABOLHATÓ! Bárki bekiabálhatja!
 *   Phase 4 –   >90s : Lejárt az idő!
 */

export const TOTAL_SECONDS = 90;

const PHASE1_END = 30;
const PHASE2_END = 60;
const PHASE3_END = 90;

/**
 * Az aktuális fázis és visszaszámlálás adatai.
 * @param {number|null} timerStartedAt - Unix timestamp ms-ben (Date.now())
 * @returns {{ phase: 0|1|2|3|4, secondsLeft: number, label: string, colorClass: string }}
 */
export function getPhaseInfo(timerStartedAt) {
  if (!timerStartedAt) {
    return {
      phase:       0,
      secondsLeft: TOTAL_SECONDS,
      label:       'Timer még nem fut',
      colorClass:  'phase-0',
    };
  }

  const elapsedSec  = Math.floor((Date.now() - timerStartedAt) / 1000);
  const secondsLeft = Math.max(0, TOTAL_SECONDS - elapsedSec);

  if (elapsedSec < PHASE1_END) {
    return { phase: 1, secondsLeft, label: 'Csak a saját csapat!',            colorClass: 'phase-1' };
  }
  if (elapsedSec < PHASE2_END) {
    return { phase: 2, secondsLeft, label: 'Órai jegyzet használható!',       colorClass: 'phase-2' };
  }
  if (elapsedSec < PHASE3_END) {
    return { phase: 3, secondsLeft, label: 'RABOLHATÓ! Bárki bekiabálhatja!', colorClass: 'phase-3' };
  }
  return     { phase: 4, secondsLeft: 0,  label: 'Lejárt az idő!',            colorClass: 'phase-3' };
}

/**
 * Formázott MM:SS string.
 * @param {number} secondsLeft
 * @returns {string}
 */
export function formatTime(secondsLeft) {
  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
