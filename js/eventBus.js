// =============================================================
// eventBus.js  —  EVENT DRIVEN ARCHITECTURE (Week 3)
// A tiny publish/subscribe hub. Modules never call each other
// directly; they "emit" an event and anyone interested "listens".
//   bus.on("coin", fn)     subscribe
//   bus.emit("coin", data) publish
// =============================================================
const listeners = {};

export const bus = {
  on(name, fn) { (listeners[name] ||= []).push(fn); },
  off(name, fn) { listeners[name] = (listeners[name] || []).filter(f => f !== fn); },
  emit(name, data) { (listeners[name] || []).forEach(fn => fn(data)); }
};

/* Events used in the game
   input:left / input:right / input:jump / input:hit   (from input.js)
   coin, jump, land, lavaJumped, zombieDodged, zombieKilled, zombieNear
   died {cause}, revived, gameWon, gameLost {reason}, tick {state}
*/
