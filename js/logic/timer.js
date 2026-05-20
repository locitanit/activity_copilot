/**
 * logic/timer.js – Időzítő segédfüggvények
 * ══════════════════════════════════════════
 * Fázisok (90 másodperc összesen):
 *   Fázis 1 –  0–30s : Titkosított csatorna (Zöld)
 *   Fázis 2 – 30–60s : Adatbázis kapcsolat (Sárga)
 *   Fázis 3 – 60–90s : Nyílt frekvencia – RABOLHATÓ! (Piros)
 *   Fázis 4 –   >90s : Kapcsolat megszakadt!
 */

export const TOTAL_SECONDS = 90;

const PHASE1_END = 30;
const PHASE2_END = 60;
const PHASE3_END = 90;

export function getElapsedMs(timerStartedAt, timerElapsedMs = 0) {
  const baseElapsed = Number(timerElapsedMs) || 0;
  if (!timerStartedAt) return baseElapsed;
  return baseElapsed + Math.max(0, Date.now() - timerStartedAt);
}

/**
 * Az aktuális fázis és visszaszámlálás adatai.
 * @param {number|null} timerStartedAt - Unix timestamp ms-ben (Date.now())
 * @param {number} timerElapsedMs - Korabban felhalmozott eltelt ido ms-ben
 * @returns {{ phase: 0|1|2|3|4, secondsLeft: number, label: string, colorClass: string }}
 */
export function getPhaseInfo(timerStartedAt, timerElapsedMs = 0) {
  const elapsedMs = getElapsedMs(timerStartedAt, timerElapsedMs);
  if (!timerStartedAt && elapsedMs <= 0) {
    return {
      phase:       0,
      secondsLeft: TOTAL_SECONDS,
      label:       'Rendszer várakozik...',
      colorClass:  'phase-0',
    };
  }

  const elapsedSec  = Math.floor(elapsedMs / 1000);
  const secondsLeft = Math.max(0, TOTAL_SECONDS - elapsedSec);

  if (elapsedSec < PHASE1_END) {
    return { phase: 1, secondsLeft, label: 'Titkosított csatorna',                  colorClass: 'phase-1' };
  }
  if (elapsedSec < PHASE2_END) {
    return { phase: 2, secondsLeft, label: 'Adatbázis kapcsolat',                   colorClass: 'phase-2' };
  }
  if (elapsedSec < PHASE3_END) {
    return { phase: 3, secondsLeft, label: 'Nyílt frekvencia – RABOLHATÓ!',         colorClass: 'phase-3' };
  }
  return     { phase: 4, secondsLeft: 0,  label: 'Kapcsolat megszakadt!',           colorClass: 'phase-3' };
}

/**
 * Formázott MM:SS string.
 * @param {number} secondsLeft
 * @returns {string}
 */
export function formatTime(secondsLeft) {
  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    .split('')
    .map(c => `<span class="t-d">${c}</span>`)
    .join('');
}
