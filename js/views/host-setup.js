/**
 * views/host-setup.js – View 2: Host Beállítások
 * Csapatok száma és nevei, tábla hossza, feladattípusok, témakörök, lobby indítás.
 */

import { showView, showToast, state, startGameListener } from '../app.js';
import { createGame } from '../firebase-config.js';
import { topics } from '../data/topics.js';

// ── Konstansok ─────────────────────────────────────────────────
const TEAM_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];
const DEFAULT_NAMES = ['Piros', 'Kék', 'Zöld', 'Sárga', 'Lila', 'Rózsaszín'];
const TASK_TYPES = ['mutogatás', 'rajzolás', 'körülírás'];

export function renderHostSetup() {
  const topicKeys = Object.keys(topics);
  const el = document.getElementById('view-host-setup');

  el.innerHTML = `
    <div class="setup-container">
      <h1>⚙️ Játék beállítása</h1>

      <!-- Csapatok száma + Tábla hossza -->
      <div class="form-row">
        <div class="form-group">
          <label for="team-count">Csapatok száma</label>
          <select id="team-count">
            ${[2,3,4,5,6].map(n => `<option value="${n}"${n === 3 ? ' selected' : ''}>${n} csapat</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="board-length">Tábla hossza (mezők száma)</label>
          <input id="board-length" type="number" min="5" max="60" value="30" />
        </div>
      </div>

      <!-- Csapat nevek -->
      <div class="form-group">
        <label>Csapat nevek</label>
        <div class="team-names-container" id="team-names-container"></div>
      </div>

      <!-- Csapatba osztás módja -->
      <div class="form-group">
        <label for="assignment-type">Csapatba osztás módja</label>
        <select id="assignment-type">
          <option value="random">Véletlenszerű (automatikus, a Lobby indításakor)</option>
          <option value="manual">Kézi (a játékos választ csapatot a Váróteremben)</option>
        </select>
      </div>

      <!-- Feladattípusok -->
      <div class="form-group">
        <label>Engedélyezett feladattípusok</label>
        <div class="checkbox-group" id="task-types-group">
          ${TASK_TYPES.map(t => `
            <label class="checkbox-item">
              <input type="checkbox" name="taskType" value="${t}" checked> ${t}
            </label>
          `).join('')}
        </div>
      </div>

      <!-- Témakörök -->
      <div class="form-group">
        <label>Témakörök</label>
        ${topicKeys.length === 0
          ? `<div class="card" style="padding:1rem;border-color:var(--warning)">
               <p style="color:var(--warning);font-size:0.9rem">
                 ⚠️ Nincs téma definiálva a <code>js/data/topics.js</code> fájlban.
                 Adj hozzá szavakat, majd frissítsd az oldalt.
               </p>
             </div>`
          : `<div class="checkbox-group" id="topics-group">
               ${topicKeys.map(k => `
                 <label class="checkbox-item">
                   <input type="checkbox" name="topic" value="${k}" checked>
                   ${k}
                   <span style="color:var(--text-muted);font-size:0.75rem">(${topics[k].length} szó)</span>
                 </label>
               `).join('')}
             </div>`
        }
      </div>

      <!-- Gombok -->
      <div class="setup-actions">
        <button class="btn btn-secondary" id="btn-setup-back">← Vissza</button>
        <button class="btn btn-primary btn-lg" id="btn-create-lobby">
          Lobby indítása →
        </button>
      </div>
    </div>
  `;

  // Kezdeti csapatnevek renderelése
  _renderTeamNameInputs(3);

  // ── Eseménykezelők ──────────────────────────────────────────

  document.getElementById('team-count').addEventListener('change', (e) => {
    _renderTeamNameInputs(parseInt(e.target.value, 10));
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
    row.className = 'team-name-row';
    row.innerHTML = `
      <span class="team-color-dot" style="background:${TEAM_COLORS[i]}"></span>
      <input
        class="team-name-field"
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
  const assignmentType = document.getElementById('assignment-type').value;

  // Csapat nevek összegyűjtése (üres → placeholder érték)
  const teamNames = Array.from(document.querySelectorAll('.team-name-field'))
    .map(inp => inp.value.trim() || inp.placeholder);

  // Feladattípusok
  const allowedTaskTypes = Array.from(
    document.querySelectorAll('#task-types-group input[type="checkbox"]:checked')
  ).map(cb => cb.value);

  // Témakörök (csak ha van topics-group)
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
