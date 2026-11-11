// =============================================================
// levels.js  —  Pure data. Change numbers here to tune the game.
// =============================================================
export const LEVELS = {
  1: { name: "Lava Pits", sunsetSec: 75, length: 900, lava: true, zombies: false,
       backdrop: "level01sreenlavapits.png", crop: 0.86, ground: "#c96a2b", treasure: "Treasure Chest", treasureScale: 1 },
  2: { name: "Zombie Wasteland", sunsetSec: 85, length: 900, lava: false, zombies: true,
       backdrop: "level02screenzombies.png", crop: 0.85, ground: "#7a6a45", treasure: "Treasure Chest", treasureScale: 1 },
  3: { name: "Lava & Zombies", sunsetSec: 110, length: 1300, lava: true, zombies: true,
       backdrop: "level03screenimagewithboth.jpg", crop: 1, ground: "#8a5a35", treasure: "GRAND Diamond Treasure", treasureScale: 1.6 }
};

export const START_SPEED = 13;   // world units per second
export const MAX_SPEED = 24;
export const SPEED_GAIN = 0.12;  // added every second
export const MAX_HEARTS = 3;     // wrong fish answers allowed before game over
