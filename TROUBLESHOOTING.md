# Troubleshooting Guide: Keyboard Shortcuts

## Checklist Verifikasi Implementasi

### File Structure
```
electrolab-copy/
├── public/js/simulator/
│   ├── history.js              ✅ NEW
│   ├── clipboard.js            ✅ NEW
│   ├── test-modules.js         ✅ NEW (optional)
│   ├── main.js                 ✅ MODIFIED
│   ├── interaction.js          ✅ MODIFIED
│   ├── properties.js           ✅ MODIFIED
│   ├── circuit.js              (unchanged)
│   ├── canvas.js               (unchanged)
│   ├── components.js           (unchanged)
│   ├── palette.js              (unchanged)
│   ├── solver.js               (unchanged)
│   ├── results.js              (unchanged)
│   ├── wiring.js               (unchanged)
│   └── netlist.js              (unchanged)
├── IMPLEMENTATION_SUMMARY.md   ✅ NEW
├── QUICK_REFERENCE.md          ✅ NEW
├── KEYBOARD_SHORTCUTS_IMPLEMENTATION.md ✅ NEW
└── TROUBLESHOOTING.md          ✅ NEW (ini)
```

## Potential Issues & Solutions

### 1. Ctrl+Z/Y/C/X/V/A tidak merespon

**Problem**: Shortcut tidak bekerja saat di-press

**Debugging Steps**:
1. Buka Browser DevTools (F12)
2. Pergi ke Console tab
3. Test shortcuts dan lihat ada error messages

**Possible Causes & Solutions**:

a) **setupInteraction() belum di-call dengan keyboardActions**
   - Check main.js line ~286-301
   - Pastikan setupInteraction() call includes keyboardActions parameter
   - Fix:
   ```javascript
   setupInteraction({
     svg: document.getElementById("sim-canvas"),
     canvas,
     circuit,
     state,
     refresh,
     actions,
     keyboardActions: {  // ✅ Ini harus ada
       handleUndo,
       handleRedo,
       handleCopy,
       handleCut,
       handlePaste,
       handleSelectAll,
     },
   });
   ```

b) **setHistoryCallback() belum di-call**
   - Check main.js line ~285
   - Pastikan ada: `setHistoryCallback(saveToHistory);`
   - Fix: Tambahkan line tersebut sebelum setupInteraction()

c) **Event listener di interaction.js tidak aktif**
   - Check interaction.js line ~267-315
   - Pastikan keyboard event listener ada dengan Ctrl check
   - Verifikasi: `const isCtrlOrCmd = event.ctrlKey || event.metaKey;`

d) **Input/Select/Textarea memiliki focus**
   - Keyboard shortcuts di-disable saat focus di input elements
   - Ini adalah design yang intentional untuk tidak mengganggu typing
   - Test: Click di area kanvas kosong sebelum press shortcut

e) **Syntax error di salah satu file**
   - Buka DevTools Console, cari red error messages
   - Check module imports/exports
   - Run: `node -c public/js/simulator/history.js`
   - Run: `node -c public/js/simulator/clipboard.js`

### 2. Undo/Redo tidak menyimpan perubahan tertentu

**Problem**: Beberapa aksi tidak tercatat di history

**Debugging Steps**:
1. Check apakah saveToHistory() dipanggil sebelum aksi
2. Add console.log untuk trace execution

**Possible Causes & Solutions**:

a) **saveToHistory() tidak dipanggil sebelum perubahan**
   - Setiap perubahan circuit harus pre-pend dengan saveToHistory()
   - Check locations:
     - place() → addComponent
     - actions.deleteSelection()
     - actions.rotateSelection()
     - onParamChangeStart() → parameter change
     - commitAt() → wire creation
     - onUp() → drag complete
     - Clear button → clearCircuit

b) **Parameter changes tidak menyimpan**
   - Check properties.js line ~60-80 (numberField)
   - Pastikan event listener `focus` call onParamChangeStart()
   - Fix jika ada error:
   ```javascript
   input.addEventListener("focus", () => {
     if (handlers.onParamChangeStart) handlers.onParamChangeStart();
   });
   ```

c) **Wire creation tidak menyimpan**
   - Check interaction.js line ~103-122 (commitAt)
   - Pastikan saveToHistoryCallback() di-call sebelum addWire()
   - 2 lokasi: line ~107 dan ~117

d) **Drag movement tidak menyimpan**
   - Check interaction.js line ~250-253 (onUp function)
   - Pastikan saveToHistoryCallback() dipanggil saat moved=true
   - Fix:
   ```javascript
   function onUp() {
     stop();
     if (moved && saveToHistoryCallback) saveToHistoryCallback();  // ✅
     if (!moved && onClick) onClick();
   }
   ```

### 3. Copy/Paste tidak bekerja

**Problem**: Ctrl+C/V tidak menyalin/menempel

**Debugging Steps**:
1. Check apakah ada item yang di-select
2. Test dengan item yang berbeda (component, junction, wire)
3. Check browser console untuk error messages

**Possible Causes & Solutions**:

a) **Tidak ada item yang di-select**
   - handleCopy() hanya bekerja jika state.selected ada
   - Pastikan klik item sebelum Ctrl+C
   - Debug: Check console.log(state.selected)

b) **Clipboard kosong saat paste**
   - handlePaste() hanya bekerja jika clipboard.data ada
   - Pastikan sudah Ctrl+C sebelum Ctrl+V
   - Debug: Check console.log(clipboard.data)

c) **Paste menghasilkan error**
   - Check apakah ID mapping benar
   - Check apakah komponen/junction/wire di-create dengan benar
   - Common error: wire.from/to tidak valid setelah paste
   - Fix: Check handlePaste() line ~204-225 (ID mapping logic)

d) **Paste offset tidak tepat**
   - Offset di-hardcode 40px di handlePaste() line ~197-199
   - Edit jika ingin ubah offset:
   ```javascript
   x: comp.x + 40,  // Ubah 40 ke nilai baru
   y: comp.y + 40,
   ```

### 4. Memory usage meningkat terus

**Problem**: RAM usage terus bertambah, browser jadi lambat

**Possible Causes & Solutions**:

a) **History snapshots terlalu banyak**
   - History limited ke 50 snapshots (hard limit)
   - Check history.js line ~17-23 (pushSnapshot)
   - Jika masih banyak, reduce limit:
   ```javascript
   if (history.snapshots.length > 50) {  // Ubah ke 30 atau 20
     history.snapshots.shift();
     history.currentIndex--;
   }
   ```

b) **Clipboard tidak di-clear**
   - Clipboard menyimpan entire circuit data
   - Pastikan clearClipboard() di-call saat tidak perlu
   - Cek: tidak ada memory leak di clipboard

### 5. Undo/Redo kehilangan komponen/kabel tertentu

**Problem**: Setelah undo, beberapa item hilang atau rusak

**Debugging Steps**:
1. Check apakah restoreFromSnapshot() bekerja dengan benar
2. Compare circuit.data sebelum dan sesudah undo
3. Check ID counter updates

**Possible Causes & Solutions**:

a) **Deep copy tidak sempurna**
   - JSON.parse(JSON.stringify()) harus handle semua field
   - Pastikan tidak ada undefined values saat restore
   - Debug:
   ```javascript
   console.log('Before:', JSON.stringify(circuitData));
   // ... undo ...
   console.log('After:', JSON.stringify(circuit));
   ```

b) **ID counter tidak di-update**
   - restoreFromSnapshot() harus update nextId, nextJunctionId, nextWireId
   - Check main.js line ~101-115 (restoreFromSnapshot)
   - Pastikan calculation benar:
   ```javascript
   for (const c of circuit.components) {
     const num = parseInt(c.id.slice(1));
     circuit.nextId = Math.max(circuit.nextId, num + 1);  // ✅
   }
   ```

c) **Wire connections tidak valid**
   - Wire referensi component/junction yang sudah dihapus
   - Ini normal jika circuit tidak valid saat save
   - Check: pastikan pruneJunctions() dipanggil saat delete

### 6. Select All (Ctrl+A) tidak bekerja expected

**Problem**: Ctrl+A hanya select component pertama, bukan semua

**Explanation**:
- Current implementation: select first component saja
- UI tidak support multiple selection di current design
- This is by design, bukan bug

**Future Enhancement**:
- Untuk support multiple selection, perlu:
  1. Change state.selected menjadi array
  2. Update UI renderer untuk highlight multiple items
  3. Update delete/rotate untuk handle multiple items
  4. Update copy/paste untuk handle multiple items

**Workaround saat ini**:
- Gunakan Ctrl+A untuk quick select first component
- Atau click langsung pada component

### 7. Browser konsisten crash/hang

**Problem**: Browser atau simulator jadi freeze saat gunakan shortcuts

**Possible Causes & Solutions**:

a) **Infinite loop di event handler**
   - Check apakah ada circular dependency
   - Example: handleUndo() -> refresh() -> something trigger handleUndo() again
   - Debug: Add console.log di handlers untuk trace

b) **Large circuit dengan many undo/redo**
   - Snapshot creation O(n) bisa jadi slow untuk large circuit
   - Solution: Reduce max snapshots, optimize snapshot creation
   - Alternative: Implement delta-based undo instead of snapshot-based

c) **Memory leak di clipboard atau history**
   - Check: Are old snapshots/clipboard data properly garbage collected?
   - Solution: Add clearClipboard() saat tidak perlu
   - Check: browser DevTools Memory tab untuk identify leaks

## Debug Console Commands

```javascript
// Check history state
console.log('History:', {
  snapshots: history.snapshots.length,
  currentIndex: history.currentIndex,
  canUndo: canUndo(history),
  canRedo: canRedo(history)
});

// Check clipboard state
console.log('Clipboard:', {
  hasData: hasClipboardData(clipboard),
  data: getClipboardData(clipboard)
});

// Check circuit state
console.log('Circuit:', {
  components: circuit.components.length,
  junctions: circuit.junctions.length,
  wires: circuit.wires.length,
  nextId: circuit.nextId,
  nextJunctionId: circuit.nextJunctionId,
  nextWireId: circuit.nextWireId
});

// Check selection state
console.log('Selection:', state.selected);

// Force refresh
refresh();

// Force save to history
saveToHistory();

// Check if handlers are called
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey) {
    console.log('Ctrl+Key pressed:', e.key);
  }
});
```

## Performance Monitoring

```javascript
// Measure snapshot creation time
console.time('snapshot');
saveToHistory();
console.timeEnd('snapshot');

// Measure undo time
console.time('undo');
handleUndo();
console.timeEnd('undo');

// Measure paste time
console.time('paste');
handlePaste();
console.timeEnd('paste');

// Check memory usage (Chrome/Edge only)
if (performance.memory) {
  console.log('Memory:', {
    usedJSHeapSize: (performance.memory.usedJSHeapSize / 1048576).toFixed(2) + ' MB',
    totalJSHeapSize: (performance.memory.totalJSHeapSize / 1048576).toFixed(2) + ' MB',
    jsHeapSizeLimit: (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2) + ' MB'
  });
}
```

## Common Patterns for Adding New Features

### Adding a new keyboard shortcut
```javascript
// 1. Di main.js, tambah handler:
function handleMyFeature() {
  // ... do something ...
  saveToHistory();
  refresh();
}

// 2. Di setupInteraction call, tambah ke keyboardActions:
keyboardActions: {
  // ... existing ...
  handleMyFeature,
}

// 3. Di interaction.js, tambah ke keyboard event listener:
} else if (event.key === "?" && isCtrlOrCmd) {
  event.preventDefault();
  if (keyboardActions.handleMyFeature) keyboardActions.handleMyFeature();
  return;
}
```

### Adding action yang harus di-track ke history
```javascript
// 1. Before modifying circuit:
saveToHistory();

// 2. Do the modification:
modifyCircuit();

// 3. Refresh:
refresh();
```

## Support & Escalation

Jika masih ada issue setelah follow semua troubleshooting steps:

1. Check browser console untuk error messages
2. Test dengan clean circuit (Ctrl+Clear All)
3. Try different browser
4. Check network logs (F12 → Network tab)
5. Compare dengan test-modules.js untuk verify module loading

Dokumentasi lengkap ada di:
- IMPLEMENTATION_SUMMARY.md
- QUICK_REFERENCE.md
- KEYBOARD_SHORTCUTS_IMPLEMENTATION.md
