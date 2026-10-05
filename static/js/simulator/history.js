// Undo/redo history management for the circuit simulator.
// Each action that modifies the circuit is saved as a snapshot.

export function createHistory() {
  return {
    snapshots: [],
    currentIndex: -1,
  };
}

// Saving the current state to history (removes redo stack).
export function pushSnapshot(history, circuitData) {
  // Remove all snapshots after the current index (redo stack).
  history.snapshots.splice(history.currentIndex + 1);
  
  // Add a new snapshot.
  history.snapshots.push(JSON.parse(JSON.stringify(circuitData)));
  history.currentIndex++;
  
  // Limit history to 50 snapshots to save memory.
  if (history.snapshots.length > 50) {
    history.snapshots.shift();
    history.currentIndex--;
  }
}

// Go back to the previous snapshot (Ctrl+Z).
export function undo(history) {
  if (history.currentIndex > 0) {
    history.currentIndex--;
    return history.snapshots[history.currentIndex];
  }
  return null;
}

// Move forward to the next snapshot (Ctrl+Y).
export function redo(history) {
  if (history.currentIndex < history.snapshots.length - 1) {
    history.currentIndex++;
    return history.snapshots[history.currentIndex];
  }
  return null;
}

// Cek apakah bisa undo.
export function canUndo(history) {
  return history.currentIndex > 0;
}

// Cek apakah bisa redo.
export function canRedo(history) {
  return history.currentIndex < history.snapshots.length - 1;
}
