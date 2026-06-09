/**
 * logic/timer.js – Időzítő segédfüggvények
 * ══════════════════════════════════════════
 * Fázisok (90 másodperc összesen, vagy 105 mp időtágulással):
 *   Fázis 1 –  0–30s (vagy 0-45s) : Túltöltés fázis (Zöld)
 *   Fázis 2 – 30–60s (vagy 45-75s) : Normál üzemmód (Sárga)
 *   Fázis 3 – 60–90s (vagy 75-105s) : Nyílt frekvencia – RABOLHATÓ! (Piros)
 *   Fázis 4 –   >90s (vagy >105s) : Kapcsolat megszakadt!
 *
 * Kommunikációs zavar (commDisruptionActive):
 *   Fázis 1 és 2 kihagyva – a teljes 90 mp (vagy 105 mp boost esetén) azonnal Fázis 3 (piros, rabolható)
 */

const PHASE_DURATION = 30;  // Alap fázis-hossz (mp)

export function getElapsedMs(timerStartedAt, timerElapsedMs = 0) {
  const baseElapsed = Number(timerElapsedMs) || 0;
  if (!timerStartedAt) return baseElapsed;
  return baseElapsed + Math.max(0, Date.now() - timerStartedAt);
}

/**
 * Az aktuális fázis és visszaszámlálás adatai.
 * @param {number|null} timerStartedAt    - Unix timestamp ms-ben (Date.now())
 * @param {number}      timerElapsedMs    - Korabban felhalmozott eltelt ido ms-ben
 * @param {boolean}    [timeDilationActive=false]    - Időtágulás aktív-e
 * @param {boolean}    [commDisruptionActive=false]  - Komm. zavar: csak 30 mp Fázis 3
 * @returns {{ phase: 0|1|2|3|4, secondsLeft: number, label: string, colorClass: string }}
 */
export function getPhaseInfo(timerStartedAt, timerElapsedMs = 0, timeDilationActive = false, commDisruptionActive = false) {
  let phase1End, phase2End, phase3End;
  if (commDisruptionActive) {
    // Kommunikációs zavar: fázis 1 és 2 kihagyva, de a teljes kör ideje megmarad
    phase1End = 0;
    phase2End = 0;
    phase3End = timeDilationActive ? 105 : 90;
  } else {
    phase1End = timeDilationActive ? 45 : PHASE_DURATION;
    phase2End = phase1End + PHASE_DURATION;
    phase3End = phase2End + PHASE_DURATION;
  }
  const totalSeconds = phase3End;

  const elapsedMs = getElapsedMs(timerStartedAt, timerElapsedMs);
  if (!timerStartedAt && elapsedMs <= 0) {
    return {
      phase:       0,
      secondsLeft: totalSeconds,
      label:       commDisruptionActive
        ? '📡 Kommunikációs zavar – Nyílt Frekvencia indul!'
        : 'Rendszer várakozik...',
      colorClass:  'phase-0',
    };
  }

  const elapsedSec  = Math.floor(elapsedMs / 1000);
  const secondsLeft = Math.max(0, totalSeconds - elapsedSec);

  if (elapsedSec < phase1End) {
    return { phase: 1, secondsLeft, label: `Túltöltés fázis${timeDilationActive ? ' (⏳ +15s)' : ''}`, colorClass: 'phase-1' };
  }
  if (elapsedSec < phase2End) {
    return { phase: 2, secondsLeft, label: 'Normál üzemmód',                         colorClass: 'phase-2' };
  }
  if (elapsedSec < phase3End) {
    return { phase: 3, secondsLeft, label: 'Nyílt frekvencia – RABOLHATÓ!',         colorClass: 'phase-3' };
  }
  return     { phase: 4, secondsLeft: 0,  label: 'Kapcsolat megszakadt!',           colorClass: 'phase-3' };
}

/**
 * Az aktuális nyers fázis szám (boost szerzéshez).
 * @returns {number} 0-4
 */
export function getCurrentPhase(timerStartedAt, timerElapsedMs = 0, timeDilationActive = false, commDisruptionActive = false) {
  return getPhaseInfo(timerStartedAt, timerElapsedMs, timeDilationActive, commDisruptionActive).phase;
}

/**
 * A teljes időtartam másodpercben (normál: 90, időtágulás: 105).
 * Kommunikációs zavar esetén is megmarad a teljes kör ideje, csak azonnal Fázis 3-tól indul.
 */
export function getTotalSeconds(timeDilationActive = false, commDisruptionActive = false) {
  return timeDilationActive ? 105 : 90;
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
