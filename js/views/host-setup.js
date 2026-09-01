/**
 * views/host-setup.js – View 2: Host Beállítások
 * Csapatok száma és nevei, tábla hossza, feladattípusok, témakörök, lobby indítás.
 * Holografikus dizájn (Tailwind + Material Symbols).
 */

import { showView, showToast, state, startGameListener } from '../app.js';
import { createGame } from '../firebase-config.js';
import { topics } from '../data/topics.js';

// ── Konstansok ─────────────────────────────────────────────────
const TEAM_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];
const DEFAULT_NAMES = ['Piros', 'Kék', 'Zöld', 'Sárga', 'Lila', 'Rózsaszín'];
const TASK_TYPES = ['mutogatás', 'rajzolás', 'körülírás'];

const _cardCls = 'holographic-panel rounded-xl p-6 flex flex-col gap-4';
const _titleCls = 'font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary flex items-center gap-2';
const _labelCls = 'font-label-md text-label-md text-on-surface-variant uppercase';
const _pillCls = 'flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-container border border-outline-variant cursor-pointer hover:border-primary/50 transition-all font-body-md text-body-md has-[:checked]:border-primary has-[:checked]:bg-primary-container/10';

export function renderHostSetup() {
  const topicKeys = Object.keys(topics);
  const el = document.getElementById('view-host-setup');

  const TASK_ICONS = { 'mutogatás': '🤸', 'rajzolás': '🎨', 'körülírás': '💬' };

  el.innerHTML = `
    <div class="w-full max-w-3xl mx-auto px-margin-mobile py-10 flex flex-col gap-gutter">

      <div class="text-center">
        <h1 class="font-display-md text-display-md text-primary uppercase tracking-widest flex items-center justify-center gap-3">
          <span class="material-symbols-outlined text-4xl">settings</span> Küldetés beállítások
        </h1>
        <p class="font-body-md text-body-md text-on-surface-variant mt-2">
          Konfiguráld a küldetést, majd indítsd az Irányítóközpontot!
        </p>
      </div>

      <!-- Flották -->
      <div class="${_cardCls}">
        <h2 class="${_titleCls}"><span class="material-symbols-outlined">rocket_launch</span> Űrflották</h2>

        <div class="flex flex-col gap-2">
          <span class="${_labelCls}">Flották száma</span>
          <select id="team-count"
            class="bg-surface-container border border-outline-variant rounded-lg text-on-surface px-4 py-3
                   focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all">
            ${[2,3,4,5,6].map(n => `<option value="${n}"${n === 3 ? ' selected' : ''}>${n} flotta</option>`).join('')}
          </select>
        </div>

        <div class="flex flex-col gap-2">
          <span class="${_labelCls}">Flottabeosztás módja</span>
          <div class="flex flex-wrap gap-2">
            <label class="${_pillCls}">
              <input type="radio" name="assignmentType" value="random" checked class="accent-primary-container">
              🎲 Véletlenszerű
            </label>
            <label class="${_pillCls}">
              <input type="radio" name="assignmentType" value="manual" class="accent-primary-container">
              🖐️ Manuális választás
            </label>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <span class="${_labelCls}">Flottanevek</span>
          <div class="flex flex-col gap-2" id="team-names-container"></div>
        </div>
      </div>

      <!-- Csillagtérkép -->
      <div class="${_cardCls}">
        <h2 class="${_titleCls}"><span class="material-symbols-outlined">map</span> Csillagtérkép</h2>
        <div class="flex flex-col gap-2">
          <span class="${_labelCls}">Térkép hossza (céltávolság)</span>
          <div class="flex items-center gap-4">
            <input id="board-length" type="range" min="5" max="60" value="30"
                   class="flex-1 accent-primary-container">
            <span id="board-length-val"
                  class="font-display-md text-display-md text-primary-fixed-dim min-w-[3ch] text-right">30</span>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <span class="${_labelCls}">Anomáliák sűrűsége</span>
          <div class="flex items-center gap-4">
            <input id="anomaly-every" type="range" min="2" max="15" value="5"
                   class="flex-1 accent-primary-container">
            <span id="anomaly-every-val"
                  class="font-display-md text-display-md text-primary-fixed-dim min-w-[3ch] text-right">5</span>
          </div>
          <span class="font-code-sm text-code-sm text-on-surface-variant">
            Minden <span id="anomaly-every-inline">5</span>. mező űranomália
            (féreglyuk, szupernóva, fekete lyuk, roncsmező, hintamanőver, vontatósugár,
            meteorraj, kommunikációs zavar, nyílt frekvencia).
          </span>
        </div>
      </div>

      <!-- Adatbázisok -->
      <div class="${_cardCls}">
        <h2 class="${_titleCls}"><span class="material-symbols-outlined">database</span> Adatbázisok</h2>
        ${topicKeys.length === 0
          ? `<p class="text-tertiary-container font-body-md text-body-md">
               ⚠️ Nincs téma definiálva a <code class="font-code-sm">js/data/topics.js</code> fájlban.
               Adj hozzá szavakat, majd frissítsd az oldalt.
             </p>`
          : `<div class="flex flex-wrap gap-2" id="topics-group">
               ${topicKeys.map(k => `
                 <label class="${_pillCls}">
                   <input type="checkbox" name="topic" value="${k}" checked class="accent-primary-container">
                   ${k} <span class="text-on-surface-variant font-code-sm text-code-sm">(${topics[k].length})</span>
                 </label>`).join('')}
             </div>`
        }
      </div>

      <!-- Feladattípusok -->
      <div class="${_cardCls}">
        <h2 class="${_titleCls}"><span class="material-symbols-outlined">bolt</span> Küldetéstípusok</h2>
        <div class="flex flex-wrap gap-2" id="task-types-group">
          ${TASK_TYPES.map(t => `
            <label class="${_pillCls}">
              <input type="checkbox" name="taskType" value="${t}" checked class="accent-primary-container">
              ${TASK_ICONS[t] || ''} ${t}
            </label>`).join('')}
        </div>
      </div>

      <!-- Gombok -->
      <div class="flex flex-col-reverse sm:flex-row gap-3 sm:justify-between">
        <button id="btn-setup-back"
          class="text-on-surface-variant hover:text-primary font-label-md text-label-md uppercase
                 px-6 py-3 transition-colors flex items-center justify-center gap-2">
          <span class="material-symbols-outlined">arrow_back</span> Visszatérés
        </button>
        <button id="btn-create-lobby"
          class="bg-primary-container text-on-primary-container font-label-md text-label-md uppercase
                 px-8 py-3 rounded clip-chamfer neon-glow-primary transition-all
                 flex items-center justify-center gap-2">
          <span class="material-symbols-outlined">sensors</span> Irányítóközpont indítása
        </button>
      </div>
    </div>
  `;

  _renderTeamNameInputs(3);

  // ── Eseménykezelők ──────────────────────────────────────────
  document.getElementById('team-count').addEventListener('change', (e) => {
    _renderTeamNameInputs(parseInt(e.target.value, 10));
  });

  const rangeInput = document.getElementById('board-length');
  const rangeVal   = document.getElementById('board-length-val');
  rangeInput.addEventListener('input', () => { rangeVal.textContent = rangeInput.value; });

  const anomInput  = document.getElementById('anomaly-every');
  const anomVal    = document.getElementById('anomaly-every-val');
  const anomInline = document.getElementById('anomaly-every-inline');
  anomInput.addEventListener('input', () => {
    anomVal.textContent = anomInput.value;
    if (anomInline) anomInline.textContent = anomInput.value;
  });

  document.getElementById('btn-setup-back').addEventListener('click', () => {
    import('./landing.js').then(({ renderLanding }) => {
      showView('view-landing');
      renderLanding();
    });
  });

  document.getElementById('btn-create-lobby').addEventListener('click', _handleCreateLobby);
}

// ── Privát segédfüggvények ─────────────────────────────────────

function _renderTeamNameInputs(count) {
  const container = document.getElementById('team-names-container');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-3';
    row.innerHTML = `
      <span class="w-3 h-3 rounded-full flex-shrink-0" style="background:${TEAM_COLORS[i]};box-shadow:0 0 8px ${TEAM_COLORS[i]}"></span>
      <input
        class="team-name-field flex-1 bg-surface-container border border-outline-variant rounded-lg
               text-on-surface px-4 py-2 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
        type="text"
        placeholder="${DEFAULT_NAMES[i]}"
        maxlength="20"
        autocomplete="off"
      />
    `;
    container.appendChild(row);
  }
}

async function _handleCreateLobby() {
  const teamCount = parseInt(document.getElementById('team-count').value, 10);
  const boardLength = parseInt(document.getElementById('board-length').value, 10);
  const anomalyEvery = parseInt(document.getElementById('anomaly-every').value, 10);
  const assignmentType = document.querySelector('input[name="assignmentType"]:checked')?.value || 'random';

  const teamNames = Array.from(document.querySelectorAll('.team-name-field'))
    .map(inp => inp.value.trim() || inp.placeholder);

  const allowedTaskTypes = Array.from(
    document.querySelectorAll('#task-types-group input[type="checkbox"]:checked')
  ).map(cb => cb.value);

  const topicsGroup = document.getElementById('topics-group');
  const selectedTopics = topicsGroup
    ? Array.from(topicsGroup.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value)
    : [];

  // ── Validáció ──────────────────────────────────────────────
  if (allowedTaskTypes.length === 0) {
    showToast('Válassz legalább egy feladattípust!');
    return;
  }
  if (Object.keys(topics).length > 0 && selectedTopics.length === 0) {
    showToast('Válassz legalább egy témakört!');
    return;
  }
  if (isNaN(boardLength) || boardLength < 5) {
    showToast('A tábla hossza legalább 5 mező legyen!');
    return;
  }

  // ── Létrehozás ─────────────────────────────────────────────
  const btn = document.getElementById('btn-create-lobby');
  btn.disabled = true;
  btn.textContent = 'Létrehozás...';

  try {
    const code = await createGame({
      teamCount,
      teamNames,
      boardLength,
      anomalyEvery,
      assignmentType,
      allowedTaskTypes,
      selectedTopics,
    });

    state.gameCode  = code;
    state.isHost    = true;
    state.playerId  = null;
    state.playerName = null;

    startGameListener(code);
  } catch (err) {
    showToast('Hiba: ' + (err.message || 'Ismeretlen hiba'));
    btn.disabled = false;
    btn.textContent = 'Lobby indítása →';
  }
}
