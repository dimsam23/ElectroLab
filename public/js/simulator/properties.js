// Panel Properties: mengubah nilai komponen yang sedang dipilih, memutar, dan menghapus.
// Daftar kolom yang tampil berasal dari `fields` di components.js.

import { COMPONENT_TYPES } from "./components.js";
import { findComponent, findJunction, findWire } from "./circuit.js";

// Membuat elemen HTML sederhana.
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (name === "text") node.textContent = value;
    else node.setAttribute(name, value);
  }
  for (const child of children) node.appendChild(child);
  return node;
}

function endLabel(circuit, end) {
  if (end.junction) return `Junction ${end.junction}`;
  const component = findComponent(circuit, end.component);
  const label = component ? COMPONENT_TYPES[component.type].label : "?";
  return `${label} ${end.component} (${end.terminal})`;
}

// Mengubah teks isian menjadi angka. Boleh pakai koma desimal ("4,7"). null = tidak valid.
// Nilai harus lebih besar dari 0.
function parseValue(text) {
  const normalized = text.trim().replace(",", ".");
  if (normalized === "") return null;
  const number = Number(normalized);
  return Number.isFinite(number) && number > 0 ? number : null;
}

// handlers: { getSelection, onParamChange, onParamChangeStart, onRotate, onDelete }
export function createProperties(container, circuit, handlers) {
    function numberField(component, field) {
    const param = component.params[field.key];
    const id = `prop-${component.id}-${field.key}`;

    const input = el("input", {
      type: "text",
      id,
      inputmode: "decimal",
      autocomplete: "off",
      value: String(param.value),
    });
    // Kolom tanpa `units` (misalnya gain transistor) tidak punya pilihan satuan.
    const unit = field.units
      ? el(
          "select",
          { "aria-label": `${field.label} unit` },
          field.units.map((u) => {
            const option = el("option", { value: u, text: u });
            if (u === param.unit) option.selected = true;
            return option;
          })
        )
      : null;

    input.addEventListener("focus", () => {
      if (handlers.onParamChangeStart) handlers.onParamChangeStart();
    });
    input.addEventListener("input", () => {
      const value = parseValue(input.value);
      input.setAttribute("aria-invalid", value === null ? "true" : "false");
      if (value === null) return; // tunggu sampai isiannya valid
      param.value = value;
      handlers.onParamChange();
    });
    // Saat kolom ditinggalkan dan isinya tidak valid, kembalikan ke nilai terakhir yang benar.
    input.addEventListener("change", () => {
      if (parseValue(input.value) === null) {
        input.value = String(param.value);
        input.setAttribute("aria-invalid", "false");
      }
    });
    if (unit) {
      unit.addEventListener("change", () => {
        if (handlers.onParamChangeStart) handlers.onParamChangeStart();
        param.unit = unit.value;
        handlers.onParamChange();
      });
    }

    return el("div", { class: "field" }, [
      el("label", { for: id, text: field.label }),
      el("div", { class: "input-group" }, unit ? [input, unit] : [input]),
    ]);
  }

  function toggleField(component, field) {
    const id = `prop-${component.id}-${field.key}`;
    const select = el("select", { id }, [
      el("option", { value: "on", text: field.onLabel }),
      el("option", { value: "off", text: field.offLabel }),
    ]);
    select.value = component.params[field.key] ? "on" : "off";
    select.addEventListener("change", () => {
      if (handlers.onParamChangeStart) handlers.onParamChangeStart();
      component.params[field.key] = select.value === "on";
      handlers.onParamChange();
    });
    return el("div", { class: "field" }, [el("label", { for: id, text: field.label }), select]);
  }

  // Pilihan dari daftar (misalnya mode multimeter). field.options = [{ value, label }]
  function selectField(component, field) {
    const id = `prop-${component.id}-${field.key}`;
    const select = el(
      "select",
      { id },
      field.options.map((o) => el("option", { value: o.value, text: o.label }))
    );
    select.value = component.params[field.key];
    select.addEventListener("change", () => {
      if (handlers.onParamChangeStart) handlers.onParamChangeStart();
      component.params[field.key] = select.value;
      handlers.onParamChange();
    });
    return el("div", { class: "field" }, [el("label", { for: id, text: field.label }), select]);
  }

  function actionButtons(withRotate) {
    const row = el("div", { class: "btn-row prop-actions" });
    if (withRotate) {
      const rotate = el("button", { type: "button", class: "btn btn-outline", text: "↻ Rotate (R)" });
      rotate.addEventListener("click", handlers.onRotate);
      row.appendChild(rotate);
    }
    const remove = el("button", { type: "button", class: "btn btn-outline btn-danger", text: "Delete (Del)" });
    remove.addEventListener("click", handlers.onDelete);
    row.appendChild(remove);
    return row;
  }

  // Dipanggil saat pilihan berubah (bukan setiap kali nilai diketik,
  // supaya kolom isian tidak kehilangan fokus).
  function render() {
    container.replaceChildren();
    const selection = handlers.getSelection();
    
    // Handle array selection (multiple items selected)
    if (Array.isArray(selection)) {
      container.appendChild(el("p", { class: "prop-title", text: `${selection.length} items selected` }));
      container.appendChild(
        el("p", {
          class: "hint",
          text: "Multiple selection. You can cut, copy, or delete these items.",
        })
      );
      return;
    }
    
    const component = selection?.kind === "component" && findComponent(circuit, selection.id);
    const wire = selection?.kind === "wire" && findWire(circuit, selection.id);
    const junction = selection?.kind === "junction" && findJunction(circuit, selection.id);

    if (component) {
      const definition = COMPONENT_TYPES[component.type];
      container.appendChild(el("p", { class: "prop-title", text: `${definition.label} · ${component.id}` }));
      if (definition.fields.length === 0) {
        container.appendChild(el("p", { class: "hint", text: "This component has no editable values." }));
      }
      for (const field of definition.fields) {
        const build =
          field.type === "toggle" ? toggleField : field.type === "select" ? selectField : numberField;
        container.appendChild(build(component, field));
      }
      container.appendChild(actionButtons(true));
    } else if (junction) {
      container.appendChild(el("p", { class: "prop-title", text: `Junction · ${junction.id}` }));
      container.appendChild(
        el("p", {
          class: "hint",
          text: "Connection point (checkpoint). Drag to move it, double-tap it to continue wiring from here.",
        })
      );
      container.appendChild(actionButtons(false));
    } else if (wire) {
      container.appendChild(el("p", { class: "prop-title", text: `Wire · ${wire.id}` }));
      container.appendChild(
        el("p", {
          class: "hint",
          text: `${endLabel(circuit, wire.from)} → ${endLabel(circuit, wire.to)}`,
        })
      );
      container.appendChild(actionButtons(false));
    } else {
      container.appendChild(
        el("p", {
          class: "hint",
          text: "Select a component to edit its values, or a wire to delete it.",
        })
      );
    }
  }

  return { render };
}