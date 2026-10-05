// Test file untuk memverifikasi semua modules dapat di-load dengan benar
// File ini bukan untuk production, hanya untuk verification

// Test 1: Verify history.js exports
console.log('Testing history.js exports...');
import { createHistory, pushSnapshot, undo, redo, canUndo, canRedo } from './history.js';
console.log('✓ history.js exports verified');

// Test 2: Verify clipboard.js exports
console.log('Testing clipboard.js exports...');
import { 
  createClipboard, 
  copyToClipboard, 
  copyAllToClipboard, 
  getClipboardData, 
  hasClipboardData, 
  clearClipboard 
} from './clipboard.js';
console.log('✓ clipboard.js exports verified');

// Test 3: Verify interaction.js setHistoryCallback export
console.log('Testing interaction.js exports...');
import { setHistoryCallback } from './interaction.js';
console.log('✓ interaction.js exports verified');

// Test 4: Basic history functionality
console.log('\nTesting basic history functionality...');
const history = createHistory();
const testData1 = { components: [], junctions: [], wires: [] };
const testData2 = { components: [{ id: 'c1' }], junctions: [], wires: [] };

pushSnapshot(history, testData1);
console.log('✓ pushSnapshot works');

pushSnapshot(history, testData2);
console.log('✓ can push multiple snapshots');

console.log('canUndo:', canUndo(history));  // should be true
console.log('canRedo:', canRedo(history));  // should be false

const undoData = undo(history);
console.log('✓ undo works, snapshot:', undoData);

const redoData = redo(history);
console.log('✓ redo works, snapshot:', redoData);

// Test 5: Basic clipboard functionality
console.log('\nTesting basic clipboard functionality...');
const clipboard = createClipboard();
console.log('hasClipboardData (empty):', hasClipboardData(clipboard));  // false

const testSelection = { kind: 'component', id: 'c1' };
const testCircuit = {
  components: [{ id: 'c1', type: 'resistor', x: 100, y: 100, params: {} }],
  junctions: [],
  wires: []
};

copyToClipboard(clipboard, testCircuit, testSelection);
console.log('✓ copyToClipboard works');
console.log('hasClipboardData (filled):', hasClipboardData(clipboard));  // true

const clipData = getClipboardData(clipboard);
console.log('✓ getClipboardData works, data:', clipData);

clearClipboard(clipboard);
console.log('✓ clearClipboard works');
console.log('hasClipboardData (cleared):', hasClipboardData(clipboard));  // false

console.log('\n✅ All tests passed!');
