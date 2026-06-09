/**
 * views/player-game.js – View 4/C: Játékos nézet játék közben
 * Holografikus, csapatszínre hangolt dizájn (Tailwind + Material Symbols).
 * A "playing" állapot a player-device mockup alapján; a briefing hologramot tart.
 */

import { getElapsedMs, getPhaseInfo, getTotalSeconds, formatTime } from '../logic/timer.js';
import { showToast, leaveBarHtml, wireLeaveBar } from '../app.js';
import { activateTorpedo, activateTrap, activateHyperdrive, activateTimeDilation, BOOST_TYPES } from '../logic/boosts.js';

const TEAM_COLORS = ['#ef4444','#3b82f6','#22c55e','#f59e0b','#a855f7','#ec4899'];
const PHASE_HEX = { 'phase-0': '#bbc9cf', 'phase-1': '#00e676', 'phase-2': '#ffd600', 'phase-3': '#ff1744' };
const RING_C = 289; // 2 * π * 46

let _timerInterval = null;
let _detailsOpen = false;
let _tipCloserAttached = false;  // egyszer felfűzött "koppints kívülre → bezár" figyelő

// Csapatszínre hangolt ambient réteg (rács + scanlines + HUD sarkok)
function _ambient() {
  return `
    <div class="fixed inset-0 pointer-events-none z-0"
         style="background-image:linear-gradient(rgba(0,212,255,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.05) 1px,transparent 1px);background-size:20px 20px"></div>
    <div class="scanlines" style="z-index:30"></div>
    <div class="fixed top-0 left-0 w-16 h-16 pointer-events-none z-20 opacity-30"><div class="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-primary"></div></div>
    <div class="fixed top-0 right-0 w-16 h-16 pointer-events-none z-20 opacity-30"><div class="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-primary"></div></div>
    <div class="fixed bottom-0 left-0 w-16 h-16 pointer-events-none z-20 opacity-30"><div class="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-primary"></div></div>
    <div class="fixed bottom-0 right-0 w-16 h-16 pointer-events-none z-20 opacity-30"><div class="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-primary"></div></div>`;
}

export function renderPlayerGame(game, appState) {
  if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }

  const el = document.getElementById('view-player-game');

  if (!game) {
    el.style.background = '';
    el.innerHTML = `<div class="min-h-screen flex items-center justify-center">
      <p class="text-on-surface-variant">Várakozás a játékra...</p></div>`;
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
                  <strong>TÚLTÖLTÉS FÁZIS (0-30 mp):</strong> A rendszerek maximális fordulatszámon pörögnek. Csak a saját flottád hallja az adást. Ha ebben a kritikus időablakban sikerül a dekódolás, Houston azonnali taktikai fejlesztést küld a hajónak!
                </div>
              </div>
              <div class="briefing-rule">
                <span class="briefing-rule-num">3</span>
                <div>
                  <strong>NORMÁL ÜZEMMÓD (30-60 mp):</strong> Az energiaellátás stabilizálódik. A pajzsok még tartanak, így továbbra is csak a saját legénységed fejtheti meg a kódot, de a sikeres dekódolásért extra fejlesztés már nem jár.
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

            <p class="briefing-waiting">Várakozás az Irányítóközpont parancsára...</p>
          </div>
        </div>
      </div>
    `;
    return;
  }

  if (game.status !== 'playing') {
    el.style.background = '';
    el.innerHTML = `<div class="min-h-screen flex items-center justify-center">
      <p class="text-on-surface-variant">Várakozás a játékra...</p></div>`;
    return;
  }

  const currentTurn    = game.currentTurn || {};
  const teams          = game.teams       || [];
  const players        = game.players     || {};
  const timerStartedAt = currentTurn.timerStartedAt || null;
  const timerElapsedMs = currentTurn.timerElapsedMs || 0;
  const timeDilationActive    = !!currentTurn.timeDilationActive;
  const commDisruptionActive  = !!currentTurn.commDisruptionActive;
  const phaseInfo      = getPhaseInfo(timerStartedAt, timerElapsedMs, timeDilationActive, commDisruptionActive);
  const timerHasValue  = getElapsedMs(timerStartedAt, timerElapsedMs) > 0;
  const totalSeconds   = getTotalSeconds(timeDilationActive, commDisruptionActive) || 1;
  const timerColor     = PHASE_HEX[phaseInfo.colorClass] || '#feb528';
  const ringOffset     = Math.max(0, Math.min(RING_C, RING_C * (1 - phaseInfo.secondsLeft / totalSeconds)));

  const isActive      = currentTurn.activePlayerId === appState.playerId;
  const me            = players[appState.playerId];
  const myTeamIdx     = me?.teamIndex ?? -1;
  const myTeam        = myTeamIdx >= 0 ? teams[myTeamIdx] : null;
  const myColor       = myTeamIdx >= 0 ? TEAM_COLORS[myTeamIdx] : '#888';
  const isTeamActive  = !isActive && currentTurn.teamIndex === myTeamIdx && myTeamIdx >= 0;
  const role          = isActive ? 'active' : (isTeamActive ? 'guesser' : 'passive');
  const roleEmoji     = isActive ? '🚀' : (isTeamActive ? '🔬' : '📡');
  const roleLabel     = isActive ? 'Küldetésen vagy!' : (isTeamActive ? 'Visszafejtő' : 'Megfigyelő');

  const activeTeam    = teams[currentTurn.teamIndex] || {};
  const activeColor   = TEAM_COLORS[currentTurn.teamIndex] || '#888';
  const boardLen      = game.settings?.boardLength || 30;

  const myTeamPlayers = myTeamIdx >= 0
    ? Object.entries(players)
        .filter(([, p]) => p.teamIndex === myTeamIdx)
        .sort((a, b) => (a[1].turnCount || 0) - (b[1].turnCount || 0))
    : [];
  const _activeId      = currentTurn.activePlayerId || null;
  const activeInMyTeam = _activeId && players[_activeId]?.teamIndex === myTeamIdx ? _activeId : null;
  const nextInMyTeam   = !activeInMyTeam && myTeamPlayers.length > 0 ? myTeamPlayers[0][0] : null;

  // Csapatszínre hangolt háttér
  el.style.background = `linear-gradient(180deg, ${myColor}33 0%, ${myColor}1a 25%, #020510 60%)`;

  const inv = myTeam?.inventory || [];
  const canActivate = isActive && !currentTurn.wordRevealed && !timerHasValue;

  // Boost címke leírás-buborékkal (PC: hover, telefon: koppintás → lásd wireBoostTips)
  const _boostInfo = (bt, nameText, nameCls, extraCls) =>
    `<span class="boost-info ${extraCls || ''}" tabindex="0" role="button"
           data-tooltip="${_esc(bt.description || '')}" aria-label="${_esc(bt.name)} – ${_esc(bt.description || '')}">
       <span class="text-xl">${bt.emoji}</span>
       <span class="${nameCls}">${_esc(nameText)}</span>
     </span>`;

  el.innerHTML = `
    ${_ambient()}
    <main class="relative z-10 w-full max-w-md mx-auto px-margin-mobile py-5 flex flex-col gap-4 min-h-screen">

      <!-- Header -->
      <header class="flex justify-between items-center">
        ${leaveBarHtml()}
        <div class="glass-panel px-3 py-1 border border-primary/20 rounded font-code-sm text-code-sm">
          <span class="text-primary opacity-70">SESSION: </span>
          <span class="text-primary-container font-bold tracking-widest">${_esc(appState.gameCode || '')}</span>
        </div>
      </header>

      <!-- Role badge -->
      <section class="glass-panel rounded-r-lg p-4 flex items-center gap-4 relative overflow-hidden"
               style="border-left:4px solid ${myColor};box-shadow:inset 0 0 15px ${myColor}40">
        <div class="text-3xl" style="filter:drop-shadow(0 0 8px ${myColor})">${roleEmoji}</div>
        <div>
          <h1 class="font-headline-lg-mobile text-headline-lg-mobile uppercase tracking-widest"
              style="color:${myColor};text-shadow:0 0 6px ${myColor}66">${_esc(myTeam?.name ?? '')}</h1>
          <p class="font-body-md text-body-md text-on-surface-variant">${roleLabel}</p>
        </div>
      </section>

      <!-- Turn order -->
      ${myTeamPlayers.length > 0 ? `
      <section class="glass-panel border border-primary/10 rounded-lg p-3">
        <div class="font-label-md text-label-md text-on-surface-variant uppercase mb-2 text-xs">Flotta sorrendje</div>
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          ${myTeamPlayers.map(([pid, p], idx) => {
            const isMe       = pid === appState.playerId;
            const isActivePl = pid === activeInMyTeam;
            const isNextPl   = pid === nextInMyTeam;
            return `<span class="flex items-center gap-1 ${isActivePl ? '' : isNextPl ? 'opacity-70' : 'opacity-40'}">
                ${isActivePl ? '<span class="material-symbols-outlined text-sm fill" style="color:'+myColor+'">rocket_launch</span>'
                  : isNextPl ? '<span class="material-symbols-outlined text-xs">play_arrow</span>' : ''}
                <span class="font-label-md text-label-md ${isMe ? 'font-bold' : ''}">${_esc(p.name)}${isMe ? ' (te)' : ''}</span>
              </span>${idx < myTeamPlayers.length - 1 ? '<span class="text-outline-variant text-xs">→</span>' : ''}`;
          }).join('')}
        </div>
      </section>` : ''}

      <!-- Secret word card -->
      <section class="glass-panel rounded-xl p-6 text-center relative flex flex-col items-center justify-center min-h-[150px]"
               style="border:1px solid ${myColor}80;box-shadow:0 0 20px ${myColor}40">
        <div class="absolute top-2 left-2 w-3 h-3 border-t border-l" style="border-color:${myColor}"></div>
        <div class="absolute top-2 right-2 w-3 h-3 border-t border-r" style="border-color:${myColor}"></div>
        <div class="absolute bottom-2 left-2 w-3 h-3 border-b border-l" style="border-color:${myColor}"></div>
        <div class="absolute bottom-2 right-2 w-3 h-3 border-b border-r" style="border-color:${myColor}"></div>
        ${isActive && currentTurn.word && currentTurn.wordRevealed
          ? `<div class="flex items-center gap-2 mb-2 px-3 py-1 rounded-full" style="background:${myColor}1a">
               <span class="material-symbols-outlined text-sm" style="color:${myColor}">visibility</span>
               <span class="font-label-md text-label-md" style="color:${myColor}">🤫 Csak te látod!</span>
             </div>
             <h2 class="font-display-md text-display-md text-on-surface uppercase tracking-widest drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">${_esc(currentTurn.word)}</h2>`
          : isActive && !currentTurn.wordRevealed
            ? `<p class="font-headline-lg-mobile text-headline-lg-mobile text-primary-fixed-dim">🚀 Felkészülés!</p>
               <p class="font-body-md text-body-md text-on-surface-variant mt-2">Az Irányítóközpont hamarosan felfedi az adatcsomagodat.</p>`
            : `<span class="material-symbols-outlined text-4xl text-on-surface-variant mb-2">visibility_off</span>
               <p class="font-body-lg text-body-lg text-on-surface-variant">🙈 Titkos szó rejtve</p>`
        }
        <div class="flex gap-4 mt-4 text-on-surface-variant">
          <span class="font-body-md text-body-md">🎯 ${_esc(currentTurn.taskType ?? '–')}</span>
          <span class="font-body-md text-body-md">⭐ ${currentTurn.points ?? '–'} fényév</span>
        </div>
      </section>

      <!-- Fleet arsenal -->
      <section>
        <h3 class="font-label-md text-label-md text-primary opacity-70 mb-2 tracking-widest flex items-center gap-2 text-xs uppercase">
          <span class="material-symbols-outlined text-sm">build</span> Flotta arzenál
        </h3>
        <div class="flex flex-col gap-2">
          ${inv.length === 0
            ? '<span class="font-body-md text-body-md text-on-surface-variant">Nincs fejlesztés</span>'
            : inv.map((bid, bidx) => {
                const bt = BOOST_TYPES[bid] || { emoji: '?', name: bid };
                if (!canActivate || bid === 'shield') {
                  return `<div class="glass-panel border border-outline-variant/30 rounded-lg p-3 flex items-center gap-2 ${bid === 'shield' ? '' : 'opacity-50'}">
                    ${_boostInfo(bt, bt.name + (bid === 'shield' ? ' (passzív)' : ''), 'font-label-md text-label-md text-on-surface-variant')}
                  </div>`;
                }
                if (bid === 'trap') {
                  return `<div class="boost-activate-row glass-panel border border-primary/20 rounded-lg p-3 flex flex-wrap items-center gap-2 outer-glow-cyan">
                    ${_boostInfo(bt, bt.name, 'font-label-md text-label-md text-on-surface', 'flex-1')}
                    <input type="number" min="0" max="${boardLen}" placeholder="Mező #"
                           class="trap-cell-input w-24 bg-surface-container border border-outline-variant rounded px-2 py-1 text-on-surface">
                    <button class="trap-place-btn bg-tertiary-container text-on-tertiary-container px-3 py-1.5 rounded font-label-md text-label-md" data-bidx="${bidx}">🕳️ Lerakás</button>
                  </div>`;
                }
                if (bid === 'torpedo') {
                  return `<div class="boost-activate-row glass-panel border border-primary/20 rounded-lg p-3 flex flex-wrap items-center gap-2 outer-glow-cyan">
                    ${_boostInfo(bt, bt.name, 'font-label-md text-label-md text-on-surface', 'flex-1')}
                    <select class="torpedo-target-sel bg-surface-container border border-outline-variant rounded px-2 py-1 text-on-surface" data-bidx="${bidx}">
                      ${teams.map((t, ti) => ti === myTeamIdx ? '' : `<option value="${ti}">${_esc(t.name)}</option>`).join('')}
                    </select>
                    <button class="torpedo-fire-btn bg-error text-on-error px-3 py-1.5 rounded font-label-md text-label-md" data-bidx="${bidx}">🚀 Tüzelés</button>
                  </div>`;
                }
                if (bid === 'warp') {
                  return `<div class="boost-activate-row glass-panel border border-primary/20 rounded-lg p-3 flex items-center gap-2 outer-glow-cyan">
                    ${_boostInfo(bt, bt.name, 'font-label-md text-label-md text-on-surface', 'flex-1')}
                    <button class="warp-btn bg-primary-container text-on-primary-container px-3 py-1.5 rounded font-label-md text-label-md" data-bidx="${bidx}">⚡ Aktiválás</button>
                  </div>`;
                }
                if (bid === 'timewarp') {
                  return `<div class="boost-activate-row glass-panel border border-primary/20 rounded-lg p-3 flex items-center gap-2 outer-glow-cyan">
                    ${_boostInfo(bt, bt.name, 'font-label-md text-label-md text-on-surface', 'flex-1')}
                    <button class="timewarp-btn bg-primary-container text-on-primary-container px-3 py-1.5 rounded font-label-md text-label-md" data-bidx="${bidx}">⏳ Aktiválás</button>
                  </div>`;
                }
                return '';
              }).join('')}
        </div>
      </section>

      <!-- Collapsible details (timer + standings) -->
      <section class="mt-auto">
        <div class="glass-panel border border-primary/10 rounded-lg overflow-hidden">
          <button id="pg-details-toggle" class="flex justify-between items-center p-4 w-full hover:bg-surface-container-highest/40 transition-colors">
            <div class="flex items-center gap-3">
              <div class="relative w-12 h-12 flex items-center justify-center">
                <svg class="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="46" fill="transparent" stroke="#2f3639" stroke-width="5"></circle>
                  <circle id="pg-ring" cx="50" cy="50" r="46" fill="transparent" stroke="${timerColor}" stroke-width="5"
                          stroke-linecap="round" stroke-dasharray="${RING_C}" stroke-dashoffset="${ringOffset}"
                          style="transition:stroke-dashoffset 1s linear, stroke 0.3s"></circle>
                </svg>
                <span id="pg-timer" class="font-code-sm text-code-sm font-bold" style="color:${timerColor}">${formatTime(phaseInfo.secondsLeft)}</span>
              </div>
              <div class="text-left">
                <div id="pg-label" class="font-label-md text-label-md uppercase" style="color:${timerColor}">${timerStartedAt ? phaseInfo.label : (timerHasValue ? 'Szüneteltetve' : 'Még nem indult')}</div>
                <div class="font-code-sm text-code-sm text-on-surface-variant">Csillagtérkép állása</div>
              </div>
            </div>
            <span class="material-symbols-outlined text-outline transition-transform ${_detailsOpen ? 'rotate-180' : ''}">expand_more</span>
          </button>
          <div id="pg-details-section" style="${_detailsOpen ? '' : 'display:none'}" class="p-4 border-t border-primary/10 grid grid-cols-2 gap-3">
            ${teams.map((t, i) => {
              const pct = Math.min(100, Math.round((t.score / boardLen) * 100));
              return `
                <div class="flex flex-col gap-1">
                  <div class="flex justify-between font-code-sm text-code-sm">
                    <span style="color:${TEAM_COLORS[i]}">${_esc(t.name)}</span><span>${t.score}</span>
                  </div>
                  <div class="w-full h-1.5 bg-surface-variant rounded-full overflow-hidden">
                    <div class="h-full" style="width:${pct}%;background:${TEAM_COLORS[i]}"></div>
                  </div>
                </div>`;
            }).join('')}
          </div>
        </div>
      </section>
    </main>
  `;

  wireLeaveBar();

  // ── Részletes nézet toggle ───────────────────────────────────
  document.getElementById('pg-details-toggle')?.addEventListener('click', () => {
    const section = document.getElementById('pg-details-section');
    const chevron = document.querySelector('#pg-details-toggle .material-symbols-outlined');
    if (!section) return;
    _detailsOpen = !_detailsOpen;
    section.style.display = _detailsOpen ? '' : 'none';
    if (_detailsOpen) chevron?.classList.add('rotate-180'); else chevron?.classList.remove('rotate-180');
  });

  // ── Boost leírás buborék (PC: hover; telefon: koppintás) ────
  document.querySelectorAll('.boost-info').forEach(info => {
    info.addEventListener('click', (e) => {
      e.preventDefault();
      const open = info.classList.contains('tip-open');
      document.querySelectorAll('.boost-info.tip-open').forEach(o => o.classList.remove('tip-open'));
      if (open) { info.blur(); } else { info.classList.add('tip-open'); }
    });
    info.addEventListener('blur', () => info.classList.remove('tip-open'));
  });
  // Koppintás bárhová a buborékon kívül → bezárás (egyszer fűzzük fel)
  if (!_tipCloserAttached) {
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.boost-info')) {
        document.querySelectorAll('.boost-info.tip-open').forEach(o => o.classList.remove('tip-open'));
      }
    });
    _tipCloserAttached = true;
  }

  // ── Boost aktiválók ─────────────────────────────────────────
  const _allBoostBtns = () => document.querySelectorAll('.torpedo-fire-btn,.warp-btn,.timewarp-btn,.trap-place-btn');

  document.querySelectorAll('.torpedo-fire-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const bidx = parseInt(btn.dataset.bidx, 10);
      const sel  = btn.closest('.boost-activate-row')?.querySelector('.torpedo-target-sel');
      const targetIdx = parseInt(sel?.value ?? '0', 10);
      _allBoostBtns().forEach(b => b.disabled = true);
      try {
        const result = await activateTorpedo(appState.gameCode, game, myTeamIdx, targetIdx, bidx);
        if (result.shielded) {
          showToast('🛡️ A célpont pajzsa kivédte a torpedót!');
        } else if (result.hit) {
          showToast(`🚀 Torpedó találat! −${result.damage} fényév a célponttól.`);
        } else {
          showToast('🚀 A torpedó nem talált célba.');
        }
      } catch (err) {
        showToast('❌ Hiba: ' + err.message);
        _allBoostBtns().forEach(b => b.disabled = false);
      }
    });
  });

  document.querySelectorAll('.warp-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (game.currentTurn?.hyperdriveActive) {
        showToast('⚠️ Ebben a körben már aktív a hiperhajtómű!');
        return;
      }
      const bidx = parseInt(btn.dataset.bidx, 10);
      _allBoostBtns().forEach(b => b.disabled = true);
      try {
        await activateHyperdrive(appState.gameCode, game, myTeamIdx, bidx);
        showToast('⚡ Hiperhajtomű aktiválva! Dupla pont siker esetén.');
      } catch (err) {
        showToast('❌ Hiba: ' + err.message);
        _allBoostBtns().forEach(b => b.disabled = false);
      }
    });
  });

  document.querySelectorAll('.timewarp-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const bidx = parseInt(btn.dataset.bidx, 10);
      _allBoostBtns().forEach(b => b.disabled = true);
      try {
        await activateTimeDilation(appState.gameCode, game, myTeamIdx, bidx);
        showToast('⏳ Időtágulás aktiválva! Az 1. fázis 45 mp-ig tart.');
      } catch (err) {
        showToast('❌ Hiba: ' + err.message);
        _allBoostBtns().forEach(b => b.disabled = false);
      }
    });
  });

  document.querySelectorAll('.trap-place-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const bidx = parseInt(btn.dataset.bidx, 10);
      const input = btn.closest('.boost-activate-row')?.querySelector('.trap-cell-input');
      const cellNum = parseInt(input?.value ?? '', 10);
      const boardLenLocal = game.settings?.boardLength || 30;
      if (isNaN(cellNum) || cellNum < 0 || cellNum > boardLenLocal) {
        showToast('⚠️ Adj meg érvényes mezőszámot (0–' + boardLenLocal + ')!');
        return;
      }
      if (game.traps?.[String(cellNum)] !== undefined) {
        showToast(`⚠️ A ${cellNum}. mezőn már van csapda!`);
        return;
      }
      _allBoostBtns().forEach(b => b.disabled = true);
      try {
        await activateTrap(appState.gameCode, game, myTeamIdx, cellNum, bidx);
        showToast(`🕳️ Csapda lerakva a ${cellNum}. mezőre!`);
      } catch (err) {
        showToast('❌ Hiba: ' + err.message);
        _allBoostBtns().forEach(b => b.disabled = false);
      }
    });
  });

  // ── Helyi timer interval ──────────────────────────────────────
  if (timerStartedAt) {
    _timerInterval = setInterval(() => {
      const timerEl = document.getElementById('pg-timer');
      const labelEl = document.getElementById('pg-label');
      const ringEl  = document.getElementById('pg-ring');
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
