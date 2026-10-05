// storage.js: Manajemen persistensi data proyek ke localStorage.
// Mengelola data rangkaian (circuit) dan riwayat (history) dalam satu entitas proyek.

const STORAGE_KEY = "electrolab_projects";

// Mendapatkan semua daftar proyek
export function getProjects() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : {};
}

// Menyimpan semua proyek
export function saveAllProjects(projects) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

// Membuat proyek baru
export function createProject(name, circuitData, historyData) {
  const projects = getProjects();
  const id = "proj_" + Date.now();
  projects[id] = {
    id,
    name,
    updated: new Date().toISOString(),
    circuit: circuitData,
    history: historyData,
  };
  saveAllProjects(projects);
  return id;
}

// Menyimpan perubahan ke proyek yang sudah ada
export function updateProject(id, circuitData, historyData) {
  const projects = getProjects();
  if (projects[id]) {
    projects[id].circuit = circuitData;
    projects[id].history = historyData;
    projects[id].updated = new Date().toISOString();
    saveAllProjects(projects);
  }
}

// Menghapus proyek
export function deleteProject(id) {
  const projects = getProjects();
  delete projects[id];
  saveAllProjects(projects);
}

// Hapus semua proyek
export function clearAllProjects() {
  localStorage.removeItem(STORAGE_KEY);
}

// Mengambil proyek spesifik
export function getProject(id) {
  return getProjects()[id] || null;
}

// Ekspor proyek sebagai file JSON
export function exportProject(id) {
  const project = getProject(id);
  if (!project) return false;

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `${project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_export.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  return true;
}

// Impor proyek dari string JSON
export function importProject(fileContent) {
  try {
    const project = JSON.parse(fileContent);
    if (!project.id || !project.name || !project.circuit) {
      throw new Error("Format file proyek tidak valid.");
    }
    
    const projects = getProjects();
    if (projects[project.id]) {
      project.id = 'proj_' + Date.now();
      project.name = `${project.name} (Impor)`;
    }
    
    project.updated = new Date().toISOString();
    projects[project.id] = project;
    saveAllProjects(projects);
    return project;
  } catch (e) {
    console.error("Gagal mengimpor proyek:", e);
    throw e;
  }
}
