// Netlist: mengubah komponen + kabel + junction menjadi daftar "node" listrik.
// Semua titik yang tersambung kabel adalah satu node (tegangannya sama).
// Node 0 = referensi 0 V (ground).

import { COMPONENT_TYPES } from "./components.js";
import { endKey } from "./circuit.js";

export function buildNetlist(circuit) {
  // Union-find: mengelompokkan kunci titik yang saling tersambung.
  const parent = new Map();
  const find = (key) => {
    if (!parent.has(key)) parent.set(key, key);
    let root = key;
    while (parent.get(root) !== root) root = parent.get(root);
    while (parent.get(key) !== root) {
      const next = parent.get(key);
      parent.set(key, root);
      key = next;
    }
    return root;
  };
  const union = (a, b) => parent.set(find(a), find(b));

  // Daftarkan semua kaki komponen dan junction.
  for (const c of circuit.components) {
    for (const terminal of Object.keys(COMPONENT_TYPES[c.type].terminals)) find(`${c.id}:${terminal}`);
  }
  for (const j of circuit.junctions) find(`junction:${j.id}`);

  // Kabel menyatukan kedua ujungnya.
  for (const wire of circuit.wires) union(endKey(wire.from), endKey(wire.to));

  // Semua Ground adalah satu node.
  const grounds = circuit.components.filter((c) => c.type === "ground");
  for (let i = 1; i < grounds.length; i++) union(`${grounds[0].id}:gnd`, `${grounds[i].id}:gnd`);

  // Pilih node referensi: Ground; kalau tidak ada, kutub (-) baterai pertama; kalau tidak ada, node pertama.
  const battery = circuit.components.find((c) => c.type === "battery");
  let referenceKey = null;
  if (grounds.length > 0) referenceKey = `${grounds[0].id}:gnd`;
  else if (battery) referenceKey = `${battery.id}:minus`;
  const referenceRoot = referenceKey ? find(referenceKey) : null;

  // Beri nomor node: referensi = 0, sisanya 1, 2, 3, ...
  const numbers = new Map();
  if (referenceRoot) numbers.set(referenceRoot, 0);
  for (const key of [...parent.keys()]) {
    const root = find(key);
    if (!numbers.has(root)) numbers.set(root, numbers.size === 0 && !referenceRoot ? 0 : numbers.size);
  }

  return {
    nodeCount: numbers.size,
    hasGround: grounds.length > 0,
    // Nomor node untuk sebuah kaki komponen.
    nodeOf: (componentId, terminal) => numbers.get(find(`${componentId}:${terminal}`)),
  };
}