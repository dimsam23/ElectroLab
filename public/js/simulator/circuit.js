// Data rangkaian (tanpa DOM): daftar komponen, junction (titik sambung), dan kabel.
// Bentuk data ini yang nanti dikirim ke simulator dan disimpan sebagai JSON di Projects.
//
// Ujung kabel ("end") ada dua jenis:
//   { component: "c1", terminal: "plus" }   -> kaki komponen
//   { junction: "j1" }                      -> titik sambung (checkpoint) bebas di kanvas

import {
  COMPONENT_TYPES,
  GRID,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  terminalPosition,
} from "./components.js";

const MARGIN = 60; // jarak minimum komponen dari tepi kanvas
const JUNCTION_MARGIN = 20; // junction boleh lebih dekat ke tepi

// Membulatkan angka ke kelipatan grid terdekat.
export function snap(value) {
  return Math.round(value / GRID) * GRID;
}

// Menjaga posisi tetap di dalam kanvas.
export function clampToCanvas(x, y, margin = MARGIN) {
  return {
    x: Math.min(Math.max(x, margin), CANVAS_WIDTH - margin),
    y: Math.min(Math.max(y, margin), CANVAS_HEIGHT - margin),
  };
}

export function createCircuit() {
  return { components: [], junctions: [], wires: [], nextId: 1, nextJunctionId: 1, nextWireId: 1 };
}

// Menambah komponen baru di posisi (x, y) yang dibulatkan ke grid.
export function addComponent(circuit, type, x, y) {
  const definition = COMPONENT_TYPES[type];
  if (!definition) throw new Error(`Unknown component type: ${type}`);

  const position = clampToCanvas(snap(x), snap(y));
  const component = {
    id: `c${circuit.nextId++}`,
    type,
    x: position.x,
    y: position.y,
    rotation: 0,
    params: definition.defaultParams(),
  };
  circuit.components.push(component);
  return component;
}

// Mencari posisi kosong untuk komponen yang ditambahkan lewat klik/tap.
export function findFreeSpot(circuit) {
  for (let y = 140; y <= 500; y += 120) {
    for (let x = 140; x <= 860; x += 120) {
      const taken = circuit.components.some(
        (c) => Math.abs(c.x - x) < 100 && Math.abs(c.y - y) < 80
      );
      if (!taken) return { x, y };
    }
  }
  return { x: 500, y: 300 }; // semua posisi penuh: taruh di tengah
}

export function clearCircuit(circuit) {
  circuit.components.length = 0;
  circuit.junctions.length = 0;
  circuit.wires.length = 0;
  circuit.nextId = 1;
  circuit.nextJunctionId = 1;
  circuit.nextWireId = 1;
}

// Salinan data rangkaian dalam bentuk JSON biasa (tanpa penghitung id).
export function getCircuitData(circuit) {
  return JSON.parse(
    JSON.stringify({
      components: circuit.components,
      junctions: circuit.junctions,
      wires: circuit.wires,
    })
  );
}

export function findComponent(circuit, id) {
  return circuit.components.find((c) => c.id === id) || null;
}

export function findJunction(circuit, id) {
  return circuit.junctions.find((j) => j.id === id) || null;
}

export function findWire(circuit, id) {
  return circuit.wires.find((w) => w.id === id) || null;
}

// Memutar komponen 90 derajat searah jarum jam.
export function rotateComponent(component) {
  component.rotation = ((component.rotation || 0) + 90) % 360;
}

// ---- Ujung kabel ----

// Kunci unik sebuah ujung kabel, dipakai untuk membandingkan dan untuk netlist.
export function endKey(end) {
  if (end.x !== undefined && end.y !== undefined) {
    return `coord:${end.x},${end.y}`;
  }
  return end.junction ? `junction:${end.junction}` : `${end.component}:${end.terminal}`;
}

const copyEnd = (end) => {
  if (end.x !== undefined && end.y !== undefined) {
    return { x: end.x, y: end.y };
  }
  return end.junction ? { junction: end.junction } : { component: end.component, terminal: end.terminal };
};

// Posisi sebuah ujung kabel di kanvas. null kalau komponen/junction-nya tidak ada.
export function endPosition(circuit, end) {
  if (end.x !== undefined && end.y !== undefined) {
    return { x: end.x, y: end.y };
  }
  if (end.junction) {
    const junction = findJunction(circuit, end.junction);
    return junction ? { x: junction.x, y: junction.y } : null;
  }
  const component = findComponent(circuit, end.component);
  return component ? terminalPosition(component, end.terminal) : null;
}

// ---- Junction (checkpoint) ----

export function addJunction(circuit, x, y) {
  const position = clampToCanvas(snap(x), snap(y), JUNCTION_MARGIN);
  const junction = { id: `j${circuit.nextJunctionId++}`, x: position.x, y: position.y };
  circuit.junctions.push(junction);
  return junction;
}

// Junction yang tidak punya kabel sama sekali tidak ada gunanya, jadi dibuang.
function pruneJunctions(circuit) {
  const used = new Set();
  for (const wire of circuit.wires) {
    if (wire.from.junction) used.add(wire.from.junction);
    if (wire.to.junction) used.add(wire.to.junction);
  }
  circuit.junctions = circuit.junctions.filter((j) => used.has(j.id));
}

// Menghapus komponen beserta semua kabel yang tersambung ke kakinya.
export function removeComponent(circuit, id) {
  circuit.components = circuit.components.filter((c) => c.id !== id);
  circuit.wires = circuit.wires.filter((w) => w.from.component !== id && w.to.component !== id);
  pruneJunctions(circuit);
}

export function removeJunction(circuit, id) {
  circuit.wires = circuit.wires.filter((w) => w.from.junction !== id && w.to.junction !== id);
  circuit.junctions = circuit.junctions.filter((j) => j.id !== id);
  pruneJunctions(circuit);
}

export function removeWire(circuit, id) {
  circuit.wires = circuit.wires.filter((w) => w.id !== id);
  pruneJunctions(circuit);
}

// ---- Kabel ----

// Menyambung dua ujung. Mengembalikan kabel baru, atau null kalau tidak valid
// (ujung yang sama, atau sambungan yang sama sudah ada).
// bend (opsional) = "h" atau "v": arah segmen pertama dari ujung `from`. Dipakai kalau
// pengguna membalik siku kabel; kalau kosong, arah dipilih otomatis (lihat wiring.js).
export function addWire(circuit, from, to, bend = null) {
  const a = endKey(from);
  const b = endKey(to);
  if (a === b) return null;
  const exists = circuit.wires.some((w) => {
    const x = endKey(w.from);
    const y = endKey(w.to);
    return (x === a && y === b) || (x === b && y === a);
  });
  if (exists) return null;

  const wire = { id: `w${circuit.nextWireId++}`, from: copyEnd(from), to: copyEnd(to) };
  if (bend) wire.bend = bend;
  circuit.wires.push(wire);
  return wire;
}

// Mencari ujung (kaki komponen atau junction) terdekat dari titik `point`
// dalam jarak `radius` (satuan kanvas). `exclude` = ujung yang diabaikan.
export function findEndNear(circuit, point, radius, exclude = null) {
  let best = null;
  let bestDistance = radius;

  function consider(end, pos) {
    if (exclude && endKey(exclude) === endKey(end)) return;
    const distance = Math.hypot(pos.x - point.x, pos.y - point.y);
    if (distance <= bestDistance) {
      bestDistance = distance;
      best = end;
    }
  }

  for (const component of circuit.components) {
    for (const terminal of Object.keys(COMPONENT_TYPES[component.type].terminals)) {
      consider({ component: component.id, terminal }, terminalPosition(component, terminal));
    }
  }
  for (const junction of circuit.junctions) {
    consider({ junction: junction.id }, junction);
  }
  // Tambahkan ujung kabel (koordinat) sebagai kandidat snap
  for (const wire of circuit.wires) {
    if (wire.from.x !== undefined && wire.from.y !== undefined) {
      consider({ x: wire.from.x, y: wire.from.y }, { x: wire.from.x, y: wire.from.y });
    }
    if (wire.to.x !== undefined && wire.to.y !== undefined) {
      consider({ x: wire.to.x, y: wire.to.y }, { x: wire.to.x, y: wire.to.y });
    }
  }
  return best;
}

// Mencari semua kabel yang terhubung dalam satu net (kelompok kabel yang saling tersambung)
export function findConnectedWires(circuit, wireId) {
  const wire = findWire(circuit, wireId);
  if (!wire) return [];

  const visited = new Set();
  const connected = [];

  function explore(w) {
    if (visited.has(w.id)) return;
    visited.add(w.id);
    connected.push(w);

    // Cari kabel yang tersambung ke ujung "from" wire ini
    for (const other of circuit.wires) {
      if (visited.has(other.id)) continue;

      const fromMatches = endKey(w.from) === endKey(other.from) || endKey(w.from) === endKey(other.to);
      const toMatches = endKey(w.to) === endKey(other.from) || endKey(w.to) === endKey(other.to);

      if (fromMatches || toMatches) {
        explore(other);
      }
    }
  }

  explore(wire);
  return connected;
}