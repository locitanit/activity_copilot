/**
 * views/player-game.js – View 4/C: Játékos nézet játék közben (teljes implementáció)
 * ─────────────────────────────────────────────────────────────────────────────────
 * Aktív játékos : látja a titkosított adatcsomagot (arany), timer, csillagtérkép állása
 * Passzív játékos: NEM látja a szót, csak feladattípust, timert, csillagtérkép állását
 */

import { getElapsedMs, getPhaseInfo, formatTime } from '../logic/timer.js';
import { showToast } from '../app.js';
import { activateTorpedo, activateTrap, activateHyperdrive, activateTimeDilation, BOOST_TYPES } from '../logic/boosts.js';

const TEAM_COLORS = ['#ef4444','#3b82f6','#22c55e','#f59e0b','#a855f7','#ec4899'];

let _timerInterval = null;
let _detailsOpen = false;

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

            <p class="briefing-waiting">Várakozás az Irányítóközpont parancsára...</p>
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
  const timeDilationActive    = !!currentTurn.timeDilationActive;
  const commDisruptionActive  = !!currentTurn.commDisruptionActive;
  const phaseInfo      = getPhaseInfo(timerStartedAt, timerElapsedMs, timeDilationActive, commDisruptionActive);
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

  // Flotta sorrendje
  const myTeamPlayers  = myTeamIdx >= 0
    ? Object.entries(players)
        .filter(([, p]) => p.teamIndex === myTeamIdx)
        .sort((a, b) => (a[1].turnCount || 0) - (b[1].turnCount || 0))
    : [];
  const _activeId      = currentTurn.activePlayerId || null;
  const activeInMyTeam = _activeId && players[_activeId]?.teamIndex === myTeamIdx ? _activeId : null;
  const nextInMyTeam   = !activeInMyTeam && myTeamPlayers.length > 0 ? myTeamPlayers[0][0] : null;

  // Háttérszín a csapat színe alapján
  el.style.background = `linear-gradient(180deg, ${myColor}EE 0%, ${myColor}BB 18%, ${myColor}50 50%, var(--bg) 78%)`;

  el.innerHTML = `
    <!-- Játékkód badge (jobb felső sarok) -->
    <div style="position:fixed;top:0.55rem;right:0.75rem;z-index:50;
                background:rgba(2,5,16,0.85);border:1px solid var(--border);
                border-radius:6px;padding:0.18rem 0.65rem;
                font-size:0.72rem;letter-spacing:0.18em;
                color:#3d6a8a;font-weight:700;pointer-events:none">
      ${_esc(appState.gameCode || '')}
    </div>

    <div class="player-game-container">

      <!-- Szerep badge -->
      <span class="player-role-badge ${role}">
        ${roleLabel}
      </span>

      <!-- Flotta sorrendje -->
      ${myTeamPlayers.length > 0 ? `
      <div class="card" style="width:100%;text-align:left;padding:0.75rem 1rem">
        <h3 style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;
                   letter-spacing:0.08em;margin-bottom:0.5rem">Flotta sorrendje</h3>
        ${myTeamPlayers.map(([pid, p]) => {
          const isMe       = pid === appState.playerId;
          const isActivePl = pid === activeInMyTeam;
          const isNextPl   = pid === nextInMyTeam;
          return `
            <div style="display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0;
                        ${isMe ? 'font-weight:700' : ''}">
              <span style="width:1.3rem;text-align:center;font-size:0.9rem;flex-shrink:0">
                ${isActivePl ? '🚀' : isNextPl ? '▶' : ''}
              </span>
              <span style="font-size:0.88rem">${_esc(p.name)}</span>
              ${isMe ? '<span style="font-size:0.7rem;color:var(--text-muted);margin-left:0.4rem">(te)</span>' : ''}
            </div>`;
        }).join('')}
      </div>` : ''}

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

      <!-- Fejlesztések (Boost) – mindig látható -->
      ${(() => {
        const inv = myTeam?.inventory || [];
        const canActivate = isActive && !currentTurn.wordRevealed && !timerHasValue;
        return `
          <div class="card" style="width:100%">
            <h3 style="font-size:0.8rem;color:var(--text-muted);text-transform:uppercase;
                       letter-spacing:0.08em;margin-bottom:0.6rem">Flotta arzenál</h3>
            <div class="boost-inventory" style="flex-direction:column;align-items:flex-start">
              ${inv.length === 0
                ? '<span style="font-size:0.82rem;color:var(--text-muted)">Nincs fejlesztés</span>'
                : inv.map((bid, bidx) => {
                    const bt = BOOST_TYPES[bid] || { emoji: '?', name: bid };
                    if (!canActivate || bid === 'shield') {
                      return `<span class="boost-chip boost-chip--${bid}" tabindex="0" data-tooltip="${_esc(bt.description || '')}">${bt.emoji} ${_esc(bt.name)}</span>`;
                    }
                    if (bid === 'trap') {
                      const boardLen = game.settings?.boardLength || 30;
                      return `<div class="boost-activate-row">
                        <span class="boost-chip boost-chip--trap" tabindex="0" data-tooltip="${_esc(bt.description || '')}">${bt.emoji} ${_esc(bt.name)}</span>
                        <input type="number" min="0" max="${boardLen}" placeholder="Mező #"
                               class="trap-cell-input">
                        <button class="btn btn-warning trap-place-btn"
                                style="font-size:0.82rem;padding:.35rem .75rem"
                                data-bidx="${bidx}">🕳️ Lerakás</button>
                      </div>`;
                    }
                    if (bid === 'torpedo') {
                      return `<div class="boost-activate-row">
                        <span class="boost-chip boost-chip--torpedo" tabindex="0" data-tooltip="${_esc(bt.description || '')}">${bt.emoji} ${_esc(bt.name)}</span>
                        <select class="torpedo-target-sel" data-bidx="${bidx}">
                          ${teams.map((t, ti) => ti === myTeamIdx ? '' :
                            `<option value="${ti}">${_esc(t.name)}</option>`).join('')}
                        </select>
                        <button class="btn btn-danger torpedo-fire-btn"
                                style="font-size:0.82rem;padding:.35rem .75rem"
                                data-bidx="${bidx}">🚀 Tüzelés</button>
                      </div>`;
                    }
                    if (bid === 'warp') {
                      return `<div class="boost-activate-row">
                        <span class="boost-chip boost-chip--warp" tabindex="0" data-tooltip="${_esc(bt.description || '')}">${bt.emoji} ${_esc(bt.name)}</span>
                        <button class="btn btn-primary warp-btn"
                                style="font-size:0.82rem;padding:.35rem .75rem"
                                data-bidx="${bidx}">⚡ Aktiválás</button>
                      </div>`;
                    }
                    if (bid === 'timewarp') {
                      return `<div class="boost-activate-row">
                        <span class="boost-chip boost-chip--timewarp" tabindex="0" data-tooltip="${_esc(bt.description || '')}">${bt.emoji} ${_esc(bt.name)}</span>
                        <button class="btn btn-primary timewarp-btn"
                                style="font-size:0.82rem;padding:.35rem .75rem"
                                data-bidx="${bidx}">⏳ Aktiválás</button>
                      </div>`;
                    }
                    return '';
                  }).join('')
              }
            </div>
          </div>`;
      })()}

      <!-- Részletes nézet panel -->
      <div class="details-panel">
      <button class="details-toggle-btn" id="pg-details-toggle">🔽 Részletes nézet</button>

      <!-- Részletes szekció: timer + csillagtérkép -->
      <div id="pg-details-section" ${_detailsOpen ? '' : 'hidden'} class="details-section">

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

      </div><!-- /pg-details-section -->
      </div><!-- /details-panel -->

    </div>
  `;
  // ── Részletes nézet toggle ───────────────────────────────────
  {
    const btn = document.getElementById('pg-details-toggle');
    if (btn) btn.textContent = _detailsOpen ? '🔼 Részletes nézet elrejtése' : '🔽 Részletes nézet';
  }
  document.getElementById('pg-details-toggle')?.addEventListener('click', () => {
    const section = document.getElementById('pg-details-section');
    const btn = document.getElementById('pg-details-toggle');
    if (!section || !btn) return;
    _detailsOpen = !_detailsOpen;
    if (_detailsOpen) {
      section.removeAttribute('hidden');
      btn.textContent = '🔼 Részletes nézet elrejtése';
    } else {
      section.setAttribute('hidden', '');
      btn.textContent = '🔽 Részletes nézet';
    }
  });

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
      const boardLen = game.settings?.boardLength || 30;
      if (isNaN(cellNum) || cellNum < 0 || cellNum > boardLen) {
        showToast('⚠️ Adj meg érvényes mezőszámot (0–' + boardLen + ')!');
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
  });  // ── Helyi timer interval ──────────────────────────────────────
  if (timerStartedAt) {
    _timerInterval = setInterval(() => {
      const timerEl = document.getElementById('pg-timer');
      const labelEl = document.getElementById('pg-label');
      if (!timerEl) { clearInterval(_timerInterval); _timerInterval = null; return; }

      const info = getPhaseInfo(timerStartedAt, timerElapsedMs, timeDilationActive, commDisruptionActive);
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
