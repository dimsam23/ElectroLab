// Solver DC: menghitung tegangan tiap node dan arus tiap komponen dengan
// Modified Nodal Analysis (MNA), cara yang sama dipakai simulator seperti SPICE.
//
// Ide dasarnya: untuk setiap node berlaku hukum Kirchhoff arus (jumlah arus masuk = keluar).
// Itu menghasilkan sistem persamaan linear  A · x = z  dengan x = [tegangan node..., arus sumber...].
//
// Model komponen (DC / kondisi tunak):
//   Resistor   : konduktansi G = 1/R
//   Baterai    : sumber tegangan ideal (punya satu variabel arus tambahan)
//   Switch     : tertutup = hambatan sangat kecil, terbuka = putus
//   Kapasitor  : pada DC yang sudah stabil = putus (tidak ada arus)
//   LED/Dioda  : mati sampai tegangan melewati Vf, lalu menghantar (Vf + hambatan seri kecil)
//   Transistor : tiga daerah kerja. Cutoff (mati), active (Ic = hFE x Ib), saturation (Vce = Vce sat)
//   Multimeter : voltmeter = hambatan tak hingga, ammeter = sumber 0 V (kabel), ohmmeter = arus uji 1 A
//
// Ground TIDAK wajib. Tegangan hanya bermakna sebagai selisih, jadi solver cukup memilih satu node
// sebagai 0 V: node Ground kalau ada, kalau tidak ada kutub (-) baterai (lihat netlist.js).

import { toBase } from "./components.js";
import { buildNetlist } from "./netlist.js";

const GMIN = 1e-9; // konduktansi kecil ke ground di tiap node, supaya node mengambang tidak membuat matriks singular
const LED_RS = 1; // hambatan seri LED/dioda saat menghantar (ohm)
const SWITCH_R = 1e-3; // hambatan saklar tertutup (ohm)
const BJT_RBE = 10; // hambatan seri junction base-emitter saat menghantar (ohm)
const BJT_RSAT = 1; // hambatan collector-emitter saat jenuh (ohm)
const OPEN_OHMS = 1e8; // di atas ini ohmmeter menampilkan "OL" (open loop)
// Arus/tegangan di bawah batas ini hanyalah "bocor" dari GMIN (efek hitungan), bukan nilai nyata.
const NOISE_VOLTS = 1e-5;
const NOISE_AMPS = 1e-7;
const cleanV = (x) => (Math.abs(x) < NOISE_VOLTS ? 0 : x);
const cleanA = (x) => (Math.abs(x) < NOISE_AMPS ? 0 : x);
const SHORT_ERROR = "Short circuit or conflicting voltage sources. Check your wiring.";

const isDiode = (c) => c.type === "led" || c.type === "diode";
const isBjt = (c) => c.type === "npn" || c.type === "pnp";

// ---------- Format angka dengan awalan satuan (4700 -> "4.7 k") ----------

const PREFIXES = [
  [1e6, "M"], [1e3, "k"], [1, ""], [1e-3, "m"], [1e-6, "\u00b5"], [1e-9, "n"], [1e-12, "p"],
];

export function formatSI(value, unit) {
  if (!Number.isFinite(value)) return `-- ${unit}`;
  const abs = Math.abs(value);
  if (abs < 1e-12) return `0 ${unit}`;
  const [factor, prefix] = PREFIXES.find(([f]) => abs >= f * 0.9995) || PREFIXES[PREFIXES.length - 1];
  return `${Number((value / factor).toPrecision(3))} ${prefix}${unit}`;
}

// ---------- Penyelesai sistem linear (eliminasi Gauss dengan pivoting) ----------

function solveLinear(A, z) {
  const n = z.length;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(A[row][col]) > Math.abs(A[pivot][col])) pivot = row;
    }
    if (Math.abs(A[pivot][col]) < 1e-13) throw new Error(SHORT_ERROR);
    [A[col], A[pivot]] = [A[pivot], A[col]];
    [z[col], z[pivot]] = [z[pivot], z[col]];
    for (let row = col + 1; row < n; row++) {
      const factor = A[row][col] / A[col][col];
      if (factor === 0) continue;
      for (let k = col; k < n; k++) A[row][k] -= factor * A[col][k];
      z[row] -= factor * z[col];
    }
  }
  const x = new Array(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let sum = z[row];
    for (let k = row + 1; k < n; k++) sum -= A[row][k] * x[k];
    x[row] = sum / A[row][row];
  }
  return x;
}

// ---------- Model transistor ----------
// Transistor = dioda base-emitter + sumber arus yang dikendalikan.
//   NPN: dioda B -> E, arus utama C -> E.      PNP: dioda E -> B, arus utama E -> C.
// da/dk = anoda/katoda dioda base-emitter. ma/mk = ujung awal/akhir arus utama.

function bjtNodes(net, c) {
  const b = net.nodeOf(c.id, "base");
  const col = net.nodeOf(c.id, "collector");
  const e = net.nodeOf(c.id, "emitter");
  return c.type === "npn" ? { da: b, dk: e, ma: col, mk: e } : { da: e, dk: b, ma: e, mk: col };
}

function bjtParams(c) {
  return {
    beta: toBase(c.params.gain),
    von: toBase(c.params.vbe_on),
    vsat: toBase(c.params.vce_sat),
  };
}

// Tegangan dan arus transistor dari sebuah solusi, untuk daerah kerja `state`.
function bjtOperatingPoint(net, c, solution, state) {
  const t = bjtNodes(net, c);
  const p = bjtParams(c);
  const vbe = solution.voltage(t.da) - solution.voltage(t.dk);
  const vce = solution.voltage(t.ma) - solution.voltage(t.mk);
  const ib = state === "off" ? 0 : (vbe - p.von) / BJT_RBE;
  let ic = 0;
  if (state === "active") ic = p.beta * ib;
  else if (state === "sat") ic = (vce - p.vsat) / BJT_RSAT;
  return { vbe, vce, ib, ic, p };
}

// Menentukan daerah kerja berikutnya berdasarkan solusi sekarang.
function nextBjtState(net, c, solution, state) {
  const { vbe, vce, p } = bjtOperatingPoint(net, c, solution, state);
  const ib = (vbe - p.von) / BJT_RBE;
  if (state === "off") return vbe > p.von ? "active" : "off";
  if (ib < 0) return "off";
  if (state === "active") return vce < p.vsat ? "sat" : "active";
  return (vce - p.vsat) / BJT_RSAT > p.beta * ib ? "active" : "sat";
}

const REGION_NAME = { off: "cutoff", active: "active", sat: "saturated" };

// ---------- Satu kali penyelesaian rangkaian ----------
// mode "normal": baterai aktif.  mode "ohm": baterai dinonaktifkan (0 V) dan arus uji 1 A
// dialirkan lewat `probe` = { red, black } (nomor node).
// diodeOn: Set id LED/dioda yang dianggap menghantar.  bjtState: Map id -> "off" | "active" | "sat".

function solveOnce(circuit, net, { mode, diodeOn, bjtState, probe }) {
  const nodeIndex = (n) => n - 1; // node 0 (ground) tidak punya baris
  const nodeUnknowns = net.nodeCount - 1;

  // Daftar sumber tegangan = variabel tambahan di MNA.
  const sources = [];
  for (const c of circuit.components) {
    if (c.type === "battery") {
      const p = net.nodeOf(c.id, "plus");
      const n = net.nodeOf(c.id, "minus");
      if (p === n) throw new Error(SHORT_ERROR);
      sources.push({ id: c.id, p, n, volts: mode === "ohm" ? 0 : toBase(c.params.voltage) });
    } else if (c.type === "multimeter" && c.params.mode === "current") {
      const p = net.nodeOf(c.id, "red");
      const n = net.nodeOf(c.id, "black");
      if (p !== n) sources.push({ id: c.id, p, n, volts: 0 }); // ammeter = kabel 0 V
    }
  }

  const size = nodeUnknowns + sources.length;
  const A = Array.from({ length: size }, () => new Array(size).fill(0));
  const z = new Array(size).fill(0);

  // Pembantu pengisian matriks ("stamp"). Baris/kolom node 0 dilewati.
  const add = (r, c, value) => {
    if (r > 0 && c > 0) A[nodeIndex(r)][nodeIndex(c)] += value;
  };
  const conduct = (a, b, g) => {
    add(a, a, g);
    add(b, b, g);
    add(a, b, -g);
    add(b, a, -g);
  };
  const inject = (node, current) => {
    if (node > 0) z[nodeIndex(node)] += current;
  };
  // Dioda ideal dengan tegangan nyala `von` dan hambatan seri `rs` (kondisi menghantar).
  const stampDiode = (anode, cathode, von, rs) => {
    conduct(anode, cathode, 1 / rs);
    inject(anode, von / rs);
    inject(cathode, -von / rs);
  };

  for (let n = 1; n < net.nodeCount; n++) A[nodeIndex(n)][nodeIndex(n)] += GMIN;

  for (const c of circuit.components) {
    if (c.type === "resistor") {
      conduct(net.nodeOf(c.id, "a"), net.nodeOf(c.id, "b"), 1 / toBase(c.params.resistance));
    } else if (c.type === "switch" && c.params.closed) {
      conduct(net.nodeOf(c.id, "a"), net.nodeOf(c.id, "b"), 1 / SWITCH_R);
    } else if (isDiode(c) && mode === "normal" && diodeOn.has(c.id)) {
      stampDiode(net.nodeOf(c.id, "anode"), net.nodeOf(c.id, "cathode"), toBase(c.params.forward_voltage), LED_RS);
    } else if (isBjt(c) && mode === "normal") {
      const state = bjtState.get(c.id);
      if (state === "active" || state === "sat") {
        const t = bjtNodes(net, c);
        const p = bjtParams(c);
        stampDiode(t.da, t.dk, p.von, BJT_RBE); // junction base-emitter
        if (state === "active") {
          // Arus utama = hFE x arus base, dikendalikan oleh tegangan base-emitter.
          const gm = p.beta / BJT_RBE;
          add(t.ma, t.da, gm);
          add(t.ma, t.dk, -gm);
          add(t.mk, t.da, -gm);
          add(t.mk, t.dk, gm);
          inject(t.ma, gm * p.von);
          inject(t.mk, -gm * p.von);
        } else {
          // Jenuh: collector-emitter seperti sumber kecil Vce sat dengan hambatan seri.
          stampDiode(t.ma, t.mk, p.vsat, BJT_RSAT);
        }
      }
    }
    // Kapasitor, ground, voltmeter, dan komponen yang tidak aktif: tidak menambah apa pun.
  }

  sources.forEach((s, i) => {
    const row = nodeUnknowns + i;
    if (s.p > 0) {
      A[nodeIndex(s.p)][row] += 1;
      A[row][nodeIndex(s.p)] += 1;
    }
    if (s.n > 0) {
      A[nodeIndex(s.n)][row] -= 1;
      A[row][nodeIndex(s.n)] -= 1;
    }
    z[row] = s.volts;
  });

  if (probe) {
    inject(probe.red, 1);
    inject(probe.black, -1);
  }

  const x = solveLinear(A, z);
  const voltage = (n) => (n > 0 ? x[nodeIndex(n)] : 0);
  const sourceCurrent = new Map(); // arus yang mengalir dari kutub + lewat sumber ke kutub -
  sources.forEach((s, i) => sourceCurrent.set(s.id, x[nodeUnknowns + i]));
  return { voltage, sourceCurrent };
}

// ---------- Simulasi lengkap ----------
// Mengembalikan { ok, error, warnings, components: { [id]: { voltage, current, lit, conducting, overcurrent, display } } }

export function simulate(circuit) {
  if (circuit.components.length === 0) {
    return { ok: false, error: "The canvas is empty. Add components and wires first.", warnings: [], components: {} };
  }
  const net = buildNetlist(circuit);
  const diodes = circuit.components.filter(isDiode);
  const bjts = circuit.components.filter(isBjt);
  const warnings = [];

  try {
    // LED, dioda, dan transistor itu non-linear: tebak keadaannya, selesaikan, periksa,
    // ulangi sampai tebakannya konsisten dengan hasilnya.
    const diodeOn = new Set();
    const bjtState = new Map(bjts.map((c) => [c.id, "off"]));
    let solution = null;
    for (let attempt = 0; attempt < 40; attempt++) {
      solution = solveOnce(circuit, net, { mode: "normal", diodeOn, bjtState, probe: null });
      let changed = false;

      for (const d of diodes) {
        const vd =
          solution.voltage(net.nodeOf(d.id, "anode")) - solution.voltage(net.nodeOf(d.id, "cathode"));
        const vf = toBase(d.params.forward_voltage);
        if (diodeOn.has(d.id) && vd - vf < 0) {
          diodeOn.delete(d.id);
          changed = true;
        } else if (!diodeOn.has(d.id) && vd > vf) {
          diodeOn.add(d.id);
          changed = true;
        }
      }
      for (const t of bjts) {
        const current = bjtState.get(t.id);
        const next = nextBjtState(net, t, solution, current);
        if (next !== current) {
          bjtState.set(t.id, next);
          changed = true;
        }
      }
      if (!changed) break;
    }

    const components = {};
    for (const c of circuit.components) {
      const res = {};
      const v = (term) => solution.voltage(net.nodeOf(c.id, term));

      if (c.type === "resistor") {
        const raw = v("a") - v("b");
        res.voltage = cleanV(Math.abs(raw));
        res.current = cleanA(Math.abs(raw) / toBase(c.params.resistance));
      } else if (c.type === "switch") {
        const raw = v("a") - v("b");
        res.voltage = cleanV(raw);
        res.current = c.params.closed ? cleanA(raw / SWITCH_R) : 0;
      } else if (c.type === "capacitor") {
        res.voltage = cleanV(v("a") - v("b"));
        res.current = 0;
      } else if (c.type === "battery") {
        res.voltage = v("plus") - v("minus");
        res.current = cleanA(-(solution.sourceCurrent.get(c.id) ?? 0)); // arus yang diberikan ke rangkaian
      } else if (isDiode(c)) {
        res.voltage = v("anode") - v("cathode");
        const on = diodeOn.has(c.id);
        res.current = on ? (res.voltage - toBase(c.params.forward_voltage)) / LED_RS : 0;
        if (c.type === "led") res.lit = on;
        else res.conducting = on;
        const max = toBase(c.params.max_current);
        if (res.current > max) {
          res.overcurrent = true;
          const name = c.type === "led" ? "LED" : "Diode";
          warnings.push(`${name} ${c.id}: ${formatSI(res.current, "A")} exceeds its maximum (${formatSI(max, "A")}).`);
        }
      } else if (isBjt(c)) {
        const state = bjtState.get(c.id);
        const point = bjtOperatingPoint(net, c, solution, state);
        res.voltage = point.vce; // Vce untuk NPN, Vec untuk PNP (positif saat bekerja normal)
        res.current = cleanA(point.ic); // arus collector
        res.conducting = state !== "off";
        res.display = `${REGION_NAME[state]} \u00b7 ${formatSI(res.current, "A")}`;
      } else if (c.type === "multimeter") {
        const mode = c.params.mode;
        if (mode === "voltage") {
          res.voltage = cleanV(v("red") - v("black"));
          res.display = formatSI(res.voltage, "V");
        } else if (mode === "current") {
          res.current = cleanA(solution.sourceCurrent.get(c.id) ?? 0); // dari probe merah ke hitam
          res.display = formatSI(res.current, "A");
        } else {
          const red = net.nodeOf(c.id, "red");
          const black = net.nodeOf(c.id, "black");
          if (red === black) {
            res.display = "0 \u03a9";
          } else {
            const probed = solveOnce(circuit, net, { mode: "ohm", diodeOn, bjtState, probe: { red, black } });
            const ohms = probed.voltage(red) - probed.voltage(black);
            res.display = ohms > OPEN_OHMS ? "OL" : formatSI(ohms, "\u03a9");
          }
        }
      }
      components[c.id] = res;
    }

    // Peringatan: baterai mengalirkan arus tak wajar (hampir pasti korsleting lewat jalur tanpa hambatan).
    for (const c of circuit.components) {
      if (c.type === "battery" && Math.abs(components[c.id].current) > 100) {
        warnings.push(`Battery ${c.id}: ${formatSI(components[c.id].current, "A")} flows. This is probably a short circuit.`);
      }
    }

    return { ok: true, error: null, warnings, components };
  } catch (error) {
    return { ok: false, error: error.message, warnings: [], components: {} };
  }
}