# RMG Astro-Activity – Multiplayer Osztálytermi Játék

Böngészőben futó, valós idejű, többjátékos **Activity-stílusú** oktatási játék, **űr / sci-fi ("Astro") témájú** dizájnnal (holografikus HUD, csillagtérkép-tábla). Csapatverseny, ahol a játékosok magyaráznak, rajzolnak vagy mutogatnak – a cél az ismeretek játékos formában való ismétlése.

> 🛠 Fejlesztői/architektúra dokumentáció: lásd [`project_memory.md`](project_memory.md). A nézetek felülettervei: [`docs/UI-SPEC.md`](docs/UI-SPEC.md).

---

## A játék célja

Csapatban kell szavakat/fogalmakat kitaláltatni a többiekkel. Az a csapat nyer, amelyik elsőként ér a tábla végére, azaz elegendő pontot gyűjt össze. Az oktatási tartalom (szótár) tetszőlegesen feltölthető – ideális ZH előtti ismétléshez, órai aktivitáshoz.

---

## A játék menete

### Szerepek
| Szerep | Leírás |
|--------|--------|
| **Játékmester (Host)** | Ő indítja el a játékot, látja a titkos szót, méri az időt és ítéli meg a pontokat. |
| **Játékos (Player)** | Mobiltelefonon csatlakozik a szoba kódjával. Az éppen aktív játékos látja a titkos szót. A telefon háttérszíne a saját csapat színét mutatja. |
| **Kivetítő (Projector)** | Külön böngészőablak/tab, amit a projektoron mutat a tanár. **Soha nem mutatja a titkos szót.** |

### Játékos státuszok
| Státusz | Leírás |
|---------|--------|
| 🎭 **Soron vagy!** | Te magyarázol/rajzolsz/mutogatsz ebben a körben. |
| 🔍 **Kitaláló** | A csapattársad van soron – neked kell kitalálni. |
| 👀 **Néző** | Más csapat köre – figyelsz. |

### Egy kör folyamata
1. A Játékmester látja a titkos szót és a feladattípust (magyarázás / rajzolás / mutogatás).
2. A **▶ Idő indítása** gombra kattintva indul a 90 másodperces visszaszámláló.
3. A visszaszámláló 3 fázisra osztja az időt: 🟢 0–30s · 🟡 30–60s · 🔴 60–90s
4. Az idő bármikor **⏸ szüneteltethető** és folytatható – pontozás és reset csak szünet alatt érhető el.
5. A szót kitaláló csapatra kattint a Játékmester a pontozó gombokkal.
6. Ha több csapat is kitalálta: **🤝 Osztott pontozás** – a pont egyenlően (lefelé kerekítve) osztódik el.
7. Ha senki sem találja ki: **❌ Senki sem találta ki** gomb.
8. A következő csapat következő játékosa kap szót, a kör megismétlődik.
9. Az a csapat nyer, amelyik eléri a beállított haladási tábla végét.

### Különleges szabályok
- **Lopott pont**: Más csapat is szerezhet pontot, ha a saját csapat helyett ők találják ki.
- **Osztott pont**: Egyszerre több csapatnak is adható pont – `🤝 Osztott pontozás könyvelése`.
- **Újra húzás**: A Játékmester az idő elindítása előtt újrahúzhatja a szót (`🔀 Feladvány újrasorsolása`).
- **Másik asztronauta**: felfedés előtt a Játékmester átadhatja a kört a flotta egy másik
  tagjának (ha valaki épp nem szeretne sorra kerülni).
- **Fejlesztések (boostok)**: torpedó, gravitációs csapda, hiperhajtómű, időtágulás, pajzs.
  A boostok rövid leírása a vezérlőpulton és a játékos telefonján is megjelenik (egérrávitel
  vagy koppintás).
- **Űranomáliák**: minden N. mezőn (a sűrűség a beállításoknál állítható, alapért. 5) – szupernóva, féreglyuk, fekete lyuk, kommunikációs zavar.

### Animált kivetítő-tábla
A kivetítő egy élő **csillagtérkép**: a flották **színes űrhajóként** repülnek a bolygók
(START = Föld, CÉL = űrállomás) között, mező-mezőre, a haladási irányba fordulva. Minden
fontos esemény saját **animációt** kap – mozgás, fejlesztés-szerzés és -használat (torpedó +
robbanás, csapda, pajzs, hiperhajtómű, időtágulás), valamint az anomáliák (szupernóva-lökés,
féreglyuk-teleport, fekete lyuk). A jobb oldali **Eseménynapló** az egész játékmenetet
rögzíti (ki van soron, sikerült-e, minden mozgás és hatás), így a meccs visszakövethető.

### Csatlakozás és kilépés
- **Csatlakozás**: a főmenü **„Csatlakozás kóddal"** gombja külön oldalra visz (kód + név).
- **Kilépés**: minden játék közbeni nézet fejlécében van **kilépés** gomb. A játékos kilép a
  játékból; a Játékmester **befejezi és törli** a küldetést (mindenki visszakerül a főmenübe).
  Újratöltéskor a böngésző automatikusan visszacsatlakozik a futó játékhoz (a kilépés gomb
  törli ezt).

---

## Elindítás

### Előfeltételek
- Modern böngésző (Chrome, Firefox, Edge)
- **HTTP szerver** szükséges (`file://` protokollon Firebase nem működik)
  - Ajánlott: VS Code **Live Server** bővítmény

### Lépések

1. **Firebase szabályok beállítása** (fejlesztői/tesztelési mód):
   - Firebase Console → Realtime Database → Rules:
   ```json
   {
     "rules": {
       ".read": true,
       ".write": true
     }
   }
   ```

2. **Szótár feltöltése** – `js/data/topics.js`:
   ```js
   export const topics = {
     "Táblázatkezelés": ["Excel", "Cella", "Képlet", "Szűrő", ...],
     "Programozás":     ["Változó", "Ciklus", "Függvény", "Tömb", ...],
   };
   ```

3. **Indítás**:
   - Nyisd meg az `index.html`-t HTTP szerveren (pl. Live Server → `Go Live`)
   - **Játékmester**: "Új küldetés" → beállítások → lobby kód megosztása
   - **Játékosok**: megnyitják ugyanazt az URL-t, „Csatlakozás kóddal" → kód és név
   - **Kivetítő**: a Host vezérlőpult **„🌌 Kivetítő"** gombja új ablakban nyitja meg (animált csillagtérkép-tábla űrhajókkal/bolygókkal, pontszámok, időzítő, eseménynapló – a titkos szót **soha** nem mutatja)

### GitHub Pages (opcionális)
A projekt statikus, közvetlenül hosztolható GitHub Pages-en:
```
https://<felhasználónév>.github.io/<repo-neve>/
```

---

## Technológiák

| Technológia | Szerepe |
|-------------|---------|
| **HTML5** | Single-page alkalmazás – egyetlen `index.html`, 8 nézet-konténerrel |
| **Tailwind CSS (Play CDN)** | A nézetek dizájnja; Material-Design-3 színpaletta (inline `tailwind.config`) |
| **Material Symbols + Exo 2** | Ikonok és megjelenítő betűtípus (Google Fonts) |
| **CSS3 (`css/style.css` + `index.html`)** | Amit a Tailwind nem fed le: téma-változók, splash, toast, briefing hologram, anomália-ablak, boost-chipek és -leírás buborékok; a csillagtérkép-tábla, az űrhajók és az animációs FX stílusai az `index.html` `<style>` blokkjában |
| **WebGL** | Globális, animált csillagmező háttér (`index.html`) |
| **Vanilla JavaScript (ES6 modules)** | Teljes frontend logika, nézetek, állapotkezelés – keretrendszer nélkül |
| **Firebase Realtime Database (SDK 10.12.2)** | Valós idejű adatszinkronizáció (CDN-ről, `import`-tal) |

---

## Fájlszerkezet

```
activity/
├── index.html                  # SPA – Tailwind + config + dizájn-CSS + csillagmező + 8 nézet-div
├── project_memory.md           # Fejlesztői referencia (architektúra, adatmodell, gotchák)
├── css/
│   └── style.css               # Amit a Tailwind nem fed le (téma-vars, splash, toast, briefing, anomália, boost-chip)
├── docs/
│   └── UI-SPEC.md              # Nézetenkénti felületterv (designer brief)
├── img/                        # Logók, bolygók, hajók, ikonok
└── js/
    ├── app.js                  # Belépési pont – állapot, útvonalkezelés, Firebase figyelő, kilépés-logika
    ├── firebase-config.js      # Firebase inicializálás + DB segédfüggvények (egyetlen adatréteg)
    ├── data/
    │   └── topics.js           # Szótár – témakörök és szavak (feltöltendő!)
    ├── logic/
    │   ├── turn-manager.js     # Kör generálás, szóhúzás, következő játékos kiválasztás
    │   ├── timer.js            # Fázisszámítás, szünet-támogatás (timerElapsedMs), időformázás
    │   ├── scoring.js          # Pontozás, lopott/osztott pont, győzelem, következő kör
    │   ├── boosts.js           # Fejlesztések (torpedó, csapda, hiperhajtómű, időtágulás, pajzs)
    │   └── anomaly.js          # Űranomáliák (szupernóva, féreglyuk, fekete lyuk, kommunikációs zavar)
    └── views/
        ├── landing.js          # Főmenü
        ├── join.js             # Csatlakozás kóddal (dedikált oldal)
        ├── host-setup.js       # Játékbeállítások (flották, témák, tábla hossza, anomália-sűrűség)
        ├── lobby.js            # Váróterem (kód, csapatbeosztás) – Host + Játékos
        ├── host-game.js        # Host vezérlőpult (titkos szó, időzítő, pontozás)
        ├── projector.js        # Kivetítő (publikus csillagtérkép, szó nélkül)
        ├── player-game.js      # Játékos telefonos nézet
        └── winner.js           # Győztes képernyő
```
