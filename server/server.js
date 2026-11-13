// =============================================================
// server.js  —  Run the same API on your own PC:  npm start  ->  http://localhost:3000
// (Normally you don't need this: `firebase deploy` runs the API as a Cloud Function.)
// Needs credentials: GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccountKey.json in .env,
// or FIREBASE_SERVICE_ACCOUNT={...json...}.
// Also serves the game itself, so the page and API share one address.
// =============================================================
import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import admin from "firebase-admin";
import { createApp, errorHandler } from "./app.js";

const PORT = Number(process.env.PORT) || 3000;
const GAME_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if (!process.env.FIREBASE_SERVICE_ACCOUNT && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.warn("⚠ No Firebase credentials: copy .env.example to .env and add serviceAccountKey.json.");
}
admin.initializeApp({
  credential: process.env.FIREBASE_SERVICE_ACCOUNT
    ? admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
    : admin.credential.applicationDefault(),
  projectId: process.env.FIREBASE_PROJECT_ID || "treasure-hunter-cbd8f"
});

const app = createApp(admin);
app.use("/server", (_req, res) => res.sendStatus(404));            // never serve the server's own files
app.use(express.static(GAME_DIR, { dotfiles: "ignore" }));
app.use(errorHandler);

app.listen(PORT, () => console.log(`Treasure Hunter running at http://localhost:${PORT}`));
