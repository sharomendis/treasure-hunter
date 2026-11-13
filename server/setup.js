// =============================================================
// setup.js  —  One-time Firebase setup for the score server:   npm run setup
//   1. creates .env from .env.example
//   2. finds the service-account key (opens the Firebase page and waits for the download)
//      and moves it to server/serviceAccountKey.json
//   3. checks the server can reach Firestore
//   4. publishes ../firestore.rules to Firebase
// Safe to run again at any time.
// =============================================================
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { exec } from "node:child_process";
import { fileURLToPath } from "node:url";
import admin from "firebase-admin";

const PROJECT = "treasure-hunter-cbd8f";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const KEY = path.join(HERE, "serviceAccountKey.json");
const ENV = path.join(HERE, ".env");
const DOWNLOADS = path.join(os.homedir(), "Downloads");
const KEY_PAGE = `https://console.firebase.google.com/project/${PROJECT}/settings/serviceaccounts/adminsdk`;

const step = (n, msg) => console.log(`\n[${n}/4] ${msg}`);
const sleep = ms => new Promise(r => setTimeout(r, ms));

function isKey(file) {
  try {
    const j = JSON.parse(fs.readFileSync(file, "utf8"));
    return j.type === "service_account" && j.project_id === PROJECT && !!j.private_key;
  } catch { return false; }
}

/** Newest "<project>-firebase-adminsdk-*.json" in Downloads that is a valid key, or null. */
function findDownloadedKey(since = 0) {
  if (!fs.existsSync(DOWNLOADS)) return null;
  return fs.readdirSync(DOWNLOADS)
    .filter(f => f.startsWith(PROJECT) && f.includes("firebase-adminsdk") && f.endsWith(".json"))
    .map(f => path.join(DOWNLOADS, f))
    .filter(f => fs.statSync(f).mtimeMs >= since && isKey(f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] || null;
}

function openBrowser(url) {
  const cmd = process.platform === "win32" ? `start "" "${url}"` : process.platform === "darwin" ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd);
}

/** Move the key out of Downloads so it isn't left lying around. */
function moveKey(from) {
  try { fs.renameSync(from, KEY); }
  catch { fs.copyFileSync(from, KEY); fs.unlinkSync(from); }
}

async function getKey() {
  if (isKey(KEY)) return console.log("    ✔ serviceAccountKey.json already in place");
  const existing = findDownloadedKey();
  if (existing) { moveKey(existing); return console.log(`    ✔ Found ${path.basename(existing)} in Downloads — moved it here`); }

  console.log("    Opening the Firebase console in your browser…");
  console.log("    → click  \"Generate new private key\"  →  \"Generate key\"  (save it to Downloads)");
  console.log(`    (If the page doesn't open: ${KEY_PAGE})`);
  openBrowser(KEY_PAGE);
  const start = Date.now() - 5000;
  for (let i = 0; i < 300; i++) {                      // wait up to 10 minutes
    await sleep(2000);
    const f = findDownloadedKey(start);
    if (f) { await sleep(500); moveKey(f); return console.log(`    ✔ Got ${path.basename(f)} — moved it to server/serviceAccountKey.json`); }
    if (i % 15 === 14) console.log("    …still waiting for the key download");
  }
  throw new Error("No key downloaded. Run  npm run setup  again when ready.");
}

try {
  step(1, "Creating .env");
  if (fs.existsSync(ENV)) console.log("    ✔ .env already exists");
  else { fs.copyFileSync(path.join(HERE, ".env.example"), ENV); console.log("    ✔ Created .env"); }

  step(2, "Getting the Firebase service-account key");
  await getKey();

  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, "utf8"))), projectId: PROJECT });

  step(3, "Testing the Firestore connection");
  const snap = await admin.firestore().collection("scores").limit(1).get();
  console.log(`    ✔ Connected to Firestore (${snap.empty ? "no scores yet" : "scores found"})`);

  step(4, "Publishing firestore.rules");
  try {
    const rules = fs.readFileSync(path.join(HERE, "..", "firestore.rules"), "utf8");
    await admin.securityRules().releaseFirestoreRulesetFromSource(rules);
    console.log("    ✔ Rules published");
  } catch (e) {
    console.log(`    ⚠ Could not publish rules (${e.message}). Paste firestore.rules into Firebase console → Firestore → Rules.`);
  }

  console.log("\n✅ All set! Start the server with:  npm start   then open  http://localhost:3000\n");
  process.exit(0);
} catch (e) {
  console.error(`\n❌ ${e.message}\n`);
  process.exit(1);
}
