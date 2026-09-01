/**
 * views/landing.js – View 1: Főmenü
 * Gombok: "Új küldetés (Host)", "Csatlakozás kóddal" és "QR-kód"
 * (a kezdőoldalra mutató QR – a diákok beolvassák és máris itt vannak).
 * Holografikus / űr-HUD dizájn (Tailwind + Material Symbols).
 */

import { showView, showToast } from '../app.js';
import { deleteAllGames } from '../firebase-config.js';

// ── QR-generátor lusta betöltése (csak az első gombnyomásra) ─────
const QR_LIB_URL = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
let _qrLibPromise = null;

function _loadQrLib() {
  if (window.QRCode) return Promise.resolve();
  if (_qrLibPromise)  return _qrLibPromise;
  _qrLibPromise = new Promise((resolve, reject) => {
    const sc = document.createElement('script');
    sc.src = QR_LIB_URL;
    sc.onload  = () => resolve();
    sc.onerror = () => { _qrLibPromise = null; reject(new Error('nincs internet?')); };
    document.head.appendChild(sc);
  });
  return _qrLibPromise;
}

// A kezdőoldal címe query/hash nélkül (a ?role=projector&room=... ne kerüljön bele).
function _landingUrl() {
  return window.location.origin + window.location.pathname;
}

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
        <button id="btn-show-qr" aria-expanded="false" aria-controls="qr-panel"
          class="holographic-panel text-primary font-label-md text-label-md uppercase
                 px-6 py-4 rounded clip-chamfer hover:border-primary/50 transition-all
                 flex items-center justify-center gap-2">
          <span class="material-symbols-outlined">qr_code_2</span>
          <span id="btn-show-qr-label">QR-kód mutatása</span>
        </button>
      </div>

      <!-- QR-kód panel: a kezdőoldalra mutat, a diákok beolvassák -->
      <div id="qr-panel" class="hidden mt-6 flex flex-col items-center gap-3">
        <div id="qr-box"
             class="bg-white p-4 rounded-xl shadow-[0_0_35px_rgba(0,212,255,0.35)]
                    flex items-center justify-center min-w-[120px] min-h-[120px]"></div>
        <p id="qr-url"
           class="font-code-sm text-code-sm text-primary/70 break-all text-center max-w-xs"></p>
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

  // ── QR-kód mutatása / elrejtése ─────────────────────────────
  const qrBtn   = document.getElementById('btn-show-qr');
  const qrLabel = document.getElementById('btn-show-qr-label');
  const qrPanel = document.getElementById('qr-panel');
  const qrBox   = document.getElementById('qr-box');
  const qrUrlEl = document.getElementById('qr-url');
  let   qrDrawn = false;

  qrBtn.addEventListener('click', async () => {
    // Elrejtés
    if (!qrPanel.classList.contains('hidden')) {
      qrPanel.classList.add('hidden');
      qrBtn.setAttribute('aria-expanded', 'false');
      qrLabel.textContent = 'QR-kód mutatása';
      return;
    }

    // Fájlból megnyitva (file://) nincs értelmes cím, amit be lehetne olvasni
    if (window.location.protocol === 'file:') {
      showToast('A QR-kód csak webcímről működik (file:// nem jó).');
      return;
    }

    if (!qrDrawn) {
      const url = _landingUrl();
      qrBtn.disabled = true;
      try {
        await _loadQrLib();
      } catch (_) {
        qrBtn.disabled = false;
        showToast('A QR-generátor nem töltődött be – nincs internet?');
        return;
      }
      qrBtn.disabled = false;
      // A doboz szélessége adja a QR méretét (mobilon kisebb, kivetítőn nagyobb)
      const size = Math.round(Math.min(280, Math.max(140, window.innerWidth * 0.6)));
      qrBox.innerHTML = '';
      new window.QRCode(qrBox, {
        text:        url,
        width:       size,
        height:      size,
        colorDark:   '#020510',
        colorLight:  '#ffffff',
        correctLevel: window.QRCode.CorrectLevel.M,
      });
      qrUrlEl.textContent = url;
      qrDrawn = true;
    }

    qrPanel.classList.remove('hidden');
    qrBtn.setAttribute('aria-expanded', 'true');
    qrLabel.textContent = 'QR-kód elrejtése';
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
