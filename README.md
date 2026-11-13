# Treasure Hunter 🏃‍♂️🔥🧟💎

A phone-first 3-lane runner made with **plain HTML, CSS and JavaScript**, using **Firebase** as the backend
and the **university Fish API** (https://marcconrad.com/uob/fish) to give the hunter a second life.

---

## 1. The game

| Level | Obstacles | How to survive | Goal |
|---|---|---|---|
| 1 – Lava Pits | lava pits (1, 2 or all 3 lanes) | swipe ← → to change lane, swipe ↑ to jump | Treasure chest |
| 2 – Zombie Wasteland | zombies (single or pairs) | swipe ← → to dodge, press **HIT** when two come | Treasure chest |
| 3 – Lava & Zombies | both | all of the above | **Grand diamond treasure** |

* Reach the treasure **before the sun sets** (timer with a sinking sun at the top).
* Collect glowing gold coins. The run speeds up over time.
* Fall into lava or get caught by a zombie → "Ohhh nooo!" → the **Fish API** appears.
  Count the fish correctly = you get your life back. Wrong = you lose a heart (3 hearts). No hearts = game over.
* Winning level 1 unlocks level 2, winning level 2 unlocks level 3.
* **Top 3 leaderboard per level** (each player's best run): treasure finders first — fewest lives lost,
  then fastest time, then most coins — then players still hunting, by score.
* Results screen shows: score, coins, time, obstacles passed, lava pits jumped, zombies dodged / hit,
  lives lost and Fish API wins.

**Controls** — Phone: swipe left / right / up, swipe down or the HIT button to strike.
Desktop: arrow keys (or A / D / W), Space or ↓ = HIT.

---

## 2. Files (how the code is structured)

```
treasure-hunter/
├── index.html            Login / sign-up page
├── game.html             Game page: canvas, HUD, map menu, fish popup, win/lose, asset check
├── css/style.css         All styling (golden-hour theme, portrait phone layout)
├── js/
│   ├── firebase-config.js  Your Firebase keys (demo mode until you paste them)
│   ├── auth.js             VIRTUAL IDENTITY – sign up, log in, log out, session
│   ├── db.js               Save runs, unlock levels, top-3 leaderboard (Firestore)
│   ├── fishApi.js          INTEROPERABILITY – calls the Fish API (HTTPS + JSON)
│   ├── eventBus.js         EVENTS – tiny publish/subscribe hub
│   ├── input.js            Swipes / keys / HIT button  → "input:*" events
│   ├── levels.js           Level data (length, sunset time, obstacles) – pure data
│   ├── world.js            Game rules: track, jump, zombie AI, collisions, score
│   ├── renderer.js         Drawing only: pseudo-3D road, sun bloom, lava drops, hunter
│   ├── hud.js              Progress bar, coin counter, sunset timer, hearts
│   ├── audio.js            Music + sound effects, reacting to events
│   ├── login.js            Controller for index.html
│   └── main.js             Controller for game.html (wires everything together)
├── assets/img, assets/sounds   Your asset pack
├── firebase.json, firestore.rules   Hosting + database security rules
```

---

## 3. Run it on your computer (VS Code)

1. Install **VS Code** → https://code.visualstudio.com
2. Unzip `treasure-hunter.zip`, then in VS Code: **File → Open Folder…** → choose `treasure-hunter`.
3. Install the extension **Live Server** (Extensions icon → search "Live Server" → Install).
4. Right-click `index.html` → **Open with Live Server**.
   (The game uses JavaScript modules, so it must run from a server — double-clicking the file will not work.)
5. Sign up with any email/password. Until you add Firebase keys the game runs in **demo mode**
   (accounts and scores saved only in that browser) — good for testing.

### Connect VS Code to Claude (optional)
1. In VS Code open Extensions, search **"Claude Code"** (publisher: Anthropic) → Install.
2. Click the Claude icon in the side bar → sign in with your Claude account.
3. With the `treasure-hunter` folder open you can ask Claude to explain or change any file
   (e.g. "make level 1 longer" → it will edit `js/levels.js`).

---

## 4. Firebase backend (do this once)

1. Go to https://console.firebase.google.com → **Add project** → name it `treasure-hunter` → Create.
2. **Authentication** → Get started → **Sign-in method** → enable **Email/Password**.
   Then **Add new provider** → **Google** → Enable → choose a *project support email* → Save.
   (Google sign-in needs the page opened over `http://localhost` or the hosted `web.app` link, not by double-clicking the file.)
3. **Firestore Database** → Create database → choose a location → *Start in production mode*.
4. Firestore → **Rules** tab → paste the contents of `firestore.rules` → **Publish**.
5. Project settings (⚙) → General → *Your apps* → click **</>** (Web) → register app (no hosting tick needed).
   Copy the `firebaseConfig` values into `js/firebase-config.js`, replacing every `PASTE_...`.
6. Reload the page — accounts are now saved online in Firebase.

Data saved:
* `users/{uid}` → `username, email, unlockedLevel, createdAt`
* `scores/{id}` → `uid, username, level, won, score, coins, deaths, timeSec, fishWins, fishTries, lavaJumped, zombiesDodged, zombiesKilled, obstacles, playedAt`

## 5. Put it online (get a link to play on your phone)

In the VS Code terminal (**Terminal → New Terminal**), inside the project folder:

```bash
npm install -g firebase-tools     # needs Node.js from https://nodejs.org
firebase login
firebase use --add                # pick your treasure-hunter project
firebase deploy                   # uploads the game + firestore rules
```

You get a link like **https://treasure-hunter-xxxx.web.app** — open it on your phone.
Then in Firebase → Authentication → Settings → **Authorized domains**, make sure that domain is listed (it is added automatically).

---

## 6. Assignment questions

### Low Coupling / High Cohesion (Week 2)
* **High cohesion** – every file has one job: `world.js` only rules, `renderer.js` only drawing,
  `audio.js` only sound, `hud.js` only the on-screen numbers, `auth.js` only identity, `db.js` only storage,
  `fishApi.js` only the external API, `levels.js` only data.
* **Low coupling** – modules do not call each other directly; they communicate through the **event bus**.
  Example: `world.js` just emits `"coin"`. It does not know that `audio.js` plays a chime,
  `hud.js` bounces the counter and `renderer.js` shows sparkles. You could delete `audio.js` and the game still runs.
* The game rules never touch the keyboard: `input.js` translates swipes/keys into `input:left`, `input:jump` …
  so adding a new control (e.g. a gamepad) only changes one file.
* Firebase can be swapped for localStorage (demo mode) without changing the game — only `auth.js` / `db.js` know about it.
* Structure: ES **modules** (`import/export`), one **class** (`World`, `Renderer`), plain data objects (`LEVELS`),
  and an external **library** (Firebase SDK, loaded only when configured).

### Event Driven Architecture (Week 3)
* `eventBus.js` implements **publish / subscribe** (`bus.on`, `bus.emit`, `bus.off`).
* **What triggers events:**
  * **GUI** – buttons (level buttons, HIT, mute, retry, next, logout), form `submit` (login, sign-up, fish answer).
  * **Touch / mouse** – `touchstart`/`touchmove` swipes, `pointerdown` on HIT.
  * **Keyboard** – `keydown` (arrow keys, Space).
  * **Timers** – `requestAnimationFrame` game loop (emits `tick`), `setInterval` countdown 3-2-1-GO, `setTimeout` for screens.
  * **Game events** – `jump`, `land`, `coin`, `zombieNear`, `zombieKilled`, `died`, `needRevive`, `revived`, `gameWon`, `gameLost`.
  * **Network / auth** – `fetch` promise resolving (Fish API), Firebase `onAuthStateChanged`, image `onload`.

### Interoperability (Week 4)
* `fishApi.js` calls `https://marcconrad.com/uob/fish/api.php?out=json&base64=no` with **`fetch` over HTTPS (HTTP GET)**.
* **Protocol / format:** the response is **JSON** – `{ "question": "<image url>", "fish": 8, "chest": 4 }`.
  The picture mixes fish and treasure chests; the answer is the `fish` field (count **only the fish**), exactly as in the
  reference client at https://marcconrad.com/uob/fish. The server sends it labelled `text/html`, so it is read with
  `res.text()` and parsed with `JSON.parse`. The function also supports `base64=yes`, where the image arrives as
  **base64** text and is shown as a `data:image/png;base64,...` URL.
* The fish puzzle shown in the game always comes live from the API — there is no built-in/offline fallback image.
* Firebase is a second external service: the Firebase SDK talks to Google's servers over HTTPS / JSON (Firestore) and
  uses JWT ID tokens for authentication.

### Virtual Identity (Week 5)
* **Sign up / log in with email + password** through **Firebase Authentication**. Passwords are never stored by us —
  Firebase stores them hashed and gives the browser a signed **ID token (JWT)**.
* **Session persistence ("Remember me")** – `browserLocalPersistence` (stay logged in) or `browserSessionPersistence`
  (only until the tab closes). This plays the role of a session cookie.
* **Page guard** – `game.html` checks `getCurrentUser()`; if nobody is logged in it redirects to `index.html`.
* **Validation** – password at least 6 chars with a number, confirm-password check, name length.
* **Authorisation** – `firestore.rules`: a player can only read/write their own profile and can only add scores
  with their own `uid`; nobody can edit or delete scores (no cheating).
* **Demo mode** (no Firebase): passwords are **salted and SHA-256 hashed** (Web Crypto API) before being saved
  in localStorage, and the session is kept in localStorage / sessionStorage.
* The player's name and avatar appear in the menu and on the leaderboard (their virtual identity in the game).

### Other interesting features
* Pseudo-3D perspective road on a `<canvas>` with a chase camera (no 3D library needed).
* "Smart" zombies: they look at the hunter's lane and step into it; zombie pairs close the gap you're hiding in,
  so you must use HIT. They decide only once, so it stays fair.
* Golden-hour sky that darkens as time runs out, sun with soft bloom, speed lines at high speed,
  lava drops splashing out of the pit when the hunter falls in, "Ohhh nooo!" bubble + voice.
* Sunset timer icon with a sinking sun, progress bar with a clock tower, win screen where the tower bell rings as the sun sets.
* Level unlocking, per-level top-3 leaderboard, score formula with time bonus.
* **Treasure Vault** (menu → *💰 Vault*, or *Vault* on the win screen): a chest on a stone pedestal bursts open and
  gold coins rain out (more coins the richer you are). Shows total coins across all runs, chests opened,
  grand diamond treasures, Fish API rescues and your best score per level. Drawn on a canvas in `js/vault.js`.
* **Asset check** screen (menu → *Asset check*): confirms every image and sound loads, with ▶ buttons to hear each sound.
* Works on a phone held upright (swipes) and on desktop (arrow keys).

---

## 7. Notes
* **Sounds used**: background_music (running soundtrack), footstep, jump_whoosh (every swipe), coin_collect (chime),
  monster_growl (zombie near), player_groan + spoken "Ohhh nooo!" (caught / fell), revive, victory_bell, game_over,
  countdown_beep, go_beep, button_click.
* Browsers only allow sound after the first tap — the start screen's swipe/tap unlocks it.
* If the Fish API popup says it cannot reach the API, check your internet connection and open
  https://marcconrad.com/uob/fish/api.php in the browser to see if the server is up, then press **Retry**.
* Tune difficulty in `js/levels.js` (length, sunset seconds, speeds, hearts).
