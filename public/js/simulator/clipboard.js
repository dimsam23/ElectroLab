// Manajemen clipboard untuk copy/paste/cut komponen dan junction.

export function createClipboard() {
  return {
    data: null, // { components, junctions, wires, offset }
  };
}

// Menyalin komponen/junction/wire yang dipilih ke clipboard.
export function copyToClipboard(clipboard, circuit, selection) {
  if (!selection) return;

  const copied = {
    components: [],
    junctions: [],
    wires: [],
    offset: { x: 0, y: 0 },
  };

  if (selection.kind === "component") {
    const component = circuit.components.find((c) => c.id === selection.id);
    if (component) {
      // Deep copy komponen.
      copied.components.push(JSON.parse(JSON.stringify(component)));
    }
  } else if (selection.kind === "junction") {
    const junction = circuit.junctions.find((j) => j.id === selection.id);
    if (junction) {
      copied.junctions.push(JSON.parse(JSON.stringify(junction)));
    }
  } else if (selection.kind === "wire") {
    const wire = circuit.wires.find((w) => w.id === selection.id);
    if (wire) {
      copied.wires.push(JSON.parse(JSON.stringify(wire)));
    }
  }

  clipboard.data = copied;
  return true;
}

// Menyalin semua komponen dan junction ke clipboard.
export function copyAllToClipboard(clipboard, circuit, selection) {
  if (!selection) {
    clipboard.data = {
      components: JSON.parse(JSON.stringify(circuit.components)),
      junctions: JSON.parse(JSON.stringify(circuit.junctions)),
      wires: JSON.parse(JSON.stringify(circuit.wires)),
      offset: { x: 0, y: 0 },
    };
    return true;
  }
  
  // Filter hanya item yang dipilih
  const selectedIds = selection.map((s) => s.id);
  const filtered = {
    components: circuit.components.filter((c) => selectedIds.includes(c.id)),
    junctions: circuit.junctions.filter((j) => selectedIds.includes(j.id)),
    wires: circuit.wires.filter((w) => selectedIds.includes(w.id)),
  };
  
  clipboard.data = filtered;
  return true;
}

// Mengambil data dari clipboard.
export function getClipboardData(clipboard) {
  return clipboard.data;
}

// Membersihkan clipboard.
export function clearClipboard(clipboard) {
  clipboard.data = null;
}

// Cek apakah clipboard memiliki data.
export function hasClipboardData(clipboard) {
  return clipboard.data !== null;
}
