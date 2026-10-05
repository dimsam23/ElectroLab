// calculator.js - Tambahkan import untuk calc_history.js
import { saveCalcHistory } from "./utils/calc_history.js";

const API = "/api/calculators";
const MIN_RESISTORS = 2;
const MAX_RESISTORS = 20; // sama dengan batas di server (resistor.py)

let options = null; // daftar satuan & warna dari server

const FIELD_LABELS = {
  voltage: "Voltage",
  current: "Current",
  resistance: "Resistance",
  power: "Power",
  capacitance: "Capacitance",
  time_constant: "Time constant",
  time: "Time",
  energy: "Energy",
};

// ---------- Fungsi bantu ----------

// Membuat elemen HTML. Teks diisi lewat textContent (aman dari HTML injection).
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Mengirim data ke API dan selalu mengembalikan objek { ok, ... }.
async function callApi(path, payload) {
  let response;
  try {
    response = await fetch(`${API}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    return { ok: false, error: "Could not reach the server. Is it running?" };
  }
  try {
    return await response.json();
  } catch (error) {
    return { ok: false, error: "Unexpected response from the server." };
  }
}

// Mengisi <select> dengan daftar satuan untuk satu besaran (misalnya "voltage").
function fillSelect(select, quantity) {
  const info = options.units[quantity];
  // Satuan awal: boleh diatur lewat data-default-unit di HTML, kalau tidak pakai satuan dasar.
  const preferred = select.dataset.defaultUnit || info.base;
  select.replaceChildren();
  for (const unit of info.units) {
    const option = el("option", "", unit);
    option.value = unit;
    if (unit === preferred) {
      option.defaultSelected = true; // supaya tombol Clear kembali ke satuan awal
      option.selected = true;
    }
    select.appendChild(option);
  }
}

// Catat ke History (dibuat di Phase 7). Kalau belum ada, tidak terjadi apa-apa.
function recordHistory(title, result) {
  if (window.ElectroLabHistory && typeof window.ElectroLabHistory.add === "function") {
    window.ElectroLabHistory.add({
      calculator: title,
      display: result.display,
      formula: result.formula,
      working: result.working,
      time: Date.now(),
    });
  }
}

// ---------- Menampilkan hasil ----------

function renderError(box, message) {
  box.replaceChildren();
  const error = el("div", "error-box");
  error.appendChild(el("strong", "", "⚠ Calculation error"));
  error.appendChild(el("p", "", message));
  box.appendChild(error);
}

function detail(label, text) {
  const line = el("p", "detail");
  line.appendChild(el("span", "detail-label", label));
  line.appendChild(el("code", "", text));
  return line;
}

// settings.title: judul kotak hasil.
// settings.entered: nama input yang diisi pengguna. Nilai lainnya ditandai sebagai hasil hitung.
// settings.extras: daftar [label, teks] tambahan, misalnya toleransi.
function renderResult(box, result, settings = {}) {
  const block = el("div", "result-box");
  block.appendChild(el("h3", "result-title", settings.title || "Result"));

  const grid = el("div", "result-grid");
  for (const [field, text] of Object.entries(result.display)) {
    const isSolved = settings.entered
      ? !settings.entered.has(field)
      : field === result.solved_for;
    const item = el("div", isSolved ? "result-item solved" : "result-item");
    item.appendChild(el("span", "result-label", FIELD_LABELS[field] || field));
    item.appendChild(el("span", "result-value", text));
    grid.appendChild(item);
  }
  for (const [label, text] of settings.extras || result.extras || []) {
    const item = el("div", "result-item");
    item.appendChild(el("span", "result-label", label));
    item.appendChild(el("span", "result-value", text));
    grid.appendChild(item);
  }
  block.appendChild(grid);

  if (result.formula) block.appendChild(detail("Formula", result.formula));
  if (result.working) block.appendChild(detail("Working", result.working));
  box.appendChild(block);
}

// ---------- Tab ----------

function showTab(id) {
  const panels = [...document.querySelectorAll(".calc-panel")];
  const exists = panels.some((panel) => panel.id === `panel-${id}`);
  const active = exists ? id : "ohm";

  for (const panel of panels) {
    panel.classList.toggle("active", panel.id === `panel-${active}`);
  }
  for (const tab of document.querySelectorAll(".tab")) {
    const isActive = tab.dataset.tab === active;
    tab.classList.toggle("active", isActive);
    if (isActive) tab.setAttribute("aria-current", "page");
    else tab.removeAttribute("aria-current");
  }
}

// ---------- Form umum (Ohm, Resistor, Power, RC) ----------

// Membaca semua .input-group di dalam form menjadi { nama: { value, unit } }.
function readQuantities(form) {
  const payload = {};
  const entered = new Set();
  for (const group of form.querySelectorAll(".input-group")) {
    const input = group.querySelector("input");
    const select = group.querySelector("select");
    const value = input.value.trim();
    payload[input.name] = { value, unit: select.value };
    if (value !== "") entered.add(input.name);
  }
  return { payload, entered };
}

function setupGenericForms() {
  for (const form of document.querySelectorAll("form[data-endpoint]")) {
    const box = form.parentElement.querySelector("[data-result]");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const { payload, entered } = readQuantities(form);
      const data = await callApi(form.dataset.endpoint, payload);

      if (!data.ok) {
        renderError(box, data.error);
        return;
      }
      box.replaceChildren();
      renderResult(box, data.result, { title: form.dataset.title, entered });
      recordHistory(form.dataset.title, data.result);
      // Simpan histori kalkulasi ke DB
      await saveCalcHistory(form.dataset.title, payload, data.result.display);
    });

    form.addEventListener("reset", () => box.replaceChildren());
  }
}

// ---------- Series / Parallel ----------

function setupSeriesParallel() {
  const form = document.getElementById("sp-form");
  const rows = document.getElementById("sp-rows");
  const addButton = document.getElementById("sp-add");
  const box = form.parentElement.querySelector("[data-result]");

  // Perbarui nomor R1, R2, ... dan status tombol setelah baris ditambah/dihapus.
  function refresh() {
    const items = rows.querySelectorAll(".sp-row");
    items.forEach((row, index) => {
      row.querySelector(".sp-label").textContent = `R${index + 1}`;
      row.querySelector("input").setAttribute("aria-label", `Resistor ${index + 1} value`);
      row.querySelector(".btn-icon").disabled = items.length <= MIN_RESISTORS;
    });
    addButton.disabled = items.length >= MAX_RESISTORS;
  }

  function addRow() {
    const row = el("div", "sp-row");
    const label = el("span", "sp-label");

    const group = el("div", "input-group");
    const input = el("input");
    input.type = "text";
    input.inputMode = "decimal";
    input.placeholder = "e.g. 100";
    input.autocomplete = "off";
    const select = el("select");
    select.setAttribute("aria-label", "Resistance unit");
    fillSelect(select, "resistance");
    group.append(input, select);

    const remove = el("button", "btn-icon", "✕");
    remove.type = "button";
    remove.setAttribute("aria-label", "Remove resistor");
    remove.addEventListener("click", () => {
      row.remove();
      refresh();
    });

    row.append(label, group, remove);
    rows.appendChild(row);
    refresh();
  }

  for (let i = 0; i < MIN_RESISTORS; i++) addRow();
  addButton.addEventListener("click", addRow);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const resistors = [...rows.querySelectorAll(".sp-row")].map((row) => ({
      value: row.querySelector("input").value.trim(),
      unit: row.querySelector("select").value,
    }));

    const [series, parallel] = await Promise.all([
      callApi("series", { resistors }),
      callApi("parallel", { resistors }),
    ]);

    if (!series.ok) return renderError(box, series.error);
    if (!parallel.ok) return renderError(box, parallel.error);

    box.replaceChildren();
    renderResult(box, series.result, { title: "Series" });
    renderResult(box, parallel.result, { title: "Parallel" });
    recordHistory("Resistors in Series", series.result);
    recordHistory("Resistors in Parallel", parallel.result);
    // Simpan ke DB
    await saveCalcHistory("Resistors in Series", resistors, series.result.display);
    await saveCalcHistory("Resistors in Parallel", resistors, parallel.result.display);
  });

  form.addEventListener("reset", () => box.replaceChildren());
}

// ---------- Unit Converter ----------

function setupConverter() {
  const form = document.getElementById("convert-form");
  const quantity = document.getElementById("conv-quantity");
  const value = document.getElementById("conv-value");
  const from = document.getElementById("conv-from");
  const to = document.getElementById("conv-to");
  const swap = document.getElementById("conv-swap");
  const box = form.parentElement.querySelector("[data-result]");

  for (const name of Object.keys(options.units)) {
    const option = el("option", "", FIELD_LABELS[name] || capitalize(name));
    option.value = name;
    quantity.appendChild(option);
  }

  // Isi dropdown satuan sesuai besaran yang dipilih.
  function loadUnits() {
    const info = options.units[quantity.value];
    fillSelect(from, quantity.value);
    fillSelect(to, quantity.value);
    // Satuan tujuan awal dibuat berbeda dari satuan asal.
    const other = info.units.find((unit) => unit !== info.base);
    for (const option of to.options) {
      option.defaultSelected = option.value === other;
    }
    to.value = other;
    box.replaceChildren();
  }

  quantity.addEventListener("change", loadUnits);
  swap.addEventListener("click", () => {
    const oldFrom = from.value;
    from.value = to.value;
    to.value = oldFrom;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = await callApi("convert", {
      quantity: quantity.value,
      value: value.value.trim(),
      from: from.value,
      to: to.value,
    });

    if (!data.ok) return renderError(box, data.error);

    box.replaceChildren();
    const block = el("div", "result-box");
    block.appendChild(el("h3", "result-title", "Conversion"));
    const grid = el("div", "result-grid");
    const item = el("div", "result-item solved");
    item.appendChild(el("span", "result-label", "Result"));
    item.appendChild(el("span", "result-value", data.result.display));
    grid.appendChild(item);
    block.appendChild(grid);
    block.appendChild(detail("Formula", data.result.formula));
    block.appendChild(detail("Working", data.result.working));
    box.appendChild(block);
    recordHistory("Unit Converter", {
      display: { result: data.result.display },
      formula: data.result.formula,
      working: data.result.working,
    });
    // Simpan ke DB
    await saveCalcHistory("Unit Converter", { quantity: quantity.value, from: from.value, to: to.value }, { result: data.result.display });
  });

  form.addEventListener("reset", () => {
    // Setelah reset, isi ulang dropdown satuan sesuai besaran awal.
    setTimeout(loadUnits, 0);
  });

  loadUnits();
}

// ---------- Resistor Color Code ----------

function setupColorCode() {
  const bandsCountSelect = document.getElementById("cc-bands-count");
  const fieldBand3 = document.getElementById("field-band3");
  const selects = {
    band1: document.getElementById("cc-band1"),
    band2: document.getElementById("cc-band2"),
    band3: document.getElementById("cc-band3"),
    multiplier: document.getElementById("cc-multiplier"),
    tolerance: document.getElementById("cc-tolerance"),
  };
  const bandShapes = [
    document.getElementById("band-1"),
    document.getElementById("band-2"),
    document.getElementById("band-3"),
    document.getElementById("band-4"),
    document.getElementById("band-5"),
  ];
  const box = document.getElementById("panel-color-code").querySelector("[data-result]");
  const colors = options.colors;

  // Peta nama warna -> kode warna, untuk menggambar resistor.
  const hexByName = {};
  for (const list of [colors.digits, colors.multipliers, colors.tolerances]) {
    for (const item of list) {
      if (item.hex) hexByName[item.name] = item.hex;
    }
  }

  function fill(select, items, describe, selectedName) {
    select.replaceChildren();
    for (const item of items) {
      const option = el("option", "", `${capitalize(item.name)} (${describe(item)})`);
      option.value = item.name;
      // Set text color based on color name
      if (item.hex) {
        option.style.color = item.hex;
        // Adjust text color for visibility on selected state
        if (item.name === "yellow" || item.name === "white" || item.name === "gold") {
          option.style.textShadow = "0 0 2px #000";
        }
      }
      if (item.name === selectedName) option.selected = true;
      select.appendChild(option);
    }
  }

  // Gelang 1 tidak boleh hitam (angka pertama tidak boleh 0).
  fill(selects.band1, colors.digits.filter((c) => c.name !== "black"), (c) => c.value, "brown");
  fill(selects.band2, colors.digits, (c) => c.value, "black");
  fill(selects.band3, colors.digits, (c) => c.value, "black");
  fill(selects.multiplier, colors.multipliers, (c) => c.label, "red");
  fill(selects.tolerance, colors.tolerances, (c) => c.label, "gold");

  function paintBands() {
    const is5Band = bandsCountSelect.value === "5";
    fieldBand3.style.display = is5Band ? "" : "none";
    bandShapes[2].style.display = is5Band ? "" : "none";

    if (is5Band) {
      // 5-band positions
      bandShapes[0].setAttribute("x", "75");
      bandShapes[1].setAttribute("x", "95");
      bandShapes[2].setAttribute("x", "115");
      bandShapes[3].setAttribute("x", "135"); // multiplier
      bandShapes[4].setAttribute("x", "220"); // tolerance

      const names = [
        selects.band1.value,
        selects.band2.value,
        selects.band3.value,
        selects.multiplier.value,
        selects.tolerance.value,
      ];
      names.forEach((name, index) => {
        bandShapes[index].setAttribute("fill", hexByName[name] || "transparent");
      });
    } else {
      // 4-band positions
      bandShapes[0].setAttribute("x", "75");
      bandShapes[1].setAttribute("x", "95");
      bandShapes[3].setAttribute("x", "135"); // multiplier
      bandShapes[4].setAttribute("x", "220"); // tolerance

      const names = [
        selects.band1.value,
        selects.band2.value,
        selects.multiplier.value,
        selects.tolerance.value,
      ];
      bandShapes[0].setAttribute("fill", hexByName[names[0]] || "transparent");
      bandShapes[1].setAttribute("fill", hexByName[names[1]] || "transparent");
      bandShapes[3].setAttribute("fill", hexByName[names[2]] || "transparent");
      bandShapes[4].setAttribute("fill", hexByName[names[3]] || "transparent");
    }
  }

  let latestRequest = 0; // untuk mengabaikan respons lama kalau pengguna mengganti warna cepat
let firstRender = true; // flag untuk menghindari penyimpanan pada load awal

  async function update() {
    paintBands();
    const requestId = ++latestRequest;
    const is5Band = bandsCountSelect.value === "5";
    const payload = {
      band1: selects.band1.value,
      band2: selects.band2.value,
      multiplier: selects.multiplier.value,
      tolerance: selects.tolerance.value,
    };
    if (is5Band) {
      payload.band3 = selects.band3.value;
    } else {
      payload.band3 = "none";
    }

    const data = await callApi("color-code", payload);
    if (requestId !== latestRequest) return;

    if (!data.ok) return renderError(box, data.error);
    box.replaceChildren();
    renderResult(box, data.result, {
      title: "Resistor value",
      extras: [
        ["Tolerance", data.result.tolerance_display],
        ["Range", data.result.range_display],
      ],
    });
    // Simpan ke DB dengan range dan tolerance (hanya jika bukan render pertama)
    if (!firstRender) {
      console.log('Attempting to save history...');
      const res = await saveCalcHistory("Resistor Color Code", payload, { 
        range: data.result.range_display,
        tolerance: data.result.tolerance_display
      });
      console.log('Save result:', res);
    } else {
      console.log('Skipping initial save');
      firstRender = false;
    }
  }

  bandsCountSelect.addEventListener("change", update);
  for (const select of Object.values(selects)) {
    select.addEventListener("change", update);
  }
  update();
}

// ---------- Mulai ----------

document.addEventListener("DOMContentLoaded", async () => {
  showTab(window.location.hash.slice(1));
  window.addEventListener("hashchange", () => showTab(window.location.hash.slice(1)));

  try {
    const response = await fetch(`${API}/options`);
    const data = await response.json();
    if (!data.ok) throw new Error("Options request failed");
    options = data.result;
  } catch (error) {
    document.getElementById("load-error").hidden = false;
    return;
  }

  for (const select of document.querySelectorAll("select[data-quantity]")) {
    fillSelect(select, select.dataset.quantity);
  }
  setupGenericForms();
  setupSeriesParallel();
  setupConverter();
  setupColorCode();
});