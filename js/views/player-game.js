/**
 * views/player-game.js – View 4/C: Játékos nézet játék közben (teljes implementáció)
 * ─────────────────────────────────────────────────────────────────────────────────
 * Aktív játékos : látja a titkosított adatcsomagot (arany), timer, csillagtérkép állása
 * Passzív játékos: NEM látja a szót, csak feladattípust, timert, csillagtérkép állását
 */

import { getElapsedMs, getPhaseInfo, formatTime } from '../logic/timer.js';

const TEAM_COLORS = ['#ef4444','#3b82f6','#22c55e','#f59e0b','#a855f7','#ec4899'];

let _timerInterval = null;

export function renderPlayerGame(game, appState) {
  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }

  const el = document.getElementById('view-player-game');

  if (!game) {
    el.style.background = '';
    el.innerHTML = `<div class="player-game-container">
      <p class="text-muted">Várakozás a játékra...</p>
    </div>`;
    return;
  }

  // ── BRIEFING PHASE: holographic mission message ──────────────
  if (game.status === 'briefing') {
    el.style.background = '';
    el.innerHTML = `
      <div class="briefing-overlay">
        <div class="briefing-hologram">
          <div class="briefing-scanlines"></div>
          <div class="briefing-content">
            <div class="briefing-header-lines">
              <span class="briefing-line">&gt;&gt;&gt; BIZTONSÁGI PROTOKOLL: AKTÍV</span>
              <span class="briefing-line">&gt;&gt;&gt; HITELESÍTÉS: KÓDOLT CSATORNA</span>
              <span class="briefing-line">&gt;&gt;&gt; FELADÓ: HOUSTON IRÁNYÍTÓKÖZPONT</span>
              <span class="briefing-line">&gt;&gt;&gt; CÍMZETTEK: RMG ŰRFLOTTÁK – DIGITÁLIS KULTÚRA DIVÍZIÓ</span>
            </div>

            <h2 class="briefing-title">KADÉTOK! FIGYELEM!</h2>

            <p class="briefing-text">
              A 23. század legfontosabb tudásbázisa, a <strong>Radnóti Központi Archívum</strong> kritikus találatot kapott. A teljes Digitális Kultúra adatbázis megsemmisült, a fogalmak és kódok erősen titkosított adatcsomagok formájában szóródtak szét a mélyűrben. Ha ezek az adatok elvesznek, a galaxis technológiai sötétségbe borul.
            </p>
            <p class="briefing-text">
              Az Irányítóközpont titeket választott a mentőakcióra. A küldetés a következő: <strong>szeljétek át a galaxist, és érjétek el elsőként a biztonságos Proxima bázist!</strong> A hajtóművetek azonban csak akkor kap energiát, ha útközben sikeresen elfogjátok és dekódoljátok a sérült adatcsomagokat.
            </p>

            <div class="briefing-rules">
              <h3 class="briefing-rules-title">A KÜLDETÉS SZABÁLYAI:</h3>
              <div class="briefing-rule">
                <span class="briefing-rule-num">1</span>
                <div>
                  <strong>DEKÓDOLÁS:</strong> A magas háttérsugárzás miatt a kommunikációs modulok tönkrementek. Az adatcsomagokat befogó asztronauta nem mondhatja ki a fogalmat! Csak alternatív módszerekkel (rajz, mutogatás, kódolt körülírás) adhatja át az információt a legénységének.
                </div>
              </div>
              <div class="briefing-rule">
                <span class="briefing-rule-num">2</span>
                <div>
                  <strong>TITKOSÍTOTT CSATORNA (0-30 mp):</strong> A pajzsok még tartanak. Csak a saját flottád hallja az adást.
                </div>
              </div>
              <div class="briefing-rule">
                <span class="briefing-rule-num">3</span>
                <div>
                  <strong>ADATBÁZIS KAPCSOLAT (30-60 mp):</strong> A hajó számítógépe engedélyezi a fizikai archívumok elérését – a flotta bevetheti a korábbi küldetések hajónaplóit!
                </div>
              </div>
              <div class="briefing-rule">
                <span class="briefing-rule-num">4</span>
                <div>
                  <strong>NYÍLT FREKVENCIA (60-90 mp):</strong> A titkosítás összeomlik! Bármelyik rivális flotta lehallgathatja az adást, és ellophatja az energiát a saját hajtóművéhez.
                </div>
              </div>
            </div>

            <p class="briefing-text">
              Az űr nem biztonságos. A sikeres akciókért cserébe Houston fejlesztéseket küld, de vigyázzatok: a térség tele van instabil féreglyukakkal és anomáliákkal, amik pillanatok alatt átrendezhetik az erőviszonyokat.
            </p>

            <p class="briefing-text briefing-closing">
              A rendszerek élesítve. Sok szerencsét, Kadétok. A Radnóti Miklós Galaxis jövője a ti kezetekben van.
            </p>

            <div class="briefing-footer">
              <span class="briefing-line">&gt;&gt;&gt; ÜZENET VÉGE &lt;&lt;&lt;</span>
            </div>

            <p class="briefing-waiting">🛸 Várakozás az Irányítóközpont parancsára...</p>
          </div>
        </div>
      </div>
    `;
    return;
  }

  if (game.status !== 'playing') {
    el.style.background = '';
    el.innerHTML = `<div class="player-game-container">
      <p class="text-muted">Várakozás a játékra...</p>
    </div>`;
    return;
  }

  const currentTurn    = game.currentTurn || {};
  const teams          = game.teams       || [];
  const players        = game.players     || {};
  const timerStartedAt = currentTurn.timerStartedAt || null;
  const timerElapsedMs = currentTurn.timerElapsedMs || 0;
  const phaseInfo      = getPhaseInfo(timerStartedAt, timerElapsedMs);
  const timerHasValue  = getElapsedMs(timerStartedAt, timerElapsedMs) > 0;

  const isActive      = currentTurn.activePlayerId === appState.playerId;
  const me             = players[appState.playerId];
  const myTeamIdx      = me?.teamIndex ?? -1;
  const myTeam         = myTeamIdx >= 0 ? teams[myTeamIdx] : null;
  const myColor        = myTeamIdx >= 0 ? TEAM_COLORS[myTeamIdx] : '#888';
  const isTeamActive   = !isActive && currentTurn.teamIndex === myTeamIdx && myTeamIdx >= 0;
  const role           = isActive ? 'active' : (isTeamActive ? 'guesser' : 'passive');
  const roleLabel      = isActive ? '🚀 Küldetésen vagy!' : (isTeamActive ? '🔬 Visszafejtő' : '📡 Megfigyelő');

  const activeTeam  = teams[currentTurn.teamIndex] || {};
  const activeColor = TEAM_COLORS[currentTurn.teamIndex] || '#888';

  // Háttérszín a csapat színe alapján
  el.style.background = `linear-gradient(180deg, ${myColor}EE 0%, ${myColor}BB 18%, ${myColor}50 50%, var(--bg) 78%)`;

  el.innerHTML = `
    <div class="player-game-container">

      <!-- Szerep badge -->
      <span class="player-role-badge ${role}">
        ${roleLabel}
      </span>

      <!-- Aktív csapat / feladat fejléc -->
      <div class="card text-center" style="width:100%;border-color:${isActive ? myColor : activeColor}">
        ${isActive
        ? `<p class="text-muted" style="font-size:0.82rem;margin-bottom:0.25rem">A te k\u00fcldet\u00e9sed</p>
           <p style="font-size:1.1rem;font-weight:700;color:${myColor}">${_esc(myTeam?.name ?? '')}</p>`
        : `<p class="text-muted" style="font-size:0.82rem;margin-bottom:0.25rem">Aktív flotta</p>
           <p style="font-size:1.1rem;font-weight:700;color:${activeColor}">${_esc(activeTeam.name ?? '?')}</p>
           ${currentTurn.activePlayerId && players[currentTurn.activePlayerId]
             ? `<p class="text-muted" style="font-size:0.85rem;margin-top:0.2rem">
                  ${_esc(players[currentTurn.activePlayerId].name)} teljesíti a küldetést
                </p>`
             : ''}`
        }
        <div class="task-meta" style="justify-content:center;margin-top:0.6rem">
          <span>🎯 ${_esc(currentTurn.taskType ?? '–')}</span>
          <span>⭐ ${currentTurn.points ?? '–'} fényév</span>
        </div>
      </div>

      <!-- Titkos szó / Felkészülés / Rejtve -->
      ${isActive && currentTurn.word && currentTurn.wordRevealed
        ? `<div class="card" style="width:100%;text-align:center;border-color:#fbbf24">
             <p class="secret-word-label">🤫 Titkosított adatcsomag – csak te látod!</p>
             <p class="player-word-reveal">${_esc(currentTurn.word)}</p>
           </div>`
        : isActive && !currentTurn.wordRevealed
          ? `<div class="card player-prepare-card" style="width:100%;text-align:center">
               <p class="player-prepare-msg">🚀 Felkészülés!</p>
               <p class="player-prepare-sub">Az Irányítóközpont hamarosan felfedi az adatcsomagodat.</p>
               <p class="player-prepare-sub">Addig menj ki a teremből, ha szükséges!</p>
             </div>`
          : `<div class="card text-center" style="width:100%">
               <p class="player-word-hidden">🙈 A titkos szó rejtve van</p>
             </div>`
      }

      <!-- Timer -->
      <div class="card text-center" style="width:100%;padding:1.25rem">
        <div id="pg-timer" class="host-timer-display ${phaseInfo.colorClass}">
          ${formatTime(phaseInfo.secondsLeft)}
        </div>
        <div id="pg-label" class="phase-label ${phaseInfo.colorClass}" style="margin-top:0.5rem">
          ${timerStartedAt ? phaseInfo.label : (timerHasValue ? 'Adatátvitel szüneteltetve' : 'Adatátvitel még nem indult')}
        </div>
      </div>

      <!-- Táblaállás (kompakt) -->
      <div class="card" style="width:100%">
        <h3 style="font-size:0.8rem;color:var(--text-muted);text-transform:uppercase;
                   letter-spacing:0.08em;margin-bottom:0.6rem">Csillagtérkép állása</h3>
        ${teams.map((t, i) => {
          const boardLen = game.settings?.boardLength || 30;
          const pct = Math.min(100, Math.round((t.score / boardLen) * 100));
          return `
            <div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.45rem">
              <span style="width:8px;height:8px;border-radius:50%;background:${TEAM_COLORS[i]};
                           flex-shrink:0"></span>
              <span style="flex:1;font-size:0.88rem;
                           ${i === myTeamIdx ? 'font-weight:700' : ''}">${_esc(t.name)}</span>
              <div style="flex:2;background:var(--border);border-radius:3px;height:6px;overflow:hidden">
                <div style="height:100%;width:${pct}%;background:${TEAM_COLORS[i]};
                            transition:width 0.5s"></div>
              </div>
              <span style="font-weight:700;min-width:1.5rem;text-align:right">${t.score}</span>
            </div>`;
        }).join('')}
      </div>

    </div>
  `;

  // ── Helyi timer interval ──────────────────────────────────────
  if (timerStartedAt) {
    _timerInterval = setInterval(() => {
      const timerEl = document.getElementById('pg-timer');
      const labelEl = document.getElementById('pg-label');
      if (!timerEl) { clearInterval(_timerInterval); _timerInterval = null; return; }

      const info = getPhaseInfo(timerStartedAt, timerElapsedMs);
      timerEl.className = `host-timer-display ${info.colorClass}`;
      timerEl.innerHTML = formatTime(info.secondsLeft);

      if (labelEl) {
        labelEl.className = `phase-label ${info.colorClass}`;
        labelEl.textContent = info.label;
      }

      if (info.phase >= 4) {
        clearInterval(_timerInterval);
        _timerInterval = null;
      }
    }, 1000);
  }
}

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
