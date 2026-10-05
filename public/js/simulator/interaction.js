// Interaksi di kanvas: pilih & geser komponen/junction, membuat kabel dengan checkpoint,
// dan pintasan keyboard.
//
// Cara kerja kabel ("sesi kabel", mirip net tool di Eagle):
//   1. Tekan sebuah kaki komponen -> sesi dimulai, garis putus-putus mengikuti pointer.
//   2. Klik/lepas di ruang kosong -> kabel dibuat sampai titik itu (dengan siku 90 derajat),
//      lalu sesi berlanjut dari titik tersebut.
//   3. Spasi atau klik kanan = balik arah siku (mendatar dulu / tegak dulu).
//   4. Klik kaki komponen atau titik lain -> kabel tersambung, sesi selesai.
//   5. Klik titik terakhir lagi, atau Esc -> berhenti di situ (kabel yang sudah jadi tetap ada).
//   Titik berhenti yang masih ujung bebas bisa dilanjutkan dengan mengkliknya.
// Pointer events dipakai supaya jalan di mouse, layar sentuh, dan pen.

import {
  snap,
  clampToCanvas,
  findComponent,
  findJunction,
  findWire,
  findEndNear,
  endKey,
  endPosition,
  addJunction,
  addWire,
  findConnectedWires,
} from "./circuit.js";
import { routePoints, endAxis, wirePoints } from "./wiring.js";

// Parameter untuk callback keyboard shortcuts
let saveToHistoryCallback = null;
export function setHistoryCallback(callback) {
  saveToHistoryCallback = callback;
}

const MOVE_THRESHOLD = 4; // satuan kanvas. Geser kurang dari ini = hanya klik.
const SNAP_RADIUS = 18; // jarak (satuan kanvas) ujung kabel "menempel" ke kaki/junction.
const DOUBLE_TAP_MS = 350;

// refresh({ panel }): gambar ulang kanvas; panel=false = jangan bangun ulang panel Properties.
// actions: { deleteSelection, rotateSelection }
// keyboardActions: { handleUndo, handleRedo, handleCopy, handleCut, handlePaste, handleSelectAll }
export function setupInteraction({ svg, canvas, circuit, state, refresh, actions, keyboardActions = {} }) {
  let session = null; // { from, dragging, startPoint, lastPoint, flip } selama kabel sedang dibuat
  let lastTap = { key: null, time: 0 };

  const pointOf = (event) => canvas.toCanvasPoint(event.clientX, event.clientY);

  // ---- Sesi kabel ----

  function beginSession(from, dragging, startPoint) {
    session = { from, dragging, startPoint, lastPoint: startPoint, flip: false };
    state.selected = null;
    state.wiring = true; // main.js menampilkan petunjuk "sedang menarik kabel"
    updatePreview(startPoint);
    window.addEventListener("pointermove", onSessionMove);
    window.addEventListener("pointerup", onSessionUp);
    window.addEventListener("pointerdown", onOutsideDown, true);
  }

  function endSession(selectWire = null) {
    window.removeEventListener("pointermove", onSessionMove);
    window.removeEventListener("pointerup", onSessionUp);
    window.removeEventListener("pointerdown", onOutsideDown, true);
    session = null;
    state.wiring = false;
    state.preview = null;
    state.snap = null;
    if (selectWire) state.selected = { kind: "wire", id: selectWire.id };
    refresh();
  }

  // Arah segmen pertama sebuah jalur: "h" (mendatar) atau "v" (tegak).
  const firstAxis = (points) => (points.length > 1 && points[1].x !== points[0].x ? "h" : "v");

  // Jalur dari ujung awal sesi ke endPos. Kalau siku dibalik (session.flip), segmen pertama
  // dipaksa ke arah sebaliknya dan `bend` dikembalikan supaya tersimpan di kabel.
  function routeFor(startPos, endPos, endAxisValue) {
    const auto = routePoints(startPos, endAxis(circuit, session.from), endPos, endAxisValue);
    if (!session.flip) return { points: auto, bend: null };
    const bend = firstAxis(auto) === "h" ? "v" : "h";
    return { points: routePoints(startPos, bend, endPos, null), bend };
  }

  // Menggambar garis putus-putus dari ujung awal ke pointer (atau ke ujung yang tertempel).
  function updatePreview(point) {
    session.lastPoint = point;
    const startPos = endPosition(circuit, session.from);
    const near = findEndNear(circuit, point, SNAP_RADIUS, session.from);
    const endPos = near ? endPosition(circuit, near) : { x: snap(point.x), y: snap(point.y) };
    state.snap = near;
    state.preview = { points: routeFor(startPos, endPos, near ? endAxis(circuit, near) : null).points };
    refresh({ panel: false });
  }

  // Membalik arah siku (Spasi atau klik kanan).
  function flipCorner() {
    session.flip = !session.flip;
    updatePreview(session.lastPoint);
  }

  // Dipanggil saat pengguna "mengonfirmasi" sebuah titik (klik, atau lepas setelah drag).
  function commitAt(event) {
    const point = pointOf(event);
    let hit = findEndNear(circuit, point, SNAP_RADIUS);

    // Jika terminal komponen sudah terhubung, abaikan snap otomatis
    if (hit && hit.component) {
      const occupied = circuit.wires.some(w =>
        (w.from.component === hit.component && w.from.terminal === hit.terminal) ||
        (w.to.component === hit.component && w.to.terminal === hit.terminal)
      );
      if (occupied) hit = null;
    }

    if (hit && endKey(hit) === endKey(session.from)) return endSession(); // klik titik terakhir = berhenti
    if (hit) {
      // Sambung ke kaki/titik lain, lalu selesai.
      const route = routeFor(endPosition(circuit, session.from), endPosition(circuit, hit), endAxis(circuit, hit));
      if (saveToHistoryCallback) saveToHistoryCallback();
      return endSession(addWire(circuit, session.from, hit, route.bend));
    }

    // Klik di atas badan komponen (bukan kakinya): abaikan.
    if (event.target.closest?.("[data-component-id]")) return;

    // Periksa apakah klik mengenai wire lain untuk membuat junction penyambung
    // Jangan lakukan jika posisi klik terlalu dekat dengan terminal/junction yang ada (sudah ditangani oleh `hit`)
    const hitWire = circuit.wires.find(w => {
      const pts = wirePoints(circuit, w);
      if (!pts) return false;
      for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i], p2 = pts[i + 1];
        const dist = Math.abs((p2.x - p1.x)*(p1.y - point.y) - (p1.x - point.x)*(p2.y - p1.y)) / Math.hypot(p2.x - p1.x, p2.y - p1.y);
        if (dist < 8) return true;
      }
      return false;
    });

    let target = hitWire ? { junction: addJunction(circuit, snap(point.x), snap(point.y)).id } 
                        : { x: snap(point.x), y: snap(point.y) };

    // Jika klik pada wire, bagi wire menjadi dua bagian lewat junction baru
    if (hitWire) {
      const jId = target.junction;
      const original = hitWire;
      // Simpan ujung-ujung lama
      const oldFrom = original.from;
      const oldTo = original.to;
      // Hapus wire lama
      circuit.wires = circuit.wires.filter(w => w.id !== original.id);
      // Tambah dua wire baru
      addWire(circuit, oldFrom, { junction: jId });
      addWire(circuit, { junction: jId }, oldTo);
    }

    const route = routeFor(endPosition(circuit, session.from), endPosition(circuit, target), null);
    if (saveToHistoryCallback) saveToHistoryCallback();
    addWire(circuit, session.from, target, route.bend);

    // Selalu lanjutkan wiring ke segmen berikutnya
    session.from = target;
    session.dragging = false;
    session.flip = false;
    updatePreview(point);
  }

  function onSessionMove(event) {
    if (session) updatePreview(pointOf(event));
  }

  function onSessionUp(event) {
    if (!session || !session.dragging) return;
    const point = pointOf(event);
    const moved = Math.hypot(point.x - session.startPoint.x, point.y - session.startPoint.y);
    if (moved < MOVE_THRESHOLD) {
      session.dragging = false; // hanya klik: lanjut dengan mode klik-klik
      return;
    }
    commitAt(event);
  }

  // Klik di luar kanvas (sidebar, panel, dll.) membatalkan sesi.
  function onOutsideDown(event) {
    if (session && !svg.contains(event.target)) endSession();
  }

  // ---- Pointer di kanvas ----

  svg.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;

    if (session) {
      // Sesi mode klik-klik: klik berikutnya menentukan titik kabel.
      if (!session.dragging) {
        event.preventDefault();
        commitAt(event);
      }
      return;
    }

    const target = event.target;
    const componentEl = target.closest("[data-component-id]");
    const terminalEl = target.closest("[data-terminal]");
    const junctionEl = target.closest("[data-junction-id]");
    const wireEl = target.closest("[data-wire-id]");

    if (componentEl && terminalEl) {
      // Mulai kabel dari kaki komponen.
      event.preventDefault();
      const from = { component: componentEl.dataset.componentId, terminal: terminalEl.dataset.terminal };
      beginSession(from, true, pointOf(event));
    } else if (junctionEl) {
      event.preventDefault();
      const id = junctionEl.dataset.junctionId;
      const startPoint = pointOf(event);
      if (isDoubleTap(`junction:${id}`)) {
        // Ketuk dua kali pada titik = lanjutkan kabel dari sini.
        beginSession({ junction: id }, false, startPoint);
      } else {
        // Geser = pindahkan titik. Klik saja pada ujung bebas (hanya satu kabel) = lanjutkan kabel.
        startMove("junction", id, event, () => {
          if (wireCount(id) === 1) beginSession({ junction: id }, false, startPoint);
        });
      }
    } else if (componentEl) {
      event.preventDefault();
      const id = componentEl.dataset.componentId;
      const component = findComponent(circuit, id);
      if (component?.type === "switch" && isDoubleTap(`component:${id}`)) {
        component.params.closed = !component.params.closed; // ketuk dua kali pada saklar = ON/OFF
        refresh();
      } else {
        startMove("component", id, event);
      }
    } else if (wireEl) {
      event.preventDefault();
      const wireId = wireEl.dataset.wireId;
      const point = pointOf(event);
      const wire = circuit.wires.find((w) => w.id === wireId);

      // Jika kabel bebas (kedua ujung koordinat), izinkan drag untuk memindahnya.
      if (wire && typeof wire.from.x === "number" && typeof wire.to.x === "number") {
        // Mulai drag wire
        const original = { from: { ...wire.from }, to: { ...wire.to } };
        const start = point;
        let moved = false;
        function onMove(ev) {
          const p = pointOf(ev);
          if (!moved && Math.hypot(p.x - start.x, p.y - start.y) < MOVE_THRESHOLD) return;
          moved = true;
          const dx = p.x - start.x;
          const dy = p.y - start.y;
          wire.from.x = original.from.x + dx;
          wire.from.y = original.from.y + dy;
          wire.to.x = original.to.x + dx;
          wire.to.y = original.to.y + dy;
          refresh({ panel: false });
        }
        function onUp() {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          if (moved && saveToHistoryCallback) saveToHistoryCallback();
        }
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        return;
      }

      let continued = false;
      if (wire) {
        // Cek apakah ujung kabel ini terhubung ke kabel lain
        const isFree = (end) => {
          const key = endKey(end);
          return circuit.wires.filter(w => endKey(w.from) === key || endKey(w.to) === key).length === 1;
        };

        if (typeof wire.from.x === "number" && isFree(wire.from)) {
          const distToStart = Math.hypot(point.x - wire.from.x, point.y - wire.from.y);
          if (distToStart < SNAP_RADIUS) {
            beginSession({ x: wire.from.x, y: wire.from.y }, false, point);
            continued = true;
          }
        }
        if (!continued && typeof wire.to.x === "number" && isFree(wire.to)) {
          const distToEnd = Math.hypot(point.x - wire.to.x, point.y - wire.to.y);
          if (distToEnd < SNAP_RADIUS) {
            beginSession({ x: wire.to.x, y: wire.to.y }, false, point);
            continued = true;
          }
        }
      }

      if (!continued) {
        // Select semua kabel yang terhubung (net)
        const connected = findConnectedWires(circuit, wireId);
        state.selected = connected.map(w => ({ kind: "wire", id: w.id }));
        refresh();
      }
    } else {
      // Klik di space kosong: deselect jika ada yang terpilih, atau mulai marquee jika digeser
      startMarquee(event);
    }
  });

  function startMarquee(startEvent) {
    const start = pointOf(startEvent);
    let moved = false;
    const marquee = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    marquee.setAttribute("fill", "rgba(0, 120, 215, 0.2)");
    marquee.setAttribute("stroke", "rgba(0, 120, 215, 0.5)");
    marquee.setAttribute("stroke-dasharray", "4");
    svg.appendChild(marquee);

    function onMove(e) {
      const p = pointOf(e);
      if (!moved && Math.hypot(p.x - start.x, p.y - start.y) < MOVE_THRESHOLD) return;
      moved = true;

      const x = Math.min(start.x, p.x);
      const y = Math.min(start.y, p.y);
      const w = Math.abs(start.x - p.x);
      const h = Math.abs(start.y - p.y);
      marquee.setAttribute("x", x);
      marquee.setAttribute("y", y);
      marquee.setAttribute("width", w);
      marquee.setAttribute("height", h);
    }

    function onUp(e) {
      svg.removeChild(marquee);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);

      const p = pointOf(e);
      if (!moved) {
        // Hanya klik di space kosong -> deselect
        if (state.selected) {
          state.selected = null;
          refresh();
        }
        return;
      }

      // Marquee selection selesai
      const x1 = Math.min(start.x, p.x);
      const y1 = Math.min(start.y, p.y);
      const x2 = Math.max(start.x, p.x);
      const y2 = Math.max(start.y, p.y);

      const selected = [];
      for (const comp of circuit.components) {
        if (comp.x >= x1 && comp.x <= x2 && comp.y >= y1 && comp.y <= y2) {
          selected.push({ kind: "component", id: comp.id });
        }
      }
      for (const junc of circuit.junctions) {
        if (junc.x >= x1 && junc.x <= x2 && junc.y >= y1 && junc.y <= y2) {
          selected.push({ kind: "junction", id: junc.id });
        }
      }

      state.selected = selected.length > 0 ? selected : null;
      refresh();
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // Dua ketukan pada target yang sama dalam waktu singkat. (Tidak memakai event dblclick
  // karena kanvas digambar ulang di antara dua klik, sehingga dblclick tidak andal.)
  function isDoubleTap(key) {
    const now = performance.now();
    const isDouble = lastTap.key === key && now - lastTap.time < DOUBLE_TAP_MS;
    lastTap = isDouble ? { key: null, time: 0 } : { key, time: now };
    return isDouble;
  }

  // ---- Menggeser komponen / junction ----
  const wireCount = (junctionId) =>
    circuit.wires.filter((w) => w.from.junction === junctionId || w.to.junction === junctionId).length;

  // onClick: dipanggil kalau pointer dilepas tanpa menggeser (hanya klik).
  function startMove(kind, id, startEvent, onClick = null) {
    const item = kind === "junction" ? findJunction(circuit, id) : findComponent(circuit, id);
    if (!item) return;
    
    // Jika sudah ada multiple selection dan item ini bagian dari selection, gerakkan semua
    const isMultipleSelection = Array.isArray(state.selected) && state.selected.length > 0;
    const isPartOfSelection = isMultipleSelection && state.selected.some(s => s.kind === kind && s.id === id);
    
    if (!isPartOfSelection) {
      state.selected = { kind, id };
      refresh();
    }

    // Simpan origin untuk semua item yang akan digeser
    const itemsToMove = [];
    if (isPartOfSelection) {
      // Multi-selection: siapkan semua item yang dipilih
      for (const sel of state.selected) {
        const it = sel.kind === "junction" ? findJunction(circuit, sel.id) : findComponent(circuit, sel.id);
        if (it) itemsToMove.push({ item: it, origin: { x: it.x, y: it.y } });
      }
    } else {
      // Single selection
      itemsToMove.push({ item, origin: { x: item.x, y: item.y } });
    }

    const start = pointOf(startEvent);
    const margin = kind === "junction" ? 20 : 60;
    let moved = false;
    let isRotating = false;

    function onMove(event) {
      const point = pointOf(event);
      if (!moved && Math.hypot(point.x - start.x, point.y - start.y) < MOVE_THRESHOLD) return;
      moved = true;
      
      // Jika sedang rotate, jangan gerak posisi
      if (isRotating) return;
      
      const deltaX = point.x - start.x;
      const deltaY = point.y - start.y;
      
      // Gerakkan semua item
      for (const { item: it, origin } of itemsToMove) {
        const next = clampToCanvas(
          snap(origin.x + deltaX),
          snap(origin.y + deltaY),
          margin
        );
        it.x = next.x;
        it.y = next.y;
      }
      refresh({ panel: false });
    }

    function onKeyDown(e) {
      if ((e.key === 'r' || e.key === 'R') && kind === 'component') {
        isRotating = true;
        e.preventDefault();
        // Rotate semua komponen yang digeser
        for (const { item: it } of itemsToMove) {
          if (it.rotation !== undefined) {
            it.rotation = (it.rotation + 90) % 360;
          }
        }
        refresh({ panel: false });
      }
    }

    function onKeyUp(e) {
      if (e.key === 'r' || e.key === 'R') {
        isRotating = false;
      }
    }

    function stop() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", stop);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    }
    function onUp() {
      stop();
      if (moved && saveToHistoryCallback) saveToHistoryCallback();
      if (!moved && onClick) onClick();
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", stop);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
  }

  // Klik kanan saat menarik kabel = balik arah siku (bukan menu browser).
  svg.addEventListener("contextmenu", (event) => {
    if (!session) return;
    event.preventDefault();
    flipCorner();
  });

  // ---- Keyboard ----
  document.addEventListener("keydown", (event) => {
    if (session && event.key === " ") {
      event.preventDefault();
      flipCorner();
      return;
    }
    // Jangan ganggu saat pengguna sedang mengetik di kolom Properties.
    if (event.target instanceof Element && event.target.closest("input, select, textarea")) return;

    // Handle keyboard shortcuts dengan Ctrl/Cmd
    const isCtrlOrCmd = event.ctrlKey || event.metaKey;
    if (isCtrlOrCmd) {
      if (event.key === "z" || event.key === "Z") {
        event.preventDefault();
        if (keyboardActions.handleUndo) keyboardActions.handleUndo();
        return;
      } else if (event.key === "y" || event.key === "Y") {
        event.preventDefault();
        if (keyboardActions.handleRedo) keyboardActions.handleRedo();
        return;
      } else if (event.key === "c" || event.key === "C") {
        event.preventDefault();
        if (keyboardActions.handleCopy) keyboardActions.handleCopy();
        return;
      } else if (event.key === "x" || event.key === "X") {
        event.preventDefault();
        if (keyboardActions.handleCut) keyboardActions.handleCut();
        return;
      } else if (event.key === "v" || event.key === "V") {
        event.preventDefault();
        if (keyboardActions.handlePaste) keyboardActions.handlePaste();
        return;
      } else if (event.key === "a" || event.key === "A") {
        event.preventDefault();
        if (keyboardActions.handleSelectAll) keyboardActions.handleSelectAll();
        return;
      }
    }

    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (event.key === "Escape") {
      if (session) endSession();
      else if (state.selected) {
        state.selected = null;
        refresh();
      }
    } else if (event.key === "Delete" || event.key === "Backspace") {
      if (state.selected) {
        event.preventDefault();
        actions.deleteSelection();
      }
    } else if (event.key === "r" || event.key === "R") {
      if (state.selected?.kind === "component") actions.rotateSelection();
    }
  });
}