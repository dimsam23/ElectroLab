// Sidebar komponen: komponen bisa di-drag ke kanvas, atau di-klik/di-tap untuk menambah otomatis.
// Memakai pointer events, jadi bekerja untuk mouse, layar sentuh, dan pen.

import { COMPONENT_TYPES } from "./components.js";
import { svgEl, drawShapes } from "./canvas.js";

const DRAG_THRESHOLD = 6; // px. Geser lebih dari ini = drag, kurang dari ini = klik/tap.

// Ikon kecil komponen, digambar dari data bentuk yang sama dengan kanvas.
function makeIcon(type) {
  const definition = COMPONENT_TYPES[type];
  const icon = svgEl("svg", {
    class: "palette-icon",
    viewBox: "-48 -36 96 72",
    "aria-hidden": "true",
  });
  const sample = { type, x: 0, y: 0, rotation: 0, params: definition.defaultParams() };
  drawShapes(icon, definition.shapes(sample));
  return icon;
}

function makeItem(type) {
  const item = document.createElement("button");
  item.type = "button";
  item.className = "palette-item";
  item.dataset.type = type;

  const name = document.createElement("span");
  name.textContent = COMPONENT_TYPES[type].label;

  item.appendChild(makeIcon(type));
  item.appendChild(name);
  return item;
}

// container: elemen sidebar. canvas: objek dari createCanvas.
// onPlace(type, point): dipanggil saat komponen dilepas di kanvas.
// point berisi koordinat kanvas, atau null kalau pengguna hanya klik/tap.
export function setupPalette(container, canvas, onPlace) {
  for (const type of Object.keys(COMPONENT_TYPES)) {
    container.appendChild(makeItem(type));
  }

  container.addEventListener("pointerdown", (event) => {
    const item = event.target.closest("[data-type]");
    if (!item || event.button !== 0) return;
    event.preventDefault();
    startDrag(item, event);
  });

  // Keyboard (Enter/Space) menghasilkan click dengan detail 0: tambahkan komponen.
  container.addEventListener("click", (event) => {
    const item = event.target.closest("[data-type]");
    if (item && event.detail === 0) onPlace(item.dataset.type, null);
  });

  function startDrag(item, startEvent) {
    const type = item.dataset.type;
    let ghost = null; // salinan item yang mengikuti pointer selama drag
    let grabX = 0; // posisi pegangan di dalam ghost, supaya ghost berada di bawah pointer
    let grabY = 0;

    function moveGhost(event) {
      ghost.style.left = `${event.clientX - grabX}px`;
      ghost.style.top = `${event.clientY - grabY}px`;
    }

    function onMove(event) {
      const distance = Math.hypot(
        event.clientX - startEvent.clientX,
        event.clientY - startEvent.clientY
      );
      if (!ghost && distance > DRAG_THRESHOLD) {
        ghost = item.cloneNode(true);
        ghost.classList.add("palette-ghost");
        ghost.style.width = `${item.offsetWidth}px`;
        grabX = item.offsetWidth / 2;
        grabY = 20;
        document.body.appendChild(ghost);
      }
      if (ghost) moveGhost(event);
    }

    function cleanup() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", cleanup);
      if (ghost) ghost.remove();
    }

    function onUp(event) {
      const wasDrag = ghost !== null;
      cleanup();
      if (!wasDrag) {
        onPlace(type, null); // klik/tap: tempatkan otomatis di posisi kosong
      } else if (canvas.isOver(event.clientX, event.clientY)) {
        onPlace(type, canvas.toCanvasPoint(event.clientX, event.clientY));
      }
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", cleanup);
  }
}