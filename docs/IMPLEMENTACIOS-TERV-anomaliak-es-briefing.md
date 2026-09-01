# Implementációs terv – Anomália-rendszer átdolgozása + Briefing képernyő eltávolítása

**Projekt:** RMG Astro-Activity
**Készült:** 2026-09-01
**Célközönség:** Claude Code (ez a dokumentum a munkautasítás)

---

## 0. A feladat két része

1. **Anomáliák:** a nevek és a hatások jelenleg nem függenek össze. Új, koherens anomália-készlet
   bevezetése (nevek, hatások, súlyok), a meglévő motor-hookokra építve.
   **Ide tartozik az is, hogy minden egyes hatásnak saját animációja legyen a kivetítő tábláján**
   (A6. fejezet) – enélkül a rész nincs kész.
2. **Briefing:** a küldetés eleji bevezető szöveg (a `briefing` státusz és a hozzá tartozó
   hologram-képernyők) teljes eltávolítása. A lobbyból induló játék **azonnal a `playing`
   állapotba** lép.

Mindkét rész önállóan mergelhető. Javasolt sorrend: **B rész (briefing) először** (kicsi, kockázatmentes),
utána **A rész (anomáliák)**.

---

# A RÉSZ – Anomália-rendszer

## A1. Jelenlegi állapot (audit)

Forrás: `js/logic/anomaly.js`, `js/logic/scoring.js` (167–200. sor), `js/logic/timer.js`.

Az anomália akkor sül el, ha egy kör **pontszerző** csapatának új pozíciója
`isAnomalyCell()` (minden N. mező, N = `settings.anomalyEvery`, alapért. 5).
A négy esemény ma **egyforma valószínűségű (25-25%)**.

| # | Név | Emoji | Jelenlegi hatás | Kit érint? | Baj a névvel |
|---|-----|-------|-----------------|-----------|--------------|
| 1 | Szupernóva | 💥 | Az utolsó helyen álló flotta(k) **+2 fényév** | **Nem** azt, aki rálépett | A szupernóva egy pusztító robbanás. Itt jutalom. Ráadásul annak jutalom, aki hozzá sem ért. |
| 2 | Féreglyuk | 🌀 | A rálépő flotta: 50% **+3**, 50% **−2** | A rálépőt | ✅ Ez stimmel. Marad. |
| 3 | Fekete lyuk eseményhorizont | ⚫ | Az első és utolsó közti táv **megfeleződik**, az utolsó **előrehúzódik** | Nem azt, aki rálépett | Fordítva van: a fekete lyuk **húz és lassít**, nem gyorsít. Ráadásul funkcionálisan ugyanaz, mint a szupernóva (felzárkóztatás) – két név, egy szerep. |
| 4 | Kommunikációs zavar | 📡 | A következő kör azonnal **Nyílt Frekvencia** – bárki ellophatja | Mindenkit | Fordítva van: a „zavar” nehezítené a kommunikációt, itt viszont **mindenki jól hallja** az adást. Ez nyílt adás, nem zavar. |

**Összefoglalva a három hiba:**
- **Szemantikai fordítottság** (szupernóva = jutalom, fekete lyuk = előrehúz, komm.zavar = mindenki hall).
- **Duplikált szerep:** 2 esemény a 4-ből ugyanazt csinálja (felzárkóztat).
- **Rossz célpont:** 4-ből 3 esemény nem azt érinti, aki rálépett – a diákok szemszögéből ez érthetetlen
  („rálépek egy mezőre, és a másik csapat kap 2 pontot?”).

## A2. Tervezési szabályok (ezekhez tartsuk magunkat)

1. **A névből következzen a hatás.** Ha a diák hallja a nevet, tudja, mi fog történni.
2. **Alapértelmezett célpont az, aki rálépett.** Ha másokat is érint, a névnek utalnia kell rá
   (lökéshullám, vontatósugár, meteorraj – ezek nyilvánvalóan „területi” hatások).
3. **Minden anomáliához tartozzon egy mondatos, valós fizikai magyarázat** (`physicsNote` mező).
   Ez ingyen tananyag: a kivetítőn és a modalban is megjelenik.
4. **Marad az egyensúly:** a rálépőnek kb. fele-fele arányban legyen jó/rossz, és maradjon
   1-2 felzárkóztató esemény, hogy a mezőny ne szakadjon szét.
5. **Csak meglévő motor-hookokra építünk:** `score`, `skipNextTurn`, `inventory` (boost),
   `commDisruptionActive`, `traps`. Új globális rendszer nem kell (egy kivétel: `forceNextTaskType`).
6. **Minden hatásnak saját animációja van a táblán.** Amit nem lehet megmutatni a kivetítőn,
   azt ne is vezessük be. Két anomália nem nézhet ki ugyanúgy. Részletek: A6.

## A3. Javasolt új anomália-készlet (9 esemény)

> A `weight` a sorsolási súly; összeg = 100.

### Csoport 1 – Aki rálép, azt éri (kockázat / jutalom)

| id | Név | Emoji | Hatás | weight |
|----|-----|-------|-------|--------|
| `wormhole` | Féreglyuk | 🌀 | **Változatlan.** A rálépő flotta: 50% **+3**, 50% **−2** fényév. Kétlépéses modal (Sorsolás → Hatás) marad. | 14 |
| `supernova` | Szupernóva | 💥 | **ÚJ:** lökéshullám. Az anomália-mezőtől **±2 mezőn belül álló MINDEN flotta −2 fényév** (a rálépőt is beleértve). | 11 |
| `blackhole` | Fekete lyuk – eseményhorizont | ⚫ | **ÚJ:** idődilatáció. A rálépő flotta **kimarad a következő köréből** (`skipNextTurn = true`). Pontváltozás nincs. | 9 |
| `salvage` | Roncsmező | 📦 | **ÚJ esemény:** a rálépő flotta egy elhagyott konténerben **véletlenszerű fejlesztést (boostot) talál**. | 14 |

### Csoport 2 – Felzárkóztatás (a mezőny összetartása)

| id | Név | Emoji | Hatás | weight |
|----|-----|-------|-------|--------|
| `slingshot` | Gravitációs hintamanőver | 🌠 | A **leghátul álló** flotta(k) **+2 fényév**. (Ez a mai „szupernóva” hatása, csak most a név is ezt jelenti.) | 12 |
| `tractorbeam` | Vontatósugár | 🧲 | Houston vontatósugarat küld: az utolsó flotta(k) **behozzák a lemaradás felét** az élen állóhoz képest. (Ez a mai „fekete lyuk” hatása, helyes névvel.) | 9 |

### Csoport 3 – A következő kört befolyásolja (globális)

| id | Név | Emoji | Hatás | weight |
|----|-----|-------|-------|--------|
| `comms` | Kommunikációs zavar | 📡 | **ÚJ:** a következő kör feladattípusa kényszerítve **„mutogatás”** (se szó, se rajz – tényleg megszakadt a kommunikáció). | 9 |
| `openfreq` | Nyílt frekvencia (titkosítás összeomlása) | 🔓 | A következő kör azonnal a 3. fázisban indul – **bárki ellophatja**. (Ez a mai `comms` hatása, helyes névvel.) | 14 |

### Csoport 4 – Élboly-fékezés

| id | Név | Emoji | Hatás | weight |
|----|-----|-------|-------|--------|
| `meteor` | Meteorraj | ☄️ | Az **élen álló** flotta(k) **−2 fényév** – ők csapódnak bele először a törmelékmezőbe. | 8 |

> Az élen álló megfékezése más, mint a hátul állók előrehúzása: itt a vezető veszít,
> nem a lemaradó nyer. A kettő együtt tartja szorosan a mezőnyt anélkül, hogy
> bármelyik hatás egyeduralkodó lenne.

**Fizikai magyarázatok (`physicsNote`) – ezeket írjuk bele a kódba:**

- Féreglyuk: *„A féreglyuk átjáró a téridőben – csak azt nem tudod előre, hol jössz ki.”*
- Szupernóva: *„Egy felrobbanó csillag lökéshulláma másodpercek alatt söpri el a közeli hajókat.”*
- Fekete lyuk: *„Az eseményhorizont közelében lelassul az idő – amíg nektek egy pillanat, addig kint eltelik egy teljes kör.”*
- Roncsmező: *„A régi expedíciók elhagyott konténerei évszázadokig sodródnak a mélyűrben.”*
- Gravitációs hintamanőver: *„Egy bolygó gravitációja körbelendíti és felgyorsítja az arra járó űrhajót – üzemanyag nélkül.”*
- Vontatósugár: *„Az irányított energianyaláb megfogja és maga után húzza a lemaradt hajót.”*
- Kommunikációs zavar: *„A csillagközi zaj megeszi a hangot és a képet – marad a kézjel.”*
- Nyílt frekvencia: *„Ha a titkosítás összeomlik, az adást a galaxis fele hallja.”*
- Meteorraj: *„A törmelékmező az útvonal elején álló hajókat találja el először.”*

## A4. Egyensúly-ellenőrzés

Súlyok összege = 100.

| Szerep | Események | Együtt |
|--------|-----------|--------|
| A rálépőnek **jó** | Roncsmező (14) + Féreglyuk fele (7) | **21%** |
| A rálépőnek **rossz** | Szupernóva (11) + Fekete lyuk (9) + Féreglyuk fele (7) | **27%** |
| **Felzárkóztatás** (hátul állók előre) | Hintamanőver (12) + Vontatósugár (9) | **21%** |
| **Élboly-fékezés** (vezető vissza) | Meteorraj (8) | **8%** |
| **A következő kört módosítja** | Nyílt frekvencia (14) + Komm. zavar (9) | **23%** |

Két dolog fontos ebben:

- A rálépő flotta az esetek **kb. felében** ténylegesen érintett (21 + 27 = 48%).
  Ma ez 25% (csak a féreglyuknál) – ezért érzik a diákok esetlegesnek az anomáliákat.
- A mezőnyt összetartó hatások (felzárkóztatás + élboly-fékezés) együtt **29%** –
  nagyjából annyi, mint ma az 50%, de három különböző, felismerhető formában.

---

## A5. Kódszintű teendők

### A5.1 `js/logic/anomaly.js` – az `ANOMALY_EVENTS` objektum bővítése

Minden eseményhez kerüljön be három új mező:

```js
supernova: {
  id: 'supernova',
  name: 'Szupernóva',
  emoji: '💥',
  weight: 11,                       // ÚJ – súlyozott sorsolás
  targeting: 'area',                // ÚJ – 'lander' | 'area' | 'last' | 'leader' | 'global'
  physicsNote: 'Egy felrobbanó csillag lökéshulláma…',   // ÚJ
  generalDescription: 'Lökéshullám! Az anomáliától 2 fényéven belül álló minden flotta 2 fényévet hátravetődik.',
},
```

### A5.2 Súlyozott sorsolás + ismétlés-tiltás

A mai `eventKeys[Math.floor(Math.random() * eventKeys.length)]` helyett:

```js
const _ANOMALY_POOL = Object.values(ANOMALY_EVENTS)
  .flatMap(e => Array(e.weight ?? 10).fill(e.id));

function _rollAnomalyId(lastId) {
  for (let i = 0; i < 12; i++) {                 // max 12 próba
    const id = _ANOMALY_POOL[Math.floor(Math.random() * _ANOMALY_POOL.length)];
    if (id !== lastId) return id;                // ne jöjjön kétszer egymás után ugyanaz
  }
  return _ANOMALY_POOL[Math.floor(Math.random() * _ANOMALY_POOL.length)];
}
```

Az utolsó anomália id-jét tároljuk a `game.lastAnomalyId` mezőben
(írás a `triggerAnomalyEvent` végén, olvasás a sorsolás előtt).
`startNextTurn` **ne** nullázza (körökön átívelő emlék).

### A5.3 Az egyes hatások implementációja

A `triggerAnomalyEvent` meglévő szerkezete marad:
**(1)** hatás kiszámítása → **(2)** `anomalyPending` írása (kivetítő) → **(3)** host modal →
**(4)** `updates` írása + `anomalyEvent` + `boostLog`.
A `switch (eventId)` blokkba kerülnek az új ágak.

#### `supernova` (lökéshullám)

```js
case 'supernova': {
  const cell = teams[landingTeamIndex].score;      // az anomália-mező száma
  const movedNames = [];
  affected = [];
  teams.forEach((t, i) => {
    if (Math.abs((t.score || 0) - cell) <= 2) {
      const ns = Math.max(0, (t.score || 0) - 2);
      if (ns === t.score) return;                  // 0-n álló flotta nem mozdul
      movedNames.push(t.name);
      affected.push({ teamIndex: i, from: t.score, to: ns });
      teams[i] = { ...t, score: ns };
      updates[`teams/${i}/score`] = ns;
    }
  });
  specificDescription = movedNames.length
    ? `A lökéshullám hátraveti: ${movedNames.join(', ')} −2 fényév`
    : 'A lökéshullám senkit sem ért el.';
  break;
}
```

#### `blackhole` (idődilatáció – kimaradó kör)

```js
case 'blackhole': {
  updates[`teams/${landingTeamIndex}/skipNextTurn`] = true;
  teams[landingTeamIndex] = { ...teams[landingTeamIndex], skipNextTurn: true };  // FONTOS, lásd A5.4
  specificDescription = `${teamName} beleragadt az eseményhorizontba – kimarad a következő köréből!`;
  break;
}
```

#### `salvage` (Roncsmező – boost)

Importálni kell: `import { getRandomBoost, BOOST_TYPES } from './boosts.js';`

```js
case 'salvage': {
  const boostId = getRandomBoost();
  const inv = [...(teams[landingTeamIndex].inventory || []), boostId];
  teams[landingTeamIndex] = { ...teams[landingTeamIndex], inventory: inv };
  updates[`teams/${landingTeamIndex}/inventory`] = inv;
  const b = BOOST_TYPES[boostId];
  specificDescription = `${teamName} fejlesztést talált a roncsok között: ${b.emoji} ${b.name}!`;
  break;
}
```

> ⚠️ Vigyázat: a `boosts.js` → `anomaly.js` irányban **nincs** import, tehát körkörös
> függőség nem keletkezik. Ellenőrizni kell, hogy ez így is marad.
> ⚠️ A boostot **ne** az `addBoostToTeam()`-mel adjuk, mert az azonnal ír a DB-be – itt
> a hatásnak csak a modal OK gombja után szabad érvényesülnie (ezért állítjuk be kézzel az `updates`-ben).

#### `slingshot` (a mai szupernóva-hatás)

A mai `case 'supernova'` blokk **változatlan kódja** kerül át ide, csak a szöveg lesz más:
`specificDescription = `Gravitációs lendület: ${movedNames.join(' és ')} előrelép ${minScore} → ${newScore}`;`

#### `tractorbeam` (a mai fekete lyuk-hatás)

A mai `case 'blackhole'` blokk kódja kerül át ide. **Javítandó hiba benne:**
a leíró szöveg `minScore + advance`-et ír, miközben a tényleges új pont
`Math.min(boardLength, t.score + advance)`. Ha az érték a pálya végénél levágódik,
a szöveg hazudik. A szövegben a ténylegesen beírt `ns` értéket kell használni.

#### `comms` (ÚJ hatás – kényszerített mutogatás)

```js
case 'comms': {
  updates.forceNextTaskType = 'mutogatás';
  specificDescription = 'A csatorna zajos! A következő körben csak mutogatni lehet – se beszéd, se rajz.';
  break;
}
```

A `triggerAnomalyEvent` visszatérési értékébe kerüljön be:
`return { event, updatedTeams: teams, commDisruptionActive, forceNextTaskType }`.

#### `openfreq` (a mai comms-hatás, új néven)

```js
case 'openfreq': {
  updates.commDisruptionActive = true;
  commDisruptionActive = true;
  specificDescription = 'A titkosítás összeomlott – a következő kör teljes egészében rabolható!';
  break;
}
```

> A `commDisruptionActive` **adatmező nevét ne írjuk át** (timer.js, turn-manager.js,
> host-game.js, player-game.js, projector.js is használja). Csak az esemény id-je és neve változik.

#### `meteor` (Meteorraj)

```js
case 'meteor': {
  const maxScore = Math.max(...teams.map(t => t.score || 0));
  affected = [];
  const movedNames = [];
  teams.forEach((t, i) => {
    if ((t.score || 0) === maxScore) {
      const ns = Math.max(0, maxScore - 2);
      movedNames.push(t.name);
      affected.push({ teamIndex: i, from: maxScore, to: ns });
      teams[i] = { ...t, score: ns };
      updates[`teams/${i}/score`] = ns;
    }
  });
  specificDescription = `${movedNames.join(' és ')} törmelékmezőbe futott: −2 fényév`;
  break;
}
```

### A5.4 `js/logic/scoring.js` – illesztés

1. **`skipNextTurn` továbbadása.** A `triggerAnomalyEvent` által visszaadott `updatedTeams`
   tömb már tartalmazza a `skipNextTurn: true` flaget (lásd A5.3 `blackhole`), és ez a tömb
   megy tovább a `startNextTurn`-be `postAnomalyTeams`-ként. Ellenőrizni, hogy a
   `startNextTurn` ebből olvassa a skipet (ma igen: `teams[nextTeamIndex].skipNextTurn`).

2. **`forceNextTaskType` továbbadása.** A ciklusban gyűjtsük össze:

```js
let forceNextTaskType = null;
...
if (result.forceNextTaskType) forceNextTaskType = result.forceNextTaskType;
...
await startNextTurn(gameCode, {
  ...game,
  teams: postAnomalyTeams,
  commDisruptionActive: game.commDisruptionActive || commDisruptionTriggered,
  forceNextTaskType,
  turnHistory,
  players: _buildUpdatedPlayers(players, activePlayerId),
});
```

3. **BUGFIX (a mostani kódban is hiba):** a 140. sor környékén a boost-szerzés fázisa
   `getCurrentPhase(...)`-szal dől el, de **nem kapja meg a `commDisruptionActive` paramétert**.
   Így egy nyílt-frekvenciás körben (ahol a kijelzőn végig 3. fázis van) a csapat mégis
   kaphat boostot az első 30 másodpercben. Javítás:

```js
const phase = getCurrentPhase(
  currentTurn.timerStartedAt,
  currentTurn.timerElapsedMs || 0,
  timeDilation,
  !!currentTurn.commDisruptionActive        // ← ÚJ, hiányzó 4. paraméter
);
```

### A5.5 `js/logic/turn-manager.js` – `forceNextTaskType` feldolgozása

A `startNextTurn`-ben, a `turnBase` előállítása után:

```js
if (game.forceNextTaskType) {
  turnBase = { ...turnBase, taskType: game.forceNextTaskType };
  const POINTS_BY_TYPE = { 'körülírás': [2,3], 'mutogatás': [4,5,6], 'rajzolás': [4,5,6] };
  const pool = POINTS_BY_TYPE[game.forceNextTaskType] ?? [3,4,5];
  turnBase.points = pool[Math.floor(Math.random() * pool.length)];   // pont a NEW típushoz igazítva
}
```

és a záró `updateGameData(...)` hívásba: `forceNextTaskType: null` (fogyasztás után törlés).

A `POINTS_BY_TYPE` konstans ma a `generateTurnData`-n belül él – emeljük ki modulszintre,
hogy mindkét helyről elérhető legyen (ne duplikáljuk).

A kör-kezdés naplóüzenetébe kerüljön be a jelzés:
`const scrambled = game.forceNextTaskType ? ' · 📡 kommunikációs zavar' : '';`

### A5.6 `js/views/host-setup.js` – beállítás-szöveg

A 94. sor felsorolja a négy anomáliát. Új szöveg:

```
Minden <span id="anomaly-every-inline">5</span>. mező űranomália
(féreglyuk, szupernóva, fekete lyuk, roncsmező, hintamanőver, vontatósugár,
meteorraj, kommunikációs zavar, nyílt frekvencia).
```

### A5.7 `js/views/projector.js` – animációk

**Külön szekció, mert kötelező elem:** minden új hatásnak legyen saját animációja a táblán.
Lásd **A6. fejezet**.

### A5.8 Dokumentáció

- `project_memory.md` – az anomália-szekció (§ a `logic/anomaly.js`-ről) frissítése az új
  9 eseményre, és a §7 (board engine / FX) szekció az új animációkkal.
- `README.md` – ahol a négy anomália fel van sorolva.

---

## A6. Animációk – MINDEN hatás látsszon a táblán

### A6.1 Miért kötelező

A kivetítő a játék közös valósága: ha egy hatás csak a modal szövegében létezik, a diákok
nem kötik össze a nevet a következménnyel – pont az a baj marad meg, ami miatt az egész
átalakítás készül. **Szabály: nincs olyan anomália, amelynek ne lenne saját, felismerhető
tábla-animációja.** Két különböző anomália nem nézhet ki ugyanúgy.

Ma három típusnak van FX-e (`wormhole`, `supernova`, `blackhole`), a `comms`-nak overlay-e,
a `_spawnAnomalyFx` `default` ága pedig **mindenre szupernóva-robbanást** tesz – ez aktívan
félrevezető, és a 9 eseményes készletnél már vállalhatatlan.

### A6.2 A meglévő animációs motor (erre építünk, ne írjuk újra)

`js/views/projector.js`:

| Elem | Mit csinál |
|------|------------|
| `_diffAndAnimate(game, boardLength)` | Két snapshot különbségéből indít mozgást + FX-et |
| `_tweenShip(i, cell)` | Hajó átcsúsztatása egy mezőre |
| `_fxSprite(x,y,src,size,animClass,ttl)` | Kép-alapú FX (a `_fxLayer`-re) |
| `_fxRing(x,y,size,color,animClass,ttl)` | CSS-gyűrű FX (`currentColor`) |
| `_fxHit(i)` / `_fxStun(i)` / `_fxBounce(i)` | Magán a hajón futó effekt (rázkódás / kábulat / pattanás) |
| `_fxComms()` | Teljes képernyős zaj-overlay |
| `_fxWormholeTeleport(i, from, to)` | Zsugorodás–megjelenés két mező között |
| `deferredTargets` (a `_diffAndAnimate`-ben) | **Kulcs minta:** a hajó mozgása megvárja az FX-et (torpedónál `setTimeout(moveBack, 380)`) |
| `_reduced` | `prefers-reduced-motion` – ilyenkor azonnali végállapot, nincs rAF |

Sprite-készlet ma: `explosion.png`, `wormhole.png`, `black_hole.png`, `mine.png`, `torpedo.png`.
CSS keyframe-ek az `index.html` `<style>` blokkjában (`fx-explode`, `fx-shockwave`, `fx-wormhole`,
`fx-blackhole`, `fx-ring`, `fx-mine-drop`, `fx-comms`, `proj-hit`, `proj-stun`, `proj-bounce`).

**Az új animációk 90%-a megoldható meglévő sprite-okból + új CSS keyframe-ekből.
Új képfájl nem szükséges.**

### A6.3 Adat-előfeltétel: az `anomalyEvent` payload bővítése

A kivetítő csak azt tudja megrajzolni, amit megkap. A `triggerAnomalyEvent` **minden**
eseménynél írja ki ezeket (ma több helyen hiányoznak):

```js
updates.anomalyEvent = {
  type, name, emoji,
  specificDescription,
  triggeredByTeamIndex: landingTeamIndex,
  focusCell:  <az anomália-mező száma>,        // ÚJ – hol történt (a rálépő pozíciója)
  affected:   affected || null,                 // [{teamIndex, from, to}] – MINDEN mozgató hatásnál kötelező
  boostId:    boostId || null,                  // ÚJ – csak roncsmezőnél (mit talált)
  timestamp:  Date.now(),
};
```

- `affected` ma a `wormhole`-nál **nincs** kitöltve (a teleport külön ágon fut) – töltsük ki
  ott is, konzisztencia miatt (a teleport ág továbbra is elsőbbséget élvez).
- A `blackhole` (kimaradó kör) és a `comms` nem mozgat: náluk `affected: null`, de a
  `focusCell` és a `triggeredByTeamIndex` kell.

### A6.4 Animáció eseményenként

| Anomália | Amit a néző lát a táblán | Technika | Új asset |
|----------|--------------------------|----------|----------|
| 🌀 **Féreglyuk** | **Marad, ahogy van.** Örvény a kiinduló ÉS az érkező mezőn, a hajó zsugorodik az egyiken és kinő a másikon. | meglévő `_fxWormholeTeleport` | nem |
| 💥 **Szupernóva** | Robbanás az anomália-mezőn, majd **kifelé táguló lökéshullám-gyűrű** (a ±2 mezős hatósugárnak megfelelő méretben). Amint a gyűrű eléri, minden érintett hajó megrázkódik, és **csak utána** csúszik hátra. | `_fxSupernova(cellXY)` + új `_fxShockwave(x, y, radiusPx)`; a gyűrű sugara `2 * layout.step`; hajónként `_fxHit(i)`, a mozgás `setTimeout`-tal késleltetve (a hajó távolságával arányosan, 250–600 ms) | nem |
| ⚫ **Fekete lyuk** | Fekete lyuk sprite a hajó mezőjén; a hajó **beszívódik**: elindul a lyuk felé, közben pörög és zsugorodik, majd visszapattan a helyére. Ezután **kábult** marad (szürkés, billegő), amíg ki nem maradt a köre. | `_fxBlackhole` + új `_fxPullIn(i, x, y)` (rAF, ~900 ms, oda-vissza) + meglévő `_fxStun(i)`; **plusz** tartós `.proj-ship--frozen` osztály, amit a `_renderPlaying` tesz fel, amíg `teams[i].skipNextTurn === true` | nem |
| 📦 **Roncsmező** | Egy konténer villan fel a mezőn (fentről leereszkedik, mint az akna), majd a hajó színében táguló **boost-gyűrű** és egy pattanás. | új generikus `_fxEmoji(x, y, '📦', size, animClass, ttl)` (emoji-t rajzol sprite helyett, `font-size`-zal) + meglévő `_fxBoostPulse` + `_fxBounce` | nem |
| 🌠 **Hintamanőver** | A hátul álló hajó körül **szaggatott, pörgő gyorsulás-gyűrű**, majd a hajó kilő előre, maga után **halványuló csóvát** húzva. | meglévő `_fxWarp` + új `_fxSpeedTrail(i, from, to)` (3–4 halványuló hajó-másolat a pálya mentén) | nem |
| 🧲 **Vontatósugár** | **Fénynyaláb** húzódik az élen álló hajó mezejétől a lemaradóig, felvillan, és a lemaradó a nyaláb mentén csúszik előre. | új `_fxBeam(from, to, color, ttl)`: elforgatott gradiens-div a két pont között (a `_fxTorpedo` szög-számítása újrahasznosítható), a mozgás a nyaláb megjelenése után 350 ms-mal | nem |
| ☄️ **Meteorraj** | 2–3 meteor zuhan be **a képernyő tetejéről** ferdén az élen álló hajó mezejére, csóvával; becsapódáskor robbanás + a hajó rázkódik, majd hátralép. | új `_fxMeteorStrike(x, y, count)`: `_fxSprite` a `mine.png`-vel vagy `_fxEmoji('☄️')`, CSS `fx-meteor-fall` keyframe (translate + rotate), landoláskor `_fxExplosion` + `_fxHit` | nem |
| 📡 **Komm. zavar** | **Zöldes** statikus zaj-overlay az egész táblán (rövid, „szétesik a kép” érzés), és a következő kör feladat-címkéje (mutogatás) kétszer felvillan. | `_fxComms(variant)` paraméterezése: `'scramble'` = zöld, `'open'` = piros; + a host/kivetítő feladattípus-címkéjén egy `.proj-label-flash` osztály | nem |
| 🔓 **Nyílt frekvencia** | **Piros** zaj-overlay (a mai), és **minden hajó** körül egyszerre tágul egy gyűrű – látszik, hogy most bárki hallja az adást. | `_fxComms('open')` + ciklus minden csapatra `_fxWarp(shipXY(i), TEAM_COLORS[i])` 80 ms-os lépcsőzéssel | nem |

### A6.5 `_spawnAnomalyFx` – az új switch váza

```js
function _spawnAnomalyFx(ev, game, bl) {
  if (!_layout || !_fxLayer || !ev) return;
  const teams = game.teams || [];
  const ti    = ev.triggeredByTeamIndex;
  const cell  = (ev.focusCell != null)
    ? _clampCell(ev.focusCell, bl)
    : ((ti != null && teams[ti]) ? _clampCell(teams[ti].score, bl) : Math.floor(bl / 2));
  const p        = _cellXY(cell);
  const affected = Array.isArray(ev.affected) ? ev.affected : [];

  switch (ev.type) {
    case 'supernova':   _fxSupernovaBlast(p, affected, bl);            break;
    case 'blackhole':   _fxBlackhole(p.x, p.y); _fxPullIn(ti, p); _fxStun(ti); break;
    case 'salvage':     _fxSalvage(p, ti);                             break;
    case 'slingshot':   _fxSlingshot(affected, bl);                    break;
    case 'tractorbeam': _fxTractorBeam(affected, game, bl);            break;
    case 'meteor':      _fxMeteorRain(affected, bl);                   break;
    case 'comms':       _fxComms('scramble');                          break;
    case 'openfreq':    _fxComms('open'); _fxOpenFreqRings(teams);     break;
    // 'wormhole' → a _fxWormholeTeleport intézi, ide nem jut el
    default:
      console.warn('[projector] Nincs animáció ehhez az anomáliához:', ev.type);
      _fxSupernova(p.x, p.y);   // vészkerék, hogy azért történjen valami
  }
}
```

> A `default` ág **ne** legyen néma: a `console.warn` az, ami elárulja, ha egy később
> hozzáadott anomáliához elfelejtettünk animációt írni.

### A6.6 Sorrend-szabály: előbb az FX, utána a mozgás

Ma a hajók azonnal elcsúsznak a `_diffAndAnimate` 1. lépésében, és az FX csak utána indul
(kivéve a torpedót, ahol a `deferredTargets` halmaz halasztja a mozgást). **Az anomáliáknál
ugyanez kell**, különben a hajó már hátra is lépett, mire a robbanás megjelenik.

Teendő a `_diffAndAnimate`-ben:

```js
// A torpedó-defer mellé: az új anomália által mozgatott csapatok is halasztva mozognak
const newAnomaly = (ev && ev.timestamp && ev.timestamp > _anomalyCursor) ? ev : null;
if (newAnomaly && Array.isArray(newAnomaly.affected)) {
  newAnomaly.affected.forEach(a => { if (a && a.teamIndex != null) deferredTargets.add(a.teamIndex); });
}
```

…és minden új FX-függvény a saját animációja megfelelő pillanatában hívja a
`_tweenShip(teamIndex, toCell)`-t. Ajánlott késleltetések:

| Hatás | Késleltetés a mozgás előtt |
|-------|----------------------------|
| Szupernóva | 250–600 ms (a lökéshullám érkezésével arányosan) |
| Meteorraj | 700 ms (a becsapódás pillanata) |
| Vontatósugár | 350 ms (miután a nyaláb kirajzolódott) |
| Hintamanőver | 300 ms (a gyorsulás-gyűrű után) |
| Fekete lyuk / Roncsmező / Komm. zavar / Nyílt frekvencia | nincs mozgás |

### A6.7 Új CSS – az `index.html` `<style>` blokkjába

A meglévő `fx-*` osztályok mellé (mind rövid, GPU-barát `transform`/`opacity` animáció):

```css
@keyframes fx-beam      { 0% { opacity: 0; transform: scaleX(0); } 25% { opacity: 1; } 100% { opacity: 0; transform: scaleX(1); } }
@keyframes fx-meteor    { 0% { transform: translate(-60px,-160px) rotate(35deg) scale(.5); opacity: 0; }
                          20% { opacity: 1; } 100% { transform: translate(0,0) rotate(35deg) scale(1); opacity: 1; } }
@keyframes fx-emoji-pop { 0% { transform: translateY(-40px) scale(.4); opacity: 0; } 45% { opacity: 1; }
                          70% { transform: translateY(0) scale(1.15); } 100% { transform: translateY(0) scale(1); opacity: 0; } }
@keyframes fx-trail     { 0% { opacity: .55; } 100% { opacity: 0; } }

.fx-beam   { transform-origin: left center; background: linear-gradient(90deg,
             rgba(0,212,255,0), currentColor, rgba(0,212,255,0)); box-shadow: 0 0 18px currentColor;
             animation: fx-beam 1.1s ease-out forwards; }
.fx-meteor { animation: fx-meteor .75s cubic-bezier(.4,0,.9,.5) forwards;
             filter: drop-shadow(-14px -14px 12px #ff9a3c); }
.fx-emoji  { display: flex; align-items: center; justify-content: center; line-height: 1;
             animation: fx-emoji-pop 1.4s cubic-bezier(.3,1.3,.6,1) forwards; }
.fx-trail  { animation: fx-trail .6s linear forwards; }

/* Tartós állapot: a fekete lyukban ragadt flotta a kimaradó köréig */
.proj-ship--frozen { filter: grayscale(.8) brightness(.75) drop-shadow(0 0 10px #7a3cff); }

/* Komm.-zavar overlay színvariáns */
.proj-fx-comms.is-scramble { filter: hue-rotate(115deg); }
```

A `prefers-reduced-motion` blokkba (`.proj-fx { animation-duration: .4s !important; }` mellé)
nem kell új sor – de **minden új helper elején** legyen `if (_reduced) { <végállapot azonnal>; return; }`.

### A6.8 Korlátok, amikre figyelni kell

- **Az anomália-modal megvárja a mozgást.** A `_syncAnomalyModal()` / `_anyShipAnimating()`
  logika miatt egyetlen FX se tartson **2,6 másodpercnél tovább**, különben a felugró ablak
  érezhetően késik. A meteorraj 2–3 meteorja **egyszerre** hulljon, ne egymás után.
- **Egyszerre max 4–5 sprite** a `_fxLayer`-en; a `_fxSprite` TTL-je mindig legyen megadva
  (a takarítás `animationend` + `setTimeout` páron múlik).
- **Egy körben több anomália is elsülhet** (megosztott pontnál több csapat is anomália-mezőre
  léphet). A hatások sorosítva futnak (a `for` ciklus `await`-el), tehát az FX-ek sem
  torlódnak – ezt a viselkedést meg kell tartani.
- **A tábla átméretezésekor** (`_boardResizeObs`) a futó FX-ek pozíciója elavul. A meglévő
  megoldás az, hogy rövid a TTL – új, hosszabb effektet ne vezessünk be.

---

# B RÉSZ – A bevezető (briefing) képernyő eltávolítása

## B1. Cél

A `lobby` → `briefing` → `playing` folyamatból legyen **`lobby` → `playing`**.
A tanár mondja el élőszóban a bevezetőt; a „Küldetés indítása” gomb a lobbyban
azonnal az első körre visz.

## B2. Fájlonkénti teendők

### 1) `js/views/lobby.js` (197. sor)

```diff
- updates['status']       = 'briefing';
+ updates['status']       = 'playing';
```

Egyéb változás itt nem kell: a lobby gombja már ma is ellenőrzi, hogy van-e legalább
1 játékos és (kézi módban) mindenki flottában van-e – ez ugyanaz a kapu, ami eddig
a briefing „Első kör indítása” gombján volt.

### 2) `js/app.js` (166. és 189. sor)

Mindkét routerből (host + játékos) törlendő:

```diff
-        case 'briefing':
-          showView('view-host-game');
-          renderHostGame(game, state);
-          break;
```
(és a játékos ágon ugyanez a `view-player-game`-mel).

A `case 'playing'` ág marad, az kezel mindent.

### 3) `js/views/host-game.js` (35–150. sor)

Törlendő a teljes `if (game.status === 'briefing') { ... }` blokk, benne:
- a briefing hologram HTML-je,
- az „Irányítóközpont Státusz” panel,
- a `#btn-launch-game` gomb és a `click` handlere (`updateGameData(..., { status: 'playing' })`),
- a hozzá tartozó `wireLeaveBar()` hívás **csak ezen az ágon** (a `playing` ágnak saját van).

### 4) `js/views/player-game.js` (44–110. sor környéke)

Törlendő a teljes `if (game.status === 'briefing') { ... }` blokk
(hologram + „Várakozás az Irányítóközpont parancsára…”).

### 5) `js/views/projector.js`

```diff
- if (game.status === 'briefing') { _resetStage(); _renderBriefing(el, game);  return; }
```
és törlendő maga a `_renderBriefing()` függvény (kb. 108–175. sor).

### 6) `css/style.css` (kb. 227–495. sor)

A `MISSION BRIEFING – HOLOGRAPHIC OVERLAY` szekció teljes egésze törölhető:
`.briefing-overlay`, `.briefing-hologram`, `.briefing-scanlines`, `.briefing-content`,
`.briefing-header-lines`, `.briefing-line`, `.briefing-title`, `.briefing-text`,
`.briefing-closing`, `.briefing-rules*`, `.briefing-rule*`, `.briefing-footer`,
`.briefing-waiting`, `.briefing-projector` felülírások, a `briefing-fade-in` keyframe,
valamint a mobil `@media` blokk briefing-sorai.

> **Ellenőrzés törlés előtt:** `grep -rn "briefing" js/ index.html` – a törlés után
> nulla találat kell hogy legyen (a `.md` dokumentációkat leszámítva).
> A `.briefing-hologram` szerepel a `project_memory.md` „nem használnak backdrop-filtert”
> felsorolásában is – azt is javítani kell.

### 7) `js/firebase-config.js` – késve érkező játékos automatikus beosztása

A `joinGame()` ma minden belépőt `teamIndex: -1`-gyel hoz létre. A briefing megszűnésével
a már **futó** játékba belépő diák így soha nem kapna kört. Javítás: ha a játék
`status !== 'lobby'`, a belépő azonnal a legkisebb létszámú flottába kerül.

```js
const players = game.players ? Object.values(game.players) : [];
let teamIndex = -1;

if (game.status !== 'lobby') {
  // Futó játék: a legkisebb létszámú flottába soroljuk (holtverseny esetén a kisebb index)
  const teamCount = (game.teams || []).length;
  if (teamCount > 0) {
    const counts = Array(teamCount).fill(0);
    players.forEach(p => { if (p.teamIndex >= 0 && p.teamIndex < teamCount) counts[p.teamIndex]++; });
    teamIndex = counts.indexOf(Math.min(...counts));
  }
} else if (game.settings?.assignmentType === 'random') {
  teamIndex = -1;   // marad: a lobby indításakor osztja szét a _handleStartGame
}

await set(newRef, { name: trimmedName, teamIndex, turnCount: 0 });
```

Kiegészítések:

- A `turnCount` legyen a flotta jelenlegi **maximuma**, ne 0 – különben az újonnan
  érkező azonnal soron kívül elé ugrik mindenkinek a `selectNextPlayer()` sorában:
  `turnCount: Math.max(0, ...players.filter(p => p.teamIndex === teamIndex).map(p => p.turnCount || 0))`
- A belépés kerüljön a naplóba (`appendBoostLog`):
  `👤 {név} asztronauta csatlakozott a {flotta} flottához`
- **Kézi (manual) beosztásnál** is ez fusson futó játékban – ott sincs már UI a besorolásra.

### 8) Dokumentáció

- `project_memory.md`: 44., 69., 86., 97., 109., 124., 161–163. sorok – a `briefing`
  státusz és a `.briefing-*` osztályok kivezetése; a státusz-lánc `'lobby' → 'playing' → 'finished'`.
- `README.md`: 119. és 133. sor – a „briefing hologram” említések törlése.
- `docs/UI-SPEC.md`: 11., 28., 57., 88., 117. sor – a mission-briefing képernyő kivezetése
  (a spec történeti dokumentum, ide elég egy „(eltávolítva 2026-09)” megjegyzés).

## B3. Amire figyelni kell (kockázat)

- **Késve érkező játékosok:** eddig a briefing egy „türelmi ablak” volt, amíg a tanár
  felolvasta a szöveget – aki addig lépett be, még bekerült a flottákba. Ez most eltűnik,
  ezért **kötelező** a B2/8. pont (automatikus beosztás futó játékban).
- **Futó játékok:** ha egy már elindított (régi) játék `status: 'briefing'` állapotban ragadt
  a Firebase-ben, a routerek `default` ága a lobbyra dob. Ez elfogadható; a játékok
  amúgy is rövid életűek.

---

# C – Tesztelési lista (kézzel, két böngészőben)

## Briefing
- [ ] Host indít egy játékot, 2 flotta, 2 telefon csatlakozik → a „Küldetés indítása” gombra
      azonnal az első kör képernyője jön be (host, játékos és kivetítő nézetben is).
- [ ] Nincs villanás/üres képernyő az átmenetnél.
- [ ] `grep -rn "briefing" js/ css/ index.html` → 0 találat.
- [ ] **Késve érkező:** már futó játékba belép egy új diák → azonnal a legkisebb flottába
      kerül, megjelenik a kivetítőn, és sorra kerül (de nem azonnal, hanem a sor végén).

## Anomáliák (a legegyszerűbb teszthez `anomalyEvery = 2`, `boardLength = 12`)
- [ ] **Féreglyuk:** kétlépéses modal (Sorsolás → Hatás) továbbra is működik.
- [ ] **Szupernóva:** két egymáshoz közeli flotta esetén mindkettő hátralép; a kivetítőn
      a hajók hátrafelé animálnak; 0-n álló flotta nem megy mínuszba.
- [ ] **Fekete lyuk:** a rálépő flotta a következő körben ténylegesen kimarad,
      és a naplóban látszik.
- [ ] **Roncsmező:** a modal OK gombja **előtt** még nincs boost az inventoryban, utána van;
      a boost-chip megjelenik a játékos képernyőjén.
- [ ] **Hintamanőver / Vontatósugár:** az utolsó flotta előrelép; a leíró szöveg és a
      tényleges pozíció megegyezik (a pálya végén levágott értéknél is!).
- [ ] **Kommunikációs zavar:** a következő kör feladattípusa mutogatás, a pontérték
      a mutogatás-tartományból (4–6) jön.
- [ ] **Nyílt frekvencia:** a következő kör azonnal pirosban indul, más flotta is szerezhet
      pontot, és **nem** jár boost az első 30 másodpercben (A5.4/3 bugfix).
- [ ] **Meteorraj:** az élen álló flotta hátralép 2-t; ha többen holtversenyben vezetnek,
      mindegyik hátralép.
- [ ] Ugyanaz az anomália nem jön kétszer egymás után (`lastAnomalyId`).

## Animációk (kivetítőn, mind a 9-re külön)
- [ ] **Mind a 9 anomáliának más az animációja** – kettő sem néz ki ugyanúgy.
- [ ] Minden esetben **előbb az effekt, utána mozdul a hajó** (nem fordítva).
- [ ] A böngésző konzolján nincs `[projector] Nincs animáció ehhez az anomáliához` üzenet.
- [ ] Az anomália-felugró ablak a mozgás után jelenik meg, nem késik 2,5 mp-nél többet.
- [ ] Windows „Animációk csökkentése” (`prefers-reduced-motion`) mellett is helyes
      végállapot marad, nem akad be hajó félúton.
- [ ] Fekete lyuknál a hajó a kimaradó köréig szürke/kábult marad, utána visszaáll.
- [ ] Ha egy anomália hatására egy flotta eléri a pálya végét, a játék `finished` lesz.

---

# D – Összefoglaló: érintett fájlok

| Fájl | A rész (anomália) | B rész (briefing) |
|------|-------------------|-------------------|
| `js/logic/anomaly.js` | **Nagy átírás** – események, súlyok, hatások | – |
| `js/logic/scoring.js` | Illesztés + 1 bugfix | – |
| `js/logic/turn-manager.js` | `forceNextTaskType`, `POINTS_BY_TYPE` kiemelése | – |
| `js/views/host-setup.js` | Beállítás-szöveg | – |
| `js/views/projector.js` | **Nagy:** 9 animáció + defer-logika (A6) | `_renderBriefing` törlése |
| `js/views/lobby.js` | – | `status = 'playing'` |
| `js/app.js` | – | 2 db `case 'briefing'` törlése |
| `js/views/host-game.js` | – | briefing blokk törlése |
| `js/views/player-game.js` | – | briefing blokk törlése |
| `index.html` (`<style>` blokk) | **ÚJ:** `fx-beam`, `fx-meteor`, `fx-emoji-pop`, `fx-trail`, `.proj-ship--frozen` | – |
| `css/style.css` | Opcionális (`.anomaly-modal-note`) | `.briefing-*` szekció törlése |
| `js/firebase-config.js` | – | **ÚJ:** késve érkező auto-beosztása |
| `project_memory.md`, `README.md`, `docs/UI-SPEC.md` | frissítés | frissítés |
