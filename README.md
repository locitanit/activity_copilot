# Activity – Multiplayer Osztálytermi Játék

Böngészőben futó, valós idejű, többjátékos **Activity-stílusú** oktatási játék. Táblákon játszható csapatverseny, ahol a játékosok szóban magyaráznak, rajzolnak vagy mutogatnak – a cél az ismeretek játékos formában való ismétlése.

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
   - **Játékmester**: "Új játék" → beállítások → lobby kód megosztása
   - **Játékosok**: megnyitják ugyanazt az URL-t, beírják a kódot és a nevüket
   - **Kivetítő**: a Host Játék nézetben a "📺 Kivetítő megnyitása" gomb új ablakban nyitja meg

### GitHub Pages (opcionális)
A projekt statikus, közvetlenül hosztolható GitHub Pages-en:
```
https://<felhasználónév>.github.io/<repo-neve>/
```

---

## Technológiák

| Technológia | Szerepe |
|-------------|---------|
| **HTML5** | Single-page alkalmazás – egyetlen `index.html`, 7 nézet-konténerrel |
| **CSS3** | Sötét téma, reszponzív elrendezés, animált haladási tábla (CSS transitions) |
| **Vanilla JavaScript (ES6 modules)** | Teljes frontend logika, nézetek, állapotkezelés – keretrendszer nélkül |
| **Firebase Realtime Database** | Valós idejű adatszinkronizáció a játékosok között (WebSocket alapú) |
| **Firebase SDK 10.12.2** | CDN-ről betöltve, `import`-tal használva |

---

## Fájlszerkezet

```
activity/
├── index.html                  # SPA – 7 nézet-div + modul betöltés
├── css/
│   └── style.css               # Teljes stíluslap (sötét téma, csapatszínek, tábla)
└── js/
    ├── app.js                  # Belépési pont – állapot, útvonalkezelés, Firebase figyelő
    ├── firebase-config.js      # Firebase inicializálás + DB segédfüggvények
    ├── data/
    │   └── topics.js           # Szótár – témakörök és szavak (feltöltendő!)
    ├── logic/
    │   ├── turn-manager.js     # Kör generálás, szóhúzás, következő játékos kiválasztás
    │   ├── timer.js            # Fázisszámítás, szünet-támogatás (timerElapsedMs), időformázás
    │   └── scoring.js          # Pontozás, lopott pont, osztott pont, következő kör indítása
    └── views/
        ├── landing.js          # 1. nézet – Főmenü
        ├── host-setup.js       # 2. nézet – Játékbeállítások (csapatok, témák, tábla)
        ├── lobby.js            # 3. nézet – Váróterem (kód megjelenítés, csapatbeosztás)
        ├── host-game.js        # 4/B nézet – Játékmester vezérlő (titkos szó, pontozás)
        ├── projector.js        # 4/A nézet – Kivetítő (publikus, szó nélkül)
        ├── player-game.js      # 4/C nézet – Játékos telefonos nézet
        └── winner.js           # 5. nézet – Győztes képernyő
```
