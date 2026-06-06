/**
 * views/host-game.js – View 4/B: Host Vezérlőpult
 * Holografikus dizájn (Tailwind + Material Symbols). A "playing" állapot
 * a host-dashboard mockup alapján; a briefing megtartja a hologram képernyőt.
 */

import { showToast, leaveBarHtml, wireLeaveBar }         from '../app.js';
import { updateGameData }                                from '../firebase-config.js';
import { rerollCurrentWord }                             from '../logic/turn-manager.js';
import { awardPoints, awardSharedPoints, endTurnNoScore } from '../logic/scoring.js';
import { getElapsedMs, getPhaseInfo, getTotalSeconds, formatTime } from '../logic/timer.js';
import { BOOST_TYPES }                                   from '../logic/boosts.js';

const TEAM_COLORS = ['#ef4444','#3b82f6','#22c55e','#f59e0b','#a855f7','#ec4899'];
const TEAM_TW = ['red-500','blue-500','green-500','yellow-500','purple-500','pink-500'];
const PHASE_HEX = { 'phase-0': '#bbc9cf', 'phase-1': '#00e676', 'phase-2': '#ffd600', 'phase-3': '#ff1744' };
const TASK_EMOJI = { 'rajzolás': '🎨', 'mutogatás': '🤸', 'körülírás': '💬' };
const RING_C = 283; // 2 * π * 45

let _timerInterval = null;
let _detailsOpen = true;

export function renderHostGame(game, appState) {
  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }

  const el = document.getElementById('view-host-game');

  if (!game) {
    el.innerHTML = `<div class="min-h-screen flex items-center justify-center">
      <p class="text-on-surface-variant">Nincs aktív játék.</p></div>`;
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
      <div class="w-full max-w-4xl mx-auto p-4">
        <div class="flex justify-end mb-2">${leaveBarHtml()}</div>
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

        <div class="holographic-panel rounded-xl p-6 mt-6 text-center flex flex-col gap-4">
          <h3 class="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest">Irányítóközpont Státusz</h3>
          <p class="font-body-lg text-body-lg">
            Asztronauták a pályán: <span class="text-primary-fixed-dim font-display-md">${playerCount}</span>
          </p>
          <div class="flex flex-wrap justify-center gap-x-4 gap-y-1">
            ${teams.map((t, i) => {
              const count = Object.values(players).filter(p => p.teamIndex === i).length;
              return `<span class="font-body-md text-body-md" style="color:${TEAM_COLORS[i]}">${_esc(t.name)}: ${count}</span>`;
            }).join('')}
          </div>
          <button id="btn-launch-game" ${canLaunch ? '' : 'disabled'}
            class="mt-2 bg-tertiary-container text-on-tertiary-container font-label-md text-label-md uppercase
                   px-8 py-4 rounded clip-chamfer transition-all flex items-center justify-center gap-2 self-center
                   hover:shadow-[0_0_15px_rgba(254,181,40,0.6)]
                   disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none">
            <span class="material-symbols-outlined">rocket_launch</span> Első kör indítása
          </button>
          <p class="font-body-md text-body-md ${canLaunch ? 'text-success' : 'text-on-surface-variant'}"
             style="${canLaunch ? 'color:#00e676' : ''}">
            ${canLaunch ? '✅ Minden asztronauta a fedélzeten! Indíthatod az első kört.' : 'Várj, amíg minden diák belép a játékba!'}
          </p>
        </div>
      </div>
    `;

    wireLeaveBar();
    document.getElementById('btn-launch-game')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-launch-game');
      if (btn) { btn.disabled = true; btn.textContent = 'Indítás...'; }
      try {
        await updateGameData(appState.gameCode, { status: 'playing' });
      } catch (err) {
        showToast('❌ Hiba: ' + err.message);
        if (btn) { btn.disabled = false; btn.textContent = '🚀 Első kör indítása'; }
      }
    });

    return;
  }

  if (game.status !== 'playing') {
    el.innerHTML = `<div class="min-h-screen flex items-center justify-center">
      <p class="text-on-surface-variant">Nincs aktív játék.</p></div>`;
    return;
  }

  const currentTurn     = game.currentTurn || {};
  const teams           = game.teams       || [];
  const timerStartedAt  = currentTurn.timerStartedAt || null;
  const timerElapsedMs  = currentTurn.timerElapsedMs || 0;
  const timeDilationActive    = !!currentTurn.timeDilationActive;
  const commDisruptionActive  = !!currentTurn.commDisruptionActive;
  const timerRunning    = !!timerStartedAt;
  const elapsedMs       = getElapsedMs(timerStartedAt, timerElapsedMs);
  const timerHasValue   = elapsedMs > 0;
  const phaseInfo       = getPhaseInfo(timerStartedAt, timerElapsedMs, timeDilationActive, commDisruptionActive);
  const timerExpired    = phaseInfo.phase >= 4;
  const wordRevealed    = !!currentTurn.wordRevealed;

  const scoringEnabled  = (!timerRunning && timerHasValue) || timerExpired;
  const startEnabled    = !timerRunning && !!currentTurn.word && phaseInfo.secondsLeft > 0 && wordRevealed;
  const canPause        = timerRunning && !timerExpired;
  const canReset        = (!timerRunning && timerHasValue) || timerExpired;

  const activeTeam      = teams[currentTurn.teamIndex] || {};
  const activeColor     = TEAM_COLORS[currentTurn.teamIndex] || '#888';
  const boardLen        = game.settings?.boardLength || 30;
  const totalSeconds    = getTotalSeconds(timeDilationActive, commDisruptionActive) || 1;
  const timerColor      = PHASE_HEX[phaseInfo.colorClass] || '#feb528';
  const ringOffset      = Math.max(0, Math.min(RING_C, RING_C * (1 - phaseInfo.secondsLeft / totalSeconds)));

  const _round = 'w-12 h-12 rounded-full bg-surface-container-high border border-outline-variant flex items-center justify-center transition-all text-on-surface enabled:hover:bg-primary/20 enabled:hover:border-primary enabled:hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed';

  el.innerHTML = `
    <!-- Header -->
    <header class="fixed top-0 w-full glass-panel border-b border-primary/20 flex justify-between items-center px-gutter h-16 z-40">
      <div class="flex items-center gap-4">
        ${leaveBarHtml()}
        <div class="h-6 w-px bg-outline-variant/50"></div>
        <div class="font-code-sm text-code-sm uppercase text-on-surface-variant flex items-center gap-2">
          <span>Kód:</span>
          <span class="font-display-md text-body-lg text-primary-fixed-dim tracking-[0.1em]">${_esc(appState.gameCode)}</span>
        </div>
      </div>
      <div class="flex items-center gap-4">
        <div class="hidden sm:flex items-center gap-2">
          <span class="w-3 h-3 rounded-full" style="background:${activeColor};box-shadow:0 0 8px ${activeColor}"></span>
          <span class="font-label-md text-label-md" style="color:${activeColor}">${_esc(activeTeam.name ?? '?')}</span>
          ${currentTurn.activePlayerId && game.players?.[currentTurn.activePlayerId]
            ? `<span class="text-on-surface-variant">|</span>
               <span class="font-label-md text-label-md text-primary-fixed">${_esc(game.players[currentTurn.activePlayerId].name)}</span>`
            : ''}
        </div>
        <div class="proj-menu-wrap" id="projector-menu-wrap">
          <button id="btn-open-projector"
            class="flex items-center gap-2 text-primary font-label-md text-label-md uppercase bg-primary-container/10
                   px-4 py-2 rounded clip-chamfer border border-primary/30 hover:drop-shadow-[0_0_8px_#3cd7ff] transition-all">
            <span class="material-symbols-outlined">cast</span><span class="hidden sm:inline">Kivetítő</span>
          </button>
          <div class="proj-menu" id="proj-menu" hidden>
            <button class="proj-menu-item" id="proj-popup">🖥️ Megnyitás felugró ablakban</button>
            <button class="proj-menu-item" id="proj-copy">🔗 Link másolása</button>
          </div>
        </div>
      </div>
    </header>

    <!-- Main -->
    <main class="mt-16 flex flex-col md:flex-row gap-gutter p-gutter w-full max-w-container-max mx-auto">

      <!-- Left: controls -->
      <section class="flex-1 flex flex-col gap-gutter min-w-0">

        <!-- Secret word card -->
        <div class="holographic-panel rounded p-6 flex flex-col gap-4 relative" style="border-left:4px solid ${activeColor}">
          <div class="absolute top-0 right-0 p-2 opacity-20 pointer-events-none">
            <span class="material-symbols-outlined text-4xl">vpn_key</span>
          </div>
          ${currentTurn.word ? `
            <div class="flex justify-between items-start">
              <h2 class="font-label-md text-label-md uppercase tracking-widest" style="color:${activeColor}">Aktuális Küldetés</h2>
              <span class="font-code-sm text-code-sm text-on-surface-variant px-2 py-1 bg-surface-container rounded">${currentTurn.points ?? '–'} Fényév</span>
            </div>
            <div class="text-center py-6">
              <h1 class="font-display-lg text-display-lg text-on-surface tracking-widest drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">${_esc(currentTurn.word)}</h1>
              <p class="font-body-lg text-body-lg text-primary-fixed-dim mt-2 flex items-center justify-center gap-2">
                ${TASK_EMOJI[currentTurn.taskType] || '🎯'} ${_esc(currentTurn.taskType || '–')}
              </p>
            </div>
            ${!timerHasValue ? `
              <div class="flex flex-wrap gap-3 justify-center">
                ${!wordRevealed ? `
                  <button id="btn-reveal-word"
                    class="bg-primary-container text-on-primary-container font-label-md text-label-md uppercase px-6 py-3 rounded clip-chamfer neon-glow-primary transition-all flex items-center gap-2">
                    <span class="material-symbols-outlined">visibility</span> Szó felfedése
                  </button>` : `
                  <span class="font-label-md text-label-md text-success flex items-center gap-2" style="color:#00e676">
                    <span class="material-symbols-outlined">visibility</span> Felfedve
                  </span>`}
                <button id="btn-reroll"
                  class="border border-primary-container text-primary-container font-label-md text-label-md uppercase px-6 py-3 rounded clip-chamfer hover:bg-primary-container/10 transition-all flex items-center gap-2">
                  <span class="material-symbols-outlined">autorenew</span> Újrasorsolás
                </button>
              </div>` : ''}
          ` : `<p class="text-on-surface-variant text-center py-8">Nincs aktív küldés.</p>`}
        </div>

        <div class="flex flex-col lg:flex-row gap-gutter">

          <!-- Timer card -->
          <div class="holographic-panel rounded p-6 flex-1 flex flex-col items-center justify-center gap-6">
            <div class="relative w-44 h-44 flex items-center justify-center">
              <svg class="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#2f3639" stroke-width="3"></circle>
                <circle id="hg-ring" cx="50" cy="50" r="45" fill="none" stroke="${timerColor}" stroke-width="5"
                        stroke-linecap="round" stroke-dasharray="${RING_C}" stroke-dashoffset="${ringOffset}"
                        style="transition:stroke-dashoffset 1s linear, stroke 0.3s; filter:drop-shadow(0 0 6px ${timerColor})"></circle>
              </svg>
              <span id="hg-timer" class="font-display-md text-display-md" style="color:${timerColor}">${formatTime(phaseInfo.secondsLeft)}</span>
            </div>
            <div id="hg-label" class="font-label-md text-label-md uppercase text-center" style="color:${timerColor}">
              ${timerRunning ? phaseInfo.label : (timerHasValue ? 'Adatátvitel szüneteltetve' : 'Indítsd az adatátvitelt!')}
            </div>
            <div class="flex gap-3">
              <button id="btn-start-timer" class="${_round}" title="Indítás / Folytatás" ${startEnabled ? '' : 'disabled'}>
                <span class="material-symbols-outlined">play_arrow</span>
              </button>
              <button id="btn-pause-timer" class="${_round}" title="Szünet" ${canPause ? '' : 'disabled'}>
                <span class="material-symbols-outlined">pause</span>
              </button>
              <button id="btn-reset-timer" class="${_round}" title="Reset" ${canReset ? '' : 'disabled'}>
                <span class="material-symbols-outlined">restart_alt</span>
              </button>
            </div>
          </div>

          <!-- Scoring panel -->
          <div class="holographic-panel rounded p-6 flex-1 flex flex-col gap-4">
            <h3 class="font-label-md text-label-md text-on-surface-variant uppercase">
              Pontozás ${!scoringEnabled ? '<span class="normal-case tracking-normal opacity-70">(adatátvitel után)</span>' : ''}
            </h3>
            <div class="grid grid-cols-2 gap-2">
              ${teams.map((t, i) => {
                const isActive = i === currentTurn.teamIndex;
                return `<button class="score-btn py-2 px-2 rounded text-center transition-all font-label-md text-label-md border
                          ${isActive ? 'border-success text-success bg-green-500/15' : 'border-outline-variant text-on-surface bg-surface-container hover:bg-surface-variant'}"
                          style="${isActive ? 'border-color:#00e676;color:#00e676' : `border-color:${TEAM_COLORS[i]}55`}"
                          data-team="${i}" ${scoringEnabled ? '' : 'disabled'} title="${isActive ? '⭐ saját' : '⚡ elfogott'} (+${currentTurn.points ?? '?'})">
                          ${_esc(t.name)}
                        </button>`;
              }).join('')}
            </div>
            <button id="btn-no-score" ${scoringEnabled ? '' : 'disabled'}
              class="w-full bg-surface-container border border-outline-variant text-on-surface-variant py-2 rounded
                     hover:bg-surface-variant hover:text-on-surface transition-all font-label-md text-label-md
                     flex justify-center items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
              <span class="material-symbols-outlined">block</span> Senki sem fejtette meg
            </button>

            <div class="border-t border-outline-variant/40 pt-3">
              <div class="flex items-baseline gap-2 mb-2">
                <h4 class="font-label-md text-label-md text-on-surface-variant">Megosztott fényévek</h4>
                <span class="font-code-sm text-code-sm text-on-surface-variant normal-case tracking-normal">egyenlően, lefelé kerekítve</span>
              </div>
              <div class="flex flex-wrap gap-2 mb-3">
                ${teams.map((t, i) => `
                  <label class="flex items-center gap-1.5 px-2 py-1 rounded-full bg-surface-container border border-outline-variant cursor-pointer text-on-surface font-code-sm text-code-sm">
                    <input type="checkbox" class="shared-score-check accent-primary-container" value="${i}" ${scoringEnabled ? '' : 'disabled'}>
                    <span class="w-2 h-2 rounded-full" style="background:${TEAM_COLORS[i]}"></span>${_esc(t.name)}
                  </label>`).join('')}
              </div>
              <button id="btn-award-shared" ${scoringEnabled ? '' : 'disabled'}
                class="bg-primary-container/80 text-on-primary-container py-2 px-4 rounded font-label-md text-label-md
                       flex items-center gap-2 hover:bg-primary-container transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                <span class="material-symbols-outlined">handshake</span> Megosztott rögzítése
              </button>
            </div>
          </div>
        </div>

        <!-- Fleet arsenals -->
        <div class="holographic-panel rounded p-6">
          <h3 class="font-label-md text-label-md text-on-surface-variant uppercase mb-4">Flotta arzenálok</h3>
          <div class="flex flex-col gap-3">
            ${teams.map((t, i) => {
              const inv = t.inventory || [];
              return `
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-label-md text-label-md min-w-[5rem]" style="color:${TEAM_COLORS[i]}">${_esc(t.name)}</span>
                  ${inv.length === 0
                    ? '<span class="font-code-sm text-code-sm text-on-surface-variant">Nincs fejlesztés</span>'
                    : inv.map((bid) => {
                        const bt = BOOST_TYPES[bid] || { emoji: '?', name: bid };
                        return `<span class="boost-chip boost-chip--${bid}" tabindex="0" data-tooltip="${_esc(bt.description || '')}">${bt.emoji} ${_esc(bt.name)}</span>`;
                      }).join('')}
                </div>`;
            }).join('')}
          </div>
        </div>
      </section>

      <!-- Right: details sidebar -->
      <aside class="w-full md:w-80 flex-shrink-0">
        <div class="holographic-panel rounded p-6 flex flex-col gap-4">
          <button id="host-details-toggle" class="font-headline-lg text-headline-lg-mobile text-primary flex items-center justify-between gap-2 w-full">
            <span class="flex items-center gap-2"><span class="material-symbols-outlined">explore</span> Részletek</span>
            <span class="material-symbols-outlined transition-transform ${_detailsOpen ? 'rotate-180' : ''}">expand_more</span>
          </button>

          <div id="host-details-section" style="${_detailsOpen ? '' : 'display:none'}" class="flex flex-col gap-6">

            <div>
              <h4 class="font-label-md text-label-md text-on-surface-variant uppercase mb-3">Útvonal a Proxima Bázisig</h4>
              <div class="flex flex-col gap-3">
                ${teams.map((t, i) => {
                  const pct = Math.min(100, Math.round((t.score / boardLen) * 100));
                  return `
                    <div>
                      <div class="flex justify-between font-code-sm text-code-sm text-on-surface mb-1">
                        <span style="color:${TEAM_COLORS[i]}">${_esc(t.name)}</span>
                        <span>${t.score} / ${boardLen}</span>
                      </div>
                      <div class="h-2 w-full bg-surface-container rounded overflow-hidden">
                        <div class="h-full" style="width:${pct}%;background:${TEAM_COLORS[i]};box-shadow:0 0 8px ${TEAM_COLORS[i]};transition:width 0.5s"></div>
                      </div>
                    </div>`;
                }).join('')}
              </div>
            </div>

            <div>
              <h4 class="font-label-md text-label-md text-on-surface-variant uppercase mb-3">Következő küldetések</h4>
              <ul class="flex flex-col gap-2">
                ${Array.isArray(game.upcomingTurns) && game.upcomingTurns.length > 0
                  ? game.upcomingTurns.slice(0, 3).map(t => `
                      <li class="flex justify-between items-center bg-surface-container p-2 rounded border border-outline-variant/30">
                        <span class="font-body-md text-body-md text-on-surface">${_esc(t.word)}</span>
                        <span class="font-code-sm text-code-sm text-on-surface-variant">${_esc(t.taskType)} · ${t.points}</span>
                      </li>`).join('')
                  : '<li class="font-code-sm text-code-sm text-on-surface-variant">Nincs előre generált küldetés</li>'}
              </ul>
            </div>

            <div>
              <h4 class="font-label-md text-label-md text-on-surface-variant uppercase mb-3">Előzmények</h4>
              <div class="flex flex-col gap-2 font-code-sm text-code-sm">
                ${Array.isArray(game.turnHistory) && game.turnHistory.length > 0
                  ? [...game.turnHistory].reverse().slice(0, 15).map(h => {
                      const c = TEAM_COLORS[h.winnerTeamIndex] || '#bbc9cf';
                      const verb = h.result === 'solved' ? 'megfejtette' : h.result === 'stolen' ? 'ellopta' : h.result === 'shared' ? 'megosztva' : 'nem fejtette meg';
                      return `<div class="flex items-center gap-2 text-on-surface">
                        <span class="px-1 rounded border" style="color:${c};border-color:${c}">${_esc((teams[h.winnerTeamIndex]?.name || '—')).toUpperCase()}</span>
                        <span class="${h.result === 'stolen' ? 'text-tertiary-fixed-dim' : ''}">${verb}: ${_esc(h.word)}</span>
                      </div>`;
                    }).join('')
                  : '<p class="text-on-surface-variant">Még nincs lezárt küldetés</p>'}
              </div>
            </div>

          </div>
        </div>
      </aside>
    </main>
  `;

  // ── Event listeners ──────────────────────────────────────────
  wireLeaveBar();

  document.getElementById('host-details-toggle')?.addEventListener('click', () => {
    const section = document.getElementById('host-details-section');
    const chevron = document.querySelector('#host-details-toggle .material-symbols-outlined:last-child');
    if (!section) return;
    _detailsOpen = !_detailsOpen;
    section.style.display = _detailsOpen ? '' : 'none';
    if (_detailsOpen) chevron?.classList.add('rotate-180'); else chevron?.classList.remove('rotate-180');
  });

  {
    const projUrl = () => new URL(
      `index.html?role=projector&room=${encodeURIComponent(appState.gameCode)}`,
      window.location.href
    ).href;

    document.getElementById('btn-open-projector')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const menu = document.getElementById('proj-menu');
      if (menu) menu.hidden = !menu.hidden;
    });

    document.getElementById('proj-popup')?.addEventListener('click', () => {
      document.getElementById('proj-menu').hidden = true;
      const win = window.open(projUrl(), `projector_${appState.gameCode}`, 'width=1280,height=720');
      if (!win) showToast('⚠️ Engedélyezd a felugró ablakokat a böngészőben!');
    });

    document.getElementById('proj-copy')?.addEventListener('click', async () => {
      document.getElementById('proj-menu').hidden = true;
      try {
        await navigator.clipboard.writeText(projUrl());
        showToast('🔗 Kivetítő link vágólapra másolva!');
      } catch {
        showToast('⚠️ Nem sikerült a másolás – másold kézzel: ' + projUrl());
      }
    });

    document.addEventListener('click', () => {
      const menu = document.getElementById('proj-menu');
      if (menu) menu.hidden = true;
    }, { capture: false });
  }

  document.getElementById('btn-reveal-word')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-reveal-word');
    if (btn) btn.disabled = true;
    try {
      await updateGameData(appState.gameCode, { 'currentTurn/wordRevealed': true });
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
      const ringEl  = document.getElementById('hg-ring');
      if (!timerEl) { clearInterval(_timerInterval); _timerInterval = null; return; }

      const info = getPhaseInfo(timerStartedAt, timerElapsedMs, timeDilationActive, commDisruptionActive);
      const col  = PHASE_HEX[info.colorClass] || '#feb528';
      timerEl.innerHTML = formatTime(info.secondsLeft);
      timerEl.style.color = col;
      if (labelEl) { labelEl.textContent = info.label; labelEl.style.color = col; }
      if (ringEl) {
        ringEl.style.stroke = col;
        ringEl.style.strokeDashoffset = String(Math.max(0, Math.min(RING_C, RING_C * (1 - info.secondsLeft / totalSeconds))));
      }
      if (info.phase >= 4) { clearInterval(_timerInterval); _timerInterval = null; }
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
