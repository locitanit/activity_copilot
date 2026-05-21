/**
 * views/host-game.js – View 4/B: Host Vezérlőpult (teljes implementáció)
 * ════════════════════════════════════════════════════════════════════════
 * - Titkosított adatcsomag kártya + "Adatcsomag újrasorsolása"
 * - Timer: fázisszínes visszaszámlálás (helyi setInterval)
 * - Pontozó gombok (engedélyezve adatátvitel indítás után)
 * - Csillagtérkép állása sávdiagrammal
 * - Következő küldetések + Múlt küldetések
 */

import { showToast }                                     from '../app.js';
import { updateGameData }                                from '../firebase-config.js';
import { rerollCurrentWord }                             from '../logic/turn-manager.js';
import { awardPoints, awardSharedPoints, endTurnNoScore } from '../logic/scoring.js';
import { getElapsedMs, getPhaseInfo, formatTime }        from '../logic/timer.js';
import { BOOST_TYPES }                                   from '../logic/boosts.js';

const TEAM_COLORS = ['#ef4444','#3b82f6','#22c55e','#f59e0b','#a855f7','#ec4899'];

// Modul-szintű interval – elkerüli a dupla tickeket re-render esetén
let _timerInterval = null;

export function renderHostGame(game, appState) {
  // Minden re-rendernél töröljük az előző intervalt
  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }

  const el = document.getElementById('view-host-game');

  if (!game) {
    el.innerHTML = `<div style="margin:auto;text-align:center">
      <p class="text-muted">Nincs aktív játék.</p>
    </div>`;
    return;
  }

  // ── BRIEFING PHASE: Host sees mission text + launch button ───
  if (game.status === 'briefing') {
    const players = game.players || {};
    const teams   = game.teams   || [];
    const playerCount = Object.keys(players).length;
    const allAssigned = Object.values(players).every(p => p.teamIndex >= 0);
    const canLaunch = playerCount >= 1 && allAssigned;

    el.innerHTML = `
      <div style="width:100%;max-width:860px;margin:0 auto;padding:1rem">
        <div class="briefing-overlay" style="position:relative;min-height:auto;padding:0">
          <div class="briefing-hologram" style="max-height:none">
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
            </div>
          </div>
        </div>

        <div class="card" style="margin-top:1.5rem;text-align:center">
          <h3 style="font-size:0.85rem;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-muted);
                     margin-bottom:0.75rem;font-family:'Orbitron',monospace">
            Irányítóközpont Státusz
          </h3>
          <p style="font-size:1.1rem;font-weight:600;margin-bottom:0.5rem">
            Asztronáuták a pályán: <span style="color:var(--primary);font-family:'Orbitron',monospace">${playerCount}</span>
          </p>
          ${teams.map((t, i) => {
            const count = Object.values(players).filter(p => p.teamIndex === i).length;
            return `<span style="display:inline-block;margin:0.2rem 0.5rem;font-size:0.88rem;color:${TEAM_COLORS[i]}">
              ${_esc(t.name)}: ${count}
            </span>`;
          }).join('')}

          <div style="margin-top:1.25rem">
            <button class="btn btn-success btn-lg btn-full" id="btn-launch-game"
              ${canLaunch ? '' : 'disabled'}
              style="font-size:1.2rem;padding:1rem 2rem">
              🚀 Első kör indítása – Misszió GO!
            </button>
          </div>
          ${!canLaunch
            ? `<p class="text-muted" style="font-size:0.82rem;margin-top:0.6rem">
                 Várj, amíg minden diák belép a játékba!
               </p>`
            : `<p style="font-size:0.82rem;margin-top:0.6rem;color:var(--success)">
                 ✅ Minden asztronáuta a fedélzeten! Indíthatod az első kört.
               </p>`}
        </div>
      </div>
    `;

    document.getElementById('btn-launch-game')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-launch-game');
      if (btn) { btn.disabled = true; btn.textContent = 'Indítás...'; }
      try {
        await updateGameData(appState.gameCode, { status: 'playing' });
      } catch (err) {
        showToast('❌ Hiba: ' + err.message);
        if (btn) { btn.disabled = false; btn.textContent = '🚀 Első kör indítása – Misszió GO!'; }
      }
    });

    return;
  }

  if (game.status !== 'playing') {
    el.innerHTML = `<div style="margin:auto;text-align:center">
      <p class="text-muted">Nincs aktív játék.</p>
    </div>`;
    return;
  }

  const currentTurn     = game.currentTurn || {};
  const teams           = game.teams       || [];
  const timerStartedAt  = currentTurn.timerStartedAt || null;
  const timerElapsedMs  = currentTurn.timerElapsedMs || 0;
  const timeDilationActive = !!currentTurn.timeDilationActive;
  const timerRunning    = !!timerStartedAt;
  const elapsedMs       = getElapsedMs(timerStartedAt, timerElapsedMs);
  const timerHasValue   = elapsedMs > 0;
  const phaseInfo       = getPhaseInfo(timerStartedAt, timerElapsedMs, timeDilationActive);
  const timerExpired    = phaseInfo.phase >= 4;
  const wordRevealed    = !!currentTurn.wordRevealed;

  const scoringEnabled  = (!timerRunning && timerHasValue) || timerExpired;
  const startEnabled    = !timerRunning && !!currentTurn.word && phaseInfo.secondsLeft > 0 && wordRevealed;
  const canPause        = timerRunning && !timerExpired;
  const canReset        = (!timerRunning && timerHasValue) || timerExpired;

  const activeTeam      = teams[currentTurn.teamIndex] || {};
  const activeColor     = TEAM_COLORS[currentTurn.teamIndex] || '#888';

  el.innerHTML = `
    <div style="width:100%;max-width:1400px;margin:0 auto;padding:1rem">

      <!-- ── Fejléc ─────────────────────────────────────────── -->
      <div style="display:flex;justify-content:space-between;align-items:center;
                  margin-bottom:1rem;padding-bottom:0.75rem;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:1rem">
          <span style="font-size:0.8rem;color:var(--text-muted)">Kód:</span>
          <strong style="letter-spacing:0.15em">${appState.gameCode}</strong>
          <span style="display:flex;align-items:center;gap:0.4rem;font-size:0.88rem">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;
                         background:${activeColor}"></span>
            <strong style="color:${activeColor}">${_esc(activeTeam.name ?? '?')}</strong>
            köre
            ${currentTurn.activePlayerId && game.players?.[currentTurn.activePlayerId]
              ? `<span style="color:var(--text-muted)">
                   – ${_esc(game.players[currentTurn.activePlayerId].name)}
                 </span>`
              : ''}
          </span>
        </div>
        <button class="btn btn-secondary" id="btn-open-projector">🌌 Kivetítő</button>
      </div>

      <div class="host-game-layout">

        <!-- ── BAL OSZLOP ───────────────────────────────────── -->
        <div class="host-main">

          <!-- Titkosított adatcsomag -->
          <div class="card secret-word-card" style="border-color:${activeColor}">
            ${currentTurn.word
              ? `<div class="secret-word-label">Titkosított adatcsomag</div>
                 <div class="secret-word">${_esc(currentTurn.word)}</div>
                 <div class="task-meta">
                   <span>🎯 ${_esc(currentTurn.taskType || '–')}</span>
                   <span>⭐ ${currentTurn.points ?? '–'} fényév</span>
                 </div>`
              : `<p class="text-muted">Nincs aktív küldés.</p>`
            }
          </div>

          <!-- Adatcsomag felfedése + Újrasorsolás (csak adatátvitel előtt) -->
          ${!timerHasValue && currentTurn.word ? `
            <div style="text-align:center;display:flex;flex-direction:column;gap:0.6rem;align-items:center">
              ${!wordRevealed ? `
                <button class="btn-reveal" id="btn-reveal-word">
                  👁 Adatcsomag felfedése az asztronautának
                </button>
                <span style="font-size:0.78rem;color:var(--text-muted)">
                  Az asztronáuta még nem látja az adatcsomagot
                </span>` : ''}
              <button class="btn btn-secondary" id="btn-reroll">
                🔀 Adatcsomag újrasorsolása
              </button>
            </div>` : ''}

          <!-- Timer kártya -->
          <div class="card host-timer-section">
            <div id="hg-timer" class="host-timer-display ${phaseInfo.colorClass}">
              ${formatTime(phaseInfo.secondsLeft)}
            </div>
            <div id="hg-label" class="phase-label ${phaseInfo.colorClass}"
                 style="margin-top:0.6rem">
              ${timerRunning
                ? phaseInfo.label
                : (timerHasValue ? 'Adatátvitel szüneteltetve' : 'Indítsd az adatátvitelt!')}
            </div>
            <div class="host-controls" style="margin-top:1rem">
              <button class="btn btn-success btn-lg" id="btn-start-timer"
                   ${startEnabled ? '' : 'disabled'}>
                ${timerHasValue ? '▶ Folytatás' : '▶ Adatátvitel indítása'}
              </button>
              <button class="btn btn-warning" id="btn-pause-timer"
                   ${canPause ? '' : 'disabled'}>
                ⏸ Szünet
              </button>
              <button class="btn btn-danger" id="btn-reset-timer"
                   ${canReset ? '' : 'disabled'}>
                ↺ Reset
              </button>
            </div>
          </div>

          <!-- Pontozó gombok -->
          <div class="card scoring-section">
            <h3>
              Pontozás (fényév)
              ${!scoringEnabled
                ? '<span style="font-size:0.78rem;font-weight:400;margin-left:0.4rem">' +
                  '(adatátvitel indítása után aktív)</span>'
                : ''}
            </h3>
            <div class="scoring-btns">
              ${teams.map((t, i) => `
                <button class="btn ${i === currentTurn.teamIndex ? 'btn-success' : 'btn-secondary'}
                               score-btn"
                        data-team="${i}"
                        ${scoringEnabled ? '' : 'disabled'}>
                  ✅ ${_esc(t.name)} visszafejtette
                  <span style="opacity:0.75;margin-left:0.3rem">
                    (+${currentTurn.points ?? '?'} fényév)
                    ${i === currentTurn.teamIndex ? '⭐' : '⚡ elfogott'}
                  </span>
                </button>`).join('')}
              <button class="btn btn-danger score-btn-noscore"
                      id="btn-no-score" ${scoringEnabled ? '' : 'disabled'}>
                ❌ Senki sem fejtette vissza
              </button>
            </div>

            <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border)">
              <div style="display:flex;align-items:baseline;gap:0.6rem;margin-bottom:0.7rem">
                <h4 style="font-size:0.92rem;margin:0">Megosztott fényévek</h4>
                <span style="font-size:0.78rem;color:var(--text-muted)">
                  A pontok a kijelölt csapatok között egyenlően oszlanak, lefelé kerekítve.
                </span>
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.8rem">
                ${teams.map((t, i) => `
                  <label style="display:flex;align-items:center;gap:0.45rem;padding:0.45rem 0.8rem;
                                 background:var(--surface-2);border:1px solid var(--border);
                                 border-radius:999px;cursor:pointer">
                    <input type="checkbox" class="shared-score-check" value="${i}" ${scoringEnabled ? '' : 'disabled'}>
                    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${TEAM_COLORS[i]}"></span>
                    ${_esc(t.name)}
                  </label>`).join('')}
              </div>
              <button class="btn btn-primary" id="btn-award-shared" ${scoringEnabled ? '' : 'disabled'}>
                🤝 Megosztott fényévek rögzítése
              </button>
            </div>
          </div>

        </div><!-- /host-main -->

        <!-- ── JOBB OLDALSÁV ─────────────────────────────────── -->
        <div class="host-sidebar">

          <!-- Csillagtérkép állása -->
          <div class="card dashboard-section">
            <h3>Csillagtérkép állása</h3>
            ${teams.map((t, i) => {
              const boardLen = game.settings?.boardLength || 30;
              const pct = Math.min(100, Math.round((t.score / boardLen) * 100));
              return `
                <div style="margin-bottom:0.75rem">
                  <div style="display:flex;justify-content:space-between;
                              align-items:center;margin-bottom:0.3rem">
                    <span style="font-weight:600;color:${TEAM_COLORS[i]}">${_esc(t.name)}</span>
                    <span style="font-weight:800">${t.score}
                      <span style="color:var(--text-muted);font-size:0.8rem;font-weight:400">
                        / ${boardLen}
                      </span>
                    </span>
                  </div>
                  <div style="background:var(--border);border-radius:4px;
                              height:8px;overflow:hidden">
                    <div style="height:100%;width:${pct}%;background:${TEAM_COLORS[i]};
                                transition:width 0.5s"></div>
                  </div>
                </div>`;
            }).join('')}
          </div>

          <!-- Fejlesztések (Boost) szekció -->
          <div class="card dashboard-section">
            <h3>Fejlesztések</h3>
            ${teams.map((t, i) => {
              const inv = t.inventory || [];
              const boardLen = game.settings?.boardLength || 30;
              return `
                <div style="margin-bottom:0.6rem">
                  <span style="font-weight:600;color:${TEAM_COLORS[i]};font-size:0.88rem">${_esc(t.name)}</span>
                  <div class="boost-inventory">
                    ${inv.length === 0
                      ? '<span style="font-size:0.78rem;color:var(--text-muted)">Nincs fejlesztés</span>'
                      : inv.map((bid, bidx) => {
                          const bt = BOOST_TYPES[bid] || { emoji: '?', name: bid };
                          return `<span class="boost-chip boost-chip--${bid}">${bt.emoji} ${_esc(bt.name)}</span>`;
                        }).join('')
                    }
                  </div>
                </div>`;
            }).join('')}
          </div>

          <!-- Következő küldetések -->
          <div class="card dashboard-section">
            <h3>Következő küldetések</h3>
            <div class="upcoming-list">
              ${Array.isArray(game.upcomingTurns) && game.upcomingTurns.length > 0
                ? game.upcomingTurns.slice(0, 3).map(t => `
                    <div class="upcoming-item">
                      <span class="upcoming-word">${_esc(t.word)}</span>
                      <span class="upcoming-meta">${_esc(t.taskType)} · ${t.points} fényév</span>
                    </div>`).join('')
                : '<p class="text-muted" style="font-size:0.85rem">Nincs előre generált küldetés</p>'
              }
            </div>
          </div>

          <!-- Múlt küldetések -->
          <div class="card dashboard-section">
            <h3>Múlt küldetések</h3>
            <div class="history-list">
              ${Array.isArray(game.turnHistory) && game.turnHistory.length > 0
                ? [...game.turnHistory].reverse().slice(0, 15).map(h => `
                    <div class="history-item">
                      <span class="history-word" title="${_esc(h.word)}">${_esc(h.word)}</span>
                      <span class="history-result ${h.result || 'unsolved'}">
                        ${h.result === 'solved'   ? '✓ kitalálva'
                        : h.result === 'stolen'   ? '⚡ elfogott'
                        : h.result === 'shared'   ? '🤝 megosztva'
                        :                           '✗ nem fejtette vissza'}
                      </span>
                    </div>`).join('')
                : '<p class="text-muted" style="font-size:0.85rem">Még nincs lezárt küldetés</p>'
              }
            </div>
          </div>

        </div><!-- /host-sidebar -->
      </div>
    </div>
  `;

  // ── Event listeners ──────────────────────────────────────────

  document.getElementById('btn-open-projector')?.addEventListener('click', () => {
    const url = `index.html?role=projector&room=${encodeURIComponent(appState.gameCode)}`;
    const win = window.open(url, `projector_${appState.gameCode}`, 'width=1280,height=720');
    if (!win) showToast('⚠️ Engedélyezd a felugró ablakokat a böngészőben!');
  });

  document.getElementById('btn-reveal-word')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-reveal-word');
    if (btn) btn.disabled = true;
    try {
      await updateGameData(appState.gameCode, {
        'currentTurn/wordRevealed': true,
      });
    } catch (err) {
      showToast('Hiba: ' + err.message);
      const b = document.getElementById('btn-reveal-word');
      if (b) b.disabled = false;
    }
  });

  document.getElementById('btn-reroll')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-reroll');
    if (btn) btn.disabled = true;
    try {
      await rerollCurrentWord(appState.gameCode, game);
    } catch (err) {
      showToast('Hiba: ' + err.message);
      const b = document.getElementById('btn-reroll');
      if (b) b.disabled = false;
    }
  });

  document.getElementById('btn-start-timer')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-start-timer');
    if (btn) btn.disabled = true;
    try {
      await updateGameData(appState.gameCode, {
        'currentTurn/timerStartedAt': Date.now(),
        'currentTurn/timerElapsedMs': timerElapsedMs,
      });
    } catch (err) {
      showToast('Hiba: ' + err.message);
      const b = document.getElementById('btn-start-timer');
      if (b) b.disabled = false;
    }
  });

  document.getElementById('btn-pause-timer')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-pause-timer');
    if (btn) btn.disabled = true;
    try {
      const currentElapsedMs = getElapsedMs(timerStartedAt, timerElapsedMs);
      await updateGameData(appState.gameCode, {
        'currentTurn/timerStartedAt': null,
        'currentTurn/timerElapsedMs': currentElapsedMs,
      });
    } catch (err) {
      showToast('Hiba: ' + err.message);
      const b = document.getElementById('btn-pause-timer');
      if (b) b.disabled = false;
    }
  });

  document.getElementById('btn-reset-timer')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-reset-timer');
    if (btn) btn.disabled = true;
    try {
      await updateGameData(appState.gameCode, {
        'currentTurn/timerStartedAt': null,
        'currentTurn/timerElapsedMs': 0,
      });
    } catch (err) {
      showToast('Hiba: ' + err.message);
      const b = document.getElementById('btn-reset-timer');
      if (b) b.disabled = false;
    }
  });

  document.getElementById('btn-no-score')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-no-score');
    if (btn) btn.disabled = true;
    try {
      await endTurnNoScore(appState.gameCode, game);
    } catch (err) {
      showToast('Hiba: ' + err.message);
      const b = document.getElementById('btn-no-score');
      if (b) b.disabled = false;
    }
  });

  document.querySelectorAll('.score-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const teamIdx = parseInt(btn.dataset.team, 10);
      document.querySelectorAll('.score-btn, .shared-score-check').forEach(b => b.disabled = true);
      const sharedBtn = document.getElementById('btn-award-shared');
      if (sharedBtn) sharedBtn.disabled = true;
      try {
        await awardPoints(appState.gameCode, game, teamIdx);
      } catch (err) {
        showToast('Hiba: ' + err.message);
        document.querySelectorAll('.score-btn, .shared-score-check').forEach(b => b.disabled = false);
        if (sharedBtn) sharedBtn.disabled = false;
      }
    });
  });

  document.getElementById('btn-award-shared')?.addEventListener('click', async () => {
    const selectedTeams = Array.from(document.querySelectorAll('.shared-score-check:checked'))
      .map(cb => parseInt(cb.value, 10))
      .filter(Number.isInteger);

    if (selectedTeams.length < 2) {
      showToast('Jelölj ki legalább két csapatot az osztott ponthoz!');
      return;
    }

    const btn = document.getElementById('btn-award-shared');
    if (btn) btn.disabled = true;
    document.querySelectorAll('.score-btn, .shared-score-check').forEach(b => b.disabled = true);

    try {
      await awardSharedPoints(appState.gameCode, game, selectedTeams);
    } catch (err) {
      showToast('Hiba: ' + err.message);
      if (btn) btn.disabled = false;
      document.querySelectorAll('.score-btn, .shared-score-check').forEach(b => b.disabled = false);
    }
  });

  // ── Helyi timer interval (csak UI frissítés, nem Firebase) ───
  if (timerRunning) {
    _timerInterval = setInterval(() => {
      const timerEl = document.getElementById('hg-timer');
      const labelEl = document.getElementById('hg-label');
      if (!timerEl) { clearInterval(_timerInterval); _timerInterval = null; return; }

      const info = getPhaseInfo(timerStartedAt, timerElapsedMs, timeDilationActive);
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
