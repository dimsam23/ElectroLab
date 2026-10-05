# Quick Reference: Keyboard Shortcuts Implementation

## Keyboard Shortcuts yang Tersedia

```
Ctrl+Z / Cmd+Z   → Undo
Ctrl+Y / Cmd+Y   → Redo
Ctrl+C / Cmd+C   → Copy selected item
Ctrl+X / Cmd+X   → Cut selected item
Ctrl+V / Cmd+V   → Paste from clipboard
Ctrl+A / Cmd+A   → Select all (select first component)
```

## Architecture Overview

```
main.js
├── Mengelola history & clipboard instances
├── Fungsi-fungsi handler (handleUndo, handleRedo, dll)
├── Pass keyboardActions ke setupInteraction()
└── Call setHistoryCallback() untuk link dengan interaction.js

interaction.js
├── setupInteraction() menerima keyboardActions
├── Keyboard event listener untuk Ctrl+Z/Y/C/X/V/A
├── saveToHistoryCallback dijalankan saat wire dibuat & drag selesai
└── setHistoryCallback() untuk register history callback

properties.js
├── onParamChangeStart() trigger saat input focus
├── Setiap change (input, select, toggle) call saveToHistory()
└── Handler ini di-pass dari main.js ke createProperties()

history.js
├── Snapshot-based undo/redo system
└── Max 50 snapshots, auto-cleanup lama snapshots

clipboard.js
└── Simple clipboard manager untuk copy/paste/cut
```

## Flow Diagram: Adding Component

```
User drag komponen dari palette
    ↓
setupPalette() → place() function
    ↓
place() call saveToHistory() → pushSnapshot(history, circuitData)
    ↓
addComponent() → refresh()
    ↓
Komponen muncul di canvas, state disimpan ke history
```

## Flow Diagram: Ctrl+Z (Undo)

```
User press Ctrl+Z
    ↓
interaction.js keydown event listener
    ↓
handleUndo() di main.js
    ↓
undo(history) → get previous snapshot
    ↓
restoreFromSnapshot(data) → restore circuit dari snapshot
    ↓
refresh() → canvas updated
```

## Flow Diagram: Ctrl+V (Paste)

```
User press Ctrl+V
    ↓
interaction.js keydown event listener
    ↓
handlePaste() di main.js
    ↓
saveToHistory() → simpan state before paste
    ↓
Iterate clipboard.components/junctions/wires
├── Generate new IDs (c#, j#, w#)
├── Offset position +40px
└── Create id mapping untuk wire connections
    ↓
addComponent() / addJunction() / addWire() → circuit updated
    ↓
state.selected = first pasted component
    ↓
refresh() → canvas updated, komponen di-select
```

## Code Examples

### Menambah Aksi yang Mencatat ke History

```javascript
// Di main.js atau interaction.js, sebelum mengubah circuit:
saveToHistory();  // or saveToHistoryCallback()
// ... lakukan perubahan ke circuit ...
refresh();
```

### Membaca dari History

```javascript
// Undo
const snapshot = undo(history);
if (snapshot) restoreFromSnapshot(snapshot);

// Redo
const snapshot = redo(history);
if (snapshot) restoreFromSnapshot(snapshot);
```

### Menggunakan Clipboard

```javascript
// Copy
copyToClipboard(clipboard, circuit, state.selected);

// Get data
const data = getClipboardData(clipboard);

// Paste (lihat handlePaste() di main.js untuk contoh lengkap)
```

## Debug Tips

### Cek History State
```javascript
// Di browser console:
console.log(window.ElectroLabCircuit.history);
console.log(window.ElectroLabCircuit.clipboard);
```

### Cek Circuit Data
```javascript
// Di browser console:
console.log(window.ElectroLabCircuit.getData());
```

### Cek apakah Undo/Redo Available
```javascript
// Di browser console:
console.log('Can undo:', canUndo(window.ElectroLabCircuit.history));
console.log('Can redo:', canRedo(window.ElectroLabCircuit.history));
```

## Common Issues & Solutions

### Issue: Ctrl+Z/Y tidak bekerja
**Solution**: Pastikan event listener tidak di-prevent oleh element lain. Check:
- Input focus state (event listener skip saat di input/select/textarea)
- Event.preventDefault() di handler
- setupInteraction() di-call dengan keyboardActions parameter

### Issue: History terlalu banyak menyimpan
**Solution**: History auto-cleanup ke 50 snapshots max. Jika perlu lebih/kurang, edit di `pushSnapshot()` di history.js:
```javascript
// Line ~20 di history.js
if (history.snapshots.length > 50) {  // Ubah 50 ke nilai yang diinginkan
```

### Issue: Paste offset tidak sesuai
**Solution**: Edit di `handlePaste()` di main.js:
```javascript
// Line ~197-199
x: comp.x + 40,  // Ubah 40 ke offset yang diinginkan
y: comp.y + 40,
```

### Issue: Keyboard shortcut konflik dengan browser
**Solution**: Beberapa browser/OS memiliki reserved shortcuts. Pastikan:
- Ctrl+Z, Ctrl+Y, Ctrl+C, Ctrl+X, Ctrl+V, Ctrl+A adalah standard shortcuts
- Jika ada konflik, perubahan di event handler di interaction.js

## Integration Checklist

- [x] history.js dibuat dan di-export dengan benar
- [x] clipboard.js dibuat dan di-export dengan benar
- [x] main.js import history dan clipboard
- [x] main.js import setHistoryCallback dari interaction.js
- [x] Semua handler functions di-define di main.js
- [x] setupInteraction() menerima keyboardActions parameter
- [x] interaction.js setup keyboard event listener dengan Ctrl check
- [x] properties.js tambah onParamChangeStart handler
- [x] createProperties() call di main.js dengan onParamChangeStart
- [x] Syntax check semua file (Node.js -c)

## Files Modified Count

- **New files**: 2 (history.js, clipboard.js)
- **Modified files**: 3 (main.js, interaction.js, properties.js)
- **Total lines added**: ~400
- **Total lines modified**: ~100

## Performance Considerations

1. **Memory**: 50 snapshots × circuit size ≈ reasonable untuk most circuits
2. **Snapshot creation**: O(n) untuk deep copy, negligible impact
3. **Event handlers**: No performance bottleneck, same as existing shortcuts
4. **ID generation**: O(n) saat paste, acceptable untuk UI operation

## Browser Compatibility

- ✅ Chrome/Chromium (Ctrl key)
- ✅ Firefox (Ctrl key)
- ✅ Safari (Cmd key via event.metaKey)
- ✅ Edge (Ctrl key)

## Next Steps (Optional)

1. Add UI buttons dengan visual feedback untuk undo/redo
2. Add toast notifications untuk Copy/Paste success
3. Add history panel untuk visualisasi undo/redo stack
4. Add keyboard shortcut help dialog (? atau F1)
5. Add preference untuk customize shortcuts
6. Add history persistence ke localStorage
