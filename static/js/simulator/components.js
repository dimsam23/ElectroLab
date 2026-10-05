// Definisi komponen ElectroLab: bentuk simbol, posisi terminal, dan parameter awal.
// Semua data komponen ada di file ini, jadi menambah komponen baru
// cukup dengan menambah satu entri di COMPONENT_TYPES.

export const GRID = 20; // jarak garis grid (px). Semua posisi dibulatkan ke kelipatan ini.
export const CANVAS_WIDTH = 1000;
export const CANVAS_HEIGHT = 600;

// Simbol Ω ditulis dengan kode Unicode supaya tidak tertukar dengan karakter lain yang mirip.
const OHM = "\u03a9";
const MICRO = "\u00b5"; // simbol mikro (µ)
const MODE_NAME = { voltage: "Voltmeter", current: "Ammeter", resistance: "Ohmmeter" };
const MODE_SYMBOL = { voltage: "V", current: "A", resistance: OHM };

// Faktor pengali satuan -> satuan dasar (V, A, Ohm, F). Dipakai oleh solver.
const UNIT_FACTOR = {
  mV: 1e-3, V: 1, kV: 1e3,
  [OHM]: 1, [`k${OHM}`]: 1e3, [`M${OHM}`]: 1e6,
  pF: 1e-12, nF: 1e-9, [`${MICRO}F`]: 1e-6, mF: 1e-3,
  [`${MICRO}A`]: 1e-6, mA: 1e-3, A: 1,
};

// Mengubah { value, unit } menjadi angka dalam satuan dasar. Contoh: 4.7 kOhm -> 4700.
export function toBase(param) {
  return param.value * (UNIT_FACTOR[param.unit] ?? 1);
}

// Transistor bipolar (BJT). Kaki: base (kiri), collector (kanan atas), emitter (kanan bawah).
// NPN dan PNP bentuknya sama; bedanya hanya arah panah di emitter.
function bjtDefinition(label, isPnp) {
  return {
    label,
    terminals: { base: [-40, 0], collector: [20, -40], emitter: [20, 40] },
    hitArea: { x: -44, y: -50, width: 88, height: 100 }, // lebih tinggi dari komponen lain
    labelY: 62, // tulisan nilai diturunkan supaya tidak menimpa kaki emitter
    defaultParams: () => ({
      gain: { value: 100, unit: "" }, // hFE (tanpa satuan)
      vbe_on: { value: 0.7, unit: "V" },
      vce_sat: { value: 0.2, unit: "V" },
    }),
    fields: [
      { key: "gain", label: "Gain (hFE)" },
      { key: "vbe_on", label: "Base-emitter voltage (Vbe)", units: ["mV", "V"] },
      { key: "vce_sat", label: "Saturation voltage (Vce sat)", units: ["mV", "V"] },
    ],
    caption: (c) => `${isPnp ? "PNP" : "NPN"} hFE ${c.params.gain.value}`,
    shapes: () => [
      line(-40, 0, -8, 0), // kaki base
      line(-8, -16, -8, 16, { "stroke-width": 3 }), // pelat base
      line(-8, -8, 20, -24), // ke collector
      line(20, -24, 20, -40),
      line(-8, 8, 20, 24), // ke emitter
      line(20, 24, 20, 40),
      // panah di emitter: NPN menunjuk keluar, PNP menunjuk ke base
      {
        tag: "polygon",
        points: isPnp ? "-2.4,11.2 2.5,18.7 6.5,11.7" : "13,20 4.1,19.5 8,12.6",
        style: "fill: var(--text)",
      },
    ],
  };
}

// Pembantu kecil untuk membuat data bentuk SVG (digambar oleh canvas.js).
const line = (x1, y1, x2, y2, extra = {}) => ({ tag: "line", x1, y1, x2, y2, ...extra });
const circle = (cx, cy, r) => ({ tag: "circle", cx, cy, r });
const text = (x, y, content) => ({ tag: "text", x, y, text: content });

// Koordinat di bawah relatif terhadap titik tengah komponen (0, 0).
// Semua terminal berada di kelipatan 20 supaya pas dengan grid saat dikabel.
export const COMPONENT_TYPES = {
  battery: {
    label: "Battery",
    terminals: { plus: [-40, 0], minus: [40, 0] },
    defaultParams: () => ({ voltage: { value: 9, unit: "V" } }),
      // battery
    fields: [{ key: "voltage", label: "Voltage", units: ["mV", "V", "kV"] }],
    caption: (c) => `${c.params.voltage.value} ${c.params.voltage.unit}`,
    shapes: () => [
      line(-40, 0, -6, 0),
      line(6, 0, 40, 0),
      line(-6, -16, -6, 16, { "stroke-width": 4 }), // pelat panjang = kutub positif (+)
      line(6, -9, 6, 9, { "stroke-width": 4 }), // pelat pendek = kutub negatif (-)
      text(-28, -10, "+"),
      text(28, -10, "\u2212"),
    ],
  },

  resistor: {
    label: "Resistor",
    terminals: { a: [-40, 0], b: [40, 0] },
    defaultParams: () => ({ resistance: { value: 1, unit: `k${OHM}` } }),
    // resistor
    fields: [{ key: "resistance", label: "Resistance", units: [OHM, `k${OHM}`, `M${OHM}`] }],
    caption: (c) => `${c.params.resistance.value} ${c.params.resistance.unit}`,
    shapes: () => [
      line(-40, 0, -20, 0),
      { tag: "rect", x: -20, y: -8, width: 40, height: 16 },
      line(20, 0, 40, 0),
    ],
  },

  capacitor: {
    label: "Capacitor",
    terminals: { a: [-40, 0], b: [40, 0] },
    defaultParams: () => ({ capacitance: { value: 100, unit: `${MICRO}F` } }),
    fields: [{ key: "capacitance", label: "Capacitance", units: ["pF", "nF", `${MICRO}F`, "mF"] }],
    caption: (c) => `${c.params.capacitance.value} ${c.params.capacitance.unit}`,
    shapes: () => [
      line(-40, 0, -6, 0),
      line(6, 0, 40, 0),
      line(-6, -16, -6, 16, { "stroke-width": 3 }), // dua pelat paralel
      line(6, -16, 6, 16, { "stroke-width": 3 }),
    ],
  },

  led: {
    label: "LED",
    terminals: { anode: [-40, 0], cathode: [40, 0] },
    defaultParams: () => ({
      forward_voltage: { value: 2, unit: "V" },
      max_current: { value: 20, unit: "mA" }, // dipakai simulator untuk peringatan arus berlebih
    }),
    fields: [
      { key: "forward_voltage", label: "Forward voltage (Vf)", units: ["mV", "V"] },
      { key: "max_current", label: "Max current", units: [`${MICRO}A`, "mA", "A"] },
],
    caption: (c) => `Vf ${c.params.forward_voltage.value} ${c.params.forward_voltage.unit}`,
    shapes: () => [
      line(-40, 0, -12, 0),
      { tag: "polygon", points: "-12,-14 -12,14 12,0" },
      line(12, -14, 12, 14),
      line(12, 0, 40, 0),
      // dua panah kecil sebagai tanda cahaya
      { tag: "path", d: "M4 -18 L14 -28 M10 -28 L14 -28 L14 -24" },
      { tag: "path", d: "M14 -12 L24 -22 M20 -22 L24 -22 L24 -18" },
    ],
  },

  diode: {
    label: "Diode",
    terminals: { anode: [-40, 0], cathode: [40, 0] },
    defaultParams: () => ({
      forward_voltage: { value: 0.7, unit: "V" },
      max_current: { value: 1, unit: "A" },
    }),
    fields: [
      { key: "forward_voltage", label: "Forward voltage (Vf)", units: ["mV", "V"] },
      { key: "max_current", label: "Max current", units: [`${MICRO}A`, "mA", "A"] },
    ],
    caption: (c) => `Vf ${c.params.forward_voltage.value} ${c.params.forward_voltage.unit}`,
    shapes: () => [
      line(-40, 0, -12, 0),
      { tag: "polygon", points: "-12,-14 -12,14 12,0" },
      line(12, -14, 12, 14),
      line(12, 0, 40, 0),
    ],
  },

  switch: {
    label: "Switch",
    terminals: { a: [-40, 0], b: [40, 0] },
    defaultParams: () => ({ closed: true }), // true = ON (tersambung)
    // switch
    fields: [{ key: "closed", label: "State", type: "toggle", onLabel: "ON (closed)", offLabel: "OFF (open)" }],
    caption: (c) => (c.params.closed ? "ON" : "OFF"),
    shapes: (c) => [
      line(-40, 0, -16, 0),
      line(16, 0, 40, 0),
      circle(-16, 0, 3),
      circle(16, 0, 3),
      // tuas: lurus kalau ON, terangkat kalau OFF
      c.params.closed ? line(-16, 0, 16, 0) : line(-16, 0, 12, -16),
    ],
  },

  npn: bjtDefinition("NPN Transistor", false),
  pnp: bjtDefinition("PNP Transistor", true),

  multimeter: {
    label: "Multimeter",
    terminals: { red: [-40, 0], black: [40, 0] },
    defaultParams: () => ({ mode: "voltage" }),
    fields: [
      {
        key: "mode",
        label: "Mode",
        type: "select",
        options: [
          { value: "voltage", label: "Voltage (V)" },
          { value: "current", label: "Current (A)" },
          { value: "resistance", label: `Resistance (${OHM})` },
        ],
      },
    ],
    caption: (c) => MODE_NAME[c.params.mode],
    shapes: (c) => [
      line(-40, 0, -20, 0),
      { tag: "rect", x: -20, y: -14, width: 40, height: 28, rx: 6 },
      line(20, 0, 40, 0),
      text(0, 5, MODE_SYMBOL[c.params.mode]),
      text(-30, -8, "+"),
      text(30, -8, "\u2212"),
    ],
  },

  ground: {
    label: "Ground",
    terminals: { gnd: [0, -20] },
    defaultParams: () => ({}),
    // ground
    fields: [],
    caption: () => "GND",
    shapes: () => [
      line(0, -20, 0, 0),
      line(-16, 0, 16, 0),
      line(-10, 7, 10, 7),
      line(-4, 14, 4, 14),
    ],
  },
};

// Memutar titik (x, y) searah jarum jam. Rotasi hanya kelipatan 90 derajat.
export function rotatePoint([x, y], rotation) {
  switch (((rotation % 360) + 360) % 360) {
    case 90:
      return [-y, x];
    case 180:
      return [-x, -y];
    case 270:
      return [y, -x];
    default:
      return [x, y];
  }
}

// Posisi terminal di kanvas (sudah memperhitungkan posisi dan rotasi komponen).
// Dipakai untuk menggambar dan menghubungkan kabel.
export function terminalPosition(component, terminalName) {
  const definition = COMPONENT_TYPES[component.type];
  const [dx, dy] = rotatePoint(definition.terminals[terminalName], component.rotation || 0);
  return { x: component.x + dx, y: component.y + dy };
}

// Arah keluar terminal setelah rotasi: "h" (mendatar) atau "v" (tegak).
// Dipakai untuk menentukan bentuk jalur kabel.
export function terminalAxis(component, terminalName) {
  const definition = COMPONENT_TYPES[component.type];
  const [dx, dy] = rotatePoint(definition.terminals[terminalName], component.rotation || 0);
  return Math.abs(dx) >= Math.abs(dy) ? "h" : "v";
}