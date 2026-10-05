// Menentukan jalur kabel (tanpa DOM). Kabel digambar siku-siku mengikuti grid.
// Data kabel hanya menyimpan ujung asal dan tujuan; jalurnya dihitung ulang
// setiap kali digambar, jadi kabel otomatis mengikuti saat komponen/junction digeser.

import { terminalAxis } from "./components.js";
import { endPosition, findComponent, snap } from "./circuit.js";

// Arah keluar sebuah ujung: "h" / "v" untuk kaki komponen, null untuk junction (bebas arah).
export function endAxis(circuit, end) {
  if (end.junction || (end.x !== undefined && end.y !== undefined)) return null;
  const component = findComponent(circuit, end.component);
  return component ? terminalAxis(component, end.terminal) : null;
}

// Menghapus titik ganda dan titik yang segaris supaya polyline rapi.
function simplify(points) {
  const result = [];
  for (const point of points) {
    const last = result[result.length - 1];
    if (last && last.x === point.x && last.y === point.y) continue;
    result.push(point);
  }
  for (let i = result.length - 2; i > 0; i--) {
    const a = result[i - 1];
    const b = result[i];
    const c = result[i + 1];
    if ((a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)) result.splice(i, 1);
  }
  return result;
}

// Jalur siku-siku dari p1 ke p2. axis1/axis2 = arah keluar ujung ("h"/"v"/null).
// null = bebas (junction, atau ujung kabel yang sedang ditarik).
export function routePoints(p1, axis1, p2, axis2) {
  // Kalau hanya ujung awal yang bebas, hitung dari sisi lain lalu balikkan urutannya.
  if (axis1 === null && axis2 !== null) return routePoints(p2, axis2, p1, null).reverse();
  if (axis1 === null) axis1 = "h";

  let points;
  if (axis1 === axis2) {
    // Sama-sama mendatar (atau tegak): bentuk "Z" lewat titik tengah.
    if (axis1 === "h") {
      const mid = snap((p1.x + p2.x) / 2);
      points = [p1, { x: mid, y: p1.y }, { x: mid, y: p2.y }, p2];
    } else {
      const mid = snap((p1.y + p2.y) / 2);
      points = [p1, { x: p1.x, y: mid }, { x: p2.x, y: mid }, p2];
    }
  } else if (axis1 === "h") {
    points = [p1, { x: p2.x, y: p1.y }, p2]; // bentuk "L"
  } else {
    points = [p1, { x: p1.x, y: p2.y }, p2];
  }
  return simplify(points);
}

// Jalur untuk kabel yang sudah tersimpan. Mengembalikan null kalau ujungnya hilang.
export function wirePoints(circuit, wire) {
  const p1 = endPosition(circuit, wire.from);
  const p2 = endPosition(circuit, wire.to);
  if (!p1 || !p2) return null;
  return routePoints(p1, endAxis(circuit, wire.from), p2, endAxis(circuit, wire.to));
}