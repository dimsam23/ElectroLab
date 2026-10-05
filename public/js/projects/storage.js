// storage.js – API‑based persistence (PostgreSQL via Flask)

const API_BASE = "/api/projects";

// Cache lokal proyek
let projectsCache = {};

// Load cache on module init (non‑blocking)
(async () => {
  try {
    const res = await fetch(API_BASE);
    if (res.ok) projectsCache = await res.json();
  } catch (e) {
    console.error('Failed to load projects cache', e);
  }
})();

// Sync getter used by legacy UI (returns cached object)
export function getProjects() {
  return projectsCache;
}

// Async version if needed elsewhere
export async function fetchProjects() {
  const res = await fetch(API_BASE);
  if (!res.ok) throw new Error('Gagal ambil proyek');
  projectsCache = await res.json();
  return projectsCache;
}

// SIMPAN SEMUA PROYEK (kompatibilitas lama)
export async function saveAllProjects(projects) {
  for (const id in projects) {
    const p = projects[id];
    await saveProject({ id: p.id, name: p.name, circuit: p.circuit, history: p.history });
  }
}

// CREATE / SIMPAN PROYEK BARU
export async function createProject(name, circuitData, historyData) {
  const id = "proj_" + Date.now();
  await saveProject({ id, name, circuit: circuitData, history: historyData });
  return id;
}

// UPDATE PROYEK
export async function updateProject(id, circuitData, historyData) {
  const existing = projectsCache[id] || { name: "Project" };
  await saveProject({ id, name: existing.name, circuit: circuitData, history: historyData });
}

// SAVE PROYEK (Core API)
export async function saveProject({ id, name, circuit, history }) {
  const payload = { id, name, circuit, history };
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Gagal simpan proyek");
  const saved = await res.json();
  projectsCache[saved.id] = saved;
  return saved;
}

// DELETE PROYEK
export async function deleteProject(id) {
  const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Gagal hapus proyek");
  delete projectsCache[id];
  return await res.json();
}

// GET SATU PROYEK
export async function getProject(id) {
  try {
    const res = await fetch(`${API_BASE}/${id}`);
    if (!res.ok) throw new Error("Proyek tidak ditemukan");
    const project = await res.json();
    projectsCache[id] = project; // Update cache
    return project;
  } catch (err) {
    return projectsCache[id] || null;
  }
}

// EXPORT ke file JSON
export function exportProject(id, project) {
  const targetProj = project || projectsCache[id];
  if (!targetProj) return false;
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(targetProj, null, 2));
  const a = document.createElement("a");
  a.setAttribute("href", dataStr);
  a.setAttribute("download", `${targetProj.name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_export.json`);
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}

// IMPORT dari string JSON
export function importProject(fileContent) {
  try {
    const project = JSON.parse(fileContent);
    if (!project.id || !project.name || !project.circuit) {
      throw new Error("Format file proyek tidak valid.");
    }
    return project;
  } catch (e) {
    console.error("Gagal impor:", e);
    throw e;
  }
}

export async function clearAllProjects() {
  const projects = getProjects();
  for (const id in projects) {
    await deleteProject(id);
  }
}
