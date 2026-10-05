// projects_ui.js: Antarmuka daftar proyek dengan fitur Rename, Buka, dan Hapus (UI diperindah).

import { fetchProjects, deleteProject, saveAllProjects, exportProject, importProject, saveProject } from "./storage.js";
import { showToast } from "../utils/toast.js";

export function setupProjectsUI({ onOpenProject }) {
  const target = document.getElementById("projects-list-app");
  if (!target) return;

  async function render() {
    // Tunggu data terbaru dari database
    const projects = await fetchProjects(); 
    let list = Object.values(projects);
    const searchInput = document.getElementById("search-proj");
    const query = searchInput ? searchInput.value.toLowerCase().trim() : "";
    if (query) {
      list = list.filter(p => p.name.toLowerCase().includes(query));
    }

    let html = `
      <div style="max-width: 800px; margin: 0 auto; font-family: var(--font);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="margin: 0; color: #e6edf7;">Circuit Projects</h2>
          <button id="btn-new-proj" style="background: #22d3ee; color: #0b1220; border: none; padding: 10px 18px; border-radius: 6px; font-weight: 600; cursor: pointer;">+ New Project</button>
        </div>
        <div style="background: #121a2b; border-radius: 8px; border: 1px solid #26324a; overflow: hidden;">
    `;

    if (list.length === 0) {
      html += `
        <div style="padding: 40px; text-align: center; color: var(--muted);">
          <p style="font-size: 16px; margin-bottom: 10px;">No projects saved yet.</p>
          <p style="font-size: 14px;">Click the "+ New Project" button above to start building circuit simulations.</p>
        </div>
      `;
    } else {
      html += `<ul style="list-style: none; margin: 0; padding: 0;">`;
      list.forEach((p, index) => {
        const borderBottom = index < list.length - 1 ? 'border-bottom: 1px solid var(--border);' : '';
        html += `
          <li class="proj-item" style="padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; ${borderBottom} transition: background 0.2s;" onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background='transparent'">
            <div style="flex: 1; min-width: 200px;">
              <strong style="font-size: 16px; color: var(--text);" class="proj-name-display" data-id="${p.id}">${p.name}</strong><br>
              <small style="color: var(--muted);">Updated: ${new Date(p.updated).toLocaleString()}</small>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button class="btn-open" data-id="${p.id}" style="background: var(--accent); color: var(--bg); border: none; padding: 6px 14px; border-radius: 4px; font-weight: 500; cursor: pointer;">Open</button>
              <button class="btn-rename" data-id="${p.id}" style="background: var(--surface-2); color: var(--text); border: 1px solid var(--border); padding: 6px 14px; border-radius: 4px; font-weight: 500; cursor: pointer;">Rename</button>
              <button class="btn-export" data-id="${p.id}" style="background: #8b5cf6; color: var(--bg); border: none; padding: 6px 14px; border-radius: 4px; font-weight: 500; cursor: pointer;">Export</button>
              <button class="btn-del" data-id="${p.id}" style="background: #f87171; color: var(--bg); border: none; padding: 6px 14px; border-radius: 4px; font-weight: 500; cursor: pointer;">Delete</button>
            </div>
          </li>
        `;
      });
      html += `</ul>`;
    }

    html += `</div></div>`;
    target.innerHTML = html;
    bindEvents();
  }

  function bindEvents() {
    const searchInput = document.getElementById("search-proj");
    if (searchInput) {
      searchInput.oninput = () => render()
    }
    const newBtn = document.getElementById("btn-new-proj");
    if (newBtn) {
      newBtn.onclick = () => {
        const name = prompt("New Project Name:", "New Circuit");
        if (!name || !name.trim()) return;
        const trimmed = name.trim();
        window.location.href = `/simulator?new=${encodeURIComponent(trimmed)}`;
      };
    }

    document.querySelectorAll(".btn-open").forEach((btn) => {
      btn.onclick = (e) => {
        const id = e.target.dataset.id;
        if (onOpenProject) onOpenProject(id);
        else window.location.href = `/simulator?proj=${id}`;
      };
    });

    document.querySelectorAll(".btn-rename").forEach((btn) => {
      btn.onclick = async (e) => {
        const id = e.target.dataset.id;
        const projects = await fetchProjects();
        const p = projects[id];
        if (!p) return;
        const newName = prompt("Rename Project:", p.name);
        if (newName && newName.trim() && newName.trim() !== p.name) {
          p.name = newName.trim();
          p.updated = new Date().toISOString();
          await saveProject(p);
          render();
        }
      };
    });

    document.querySelectorAll(".btn-del").forEach((btn) => {
      btn.onclick = async (e) => {
        const id = e.target.dataset.id;
        if (confirm("Are you sure you want to delete this project?")) {
          await deleteProject(id);
          render();
        }
      };
    });

    document.querySelectorAll(".btn-export").forEach((btn) => {
      btn.onclick = (e) => {
        const id = e.target.dataset.id;
        try {
          exportProject(id);
          showToast("Project downloaded successfully", "success");
        } catch (err) {
          showToast("Failed to export project", "error");
          console.error(err);
        }
      };
    });
  }

  render();
}
