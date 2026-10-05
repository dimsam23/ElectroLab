// projects.js: Manajemen tombol Simpan menimpa (overwrite) proyek aktif.

import { updateProject, createProject, getProject } from "../projects/storage.js";
import { getCircuitData } from "./circuit.js";

export function setupProjectTools({ history, circuit }) {
  const toolbar = document.querySelector(".sim-toolbar");
  if (!toolbar) return;

  const saveBtn = document.createElement("button");
  saveBtn.className = "btn";
  saveBtn.textContent = "💾 Save";
  saveBtn.style.marginLeft = "10px";
  saveBtn.style.backgroundColor = "#10b981";
  saveBtn.style.color = "white";
  saveBtn.style.border = "none";
  saveBtn.style.borderRadius = "0.375rem";
  saveBtn.style.padding = "0.5rem 1rem";
  saveBtn.style.cursor = "pointer";
  saveBtn.style.transition = "background-color 0.2s";
  saveBtn.onmouseover = () => { saveBtn.style.backgroundColor = "#059669"; };
  saveBtn.onmouseout = () => { saveBtn.style.backgroundColor = "#10b981"; };

  toolbar.appendChild(saveBtn);

  const urlParams = new URLSearchParams(window.location.search);
  let currentProjId = urlParams.get('proj');

  saveBtn.onclick = () => {
    const originalText = saveBtn.textContent;
    saveBtn.textContent = "Saving...";
    saveBtn.disabled = true;

    const circuitData = getCircuitData(circuit);
    const historyData = {
      snapshots: history.snapshots,
      currentIndex: history.currentIndex
    };

    if (currentProjId) {
      updateProject(currentProjId, circuitData, historyData);
    } else {
      const name = prompt("Project Name:", "New Circuit");
      if (name) {
        currentProjId = createProject(name, circuitData, historyData);
        const newUrl = window.location.pathname + "?proj=" + currentProjId;
        window.history.replaceState({}, document.title, newUrl);
      }
    }

    setTimeout(() => {
      saveBtn.textContent = "Saved!";
      setTimeout(() => {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
      }, 1500);
    }, 500);
  };

  // Auto-save setiap perubahan besar atau interval ke proyek yang sama jika sudah punya ID
  setInterval(() => {
    if (currentProjId && history.snapshots.length > 0) {
      const circuitData = getCircuitData(circuit);
      const historyData = {
        snapshots: history.snapshots,
        currentIndex: history.currentIndex
      };
      updateProject(currentProjId, circuitData, historyData);
    }
  }, 30000); // Auto-save tiap 30 detik
}
