// history_ui.js: History interface displaying projects list.

import { fetchProjects, getProjects } from "./storage.js";
import { getCalcHistory, saveCalcHistory } from "../utils/calc_history.js";

export async function setupHistoryUI(offset = 0) {
  const target = document.getElementById("history-list-app");
  if (!target) return;

  // Event handler delete (Satu event listener)
  if (!target.dataset.listenerAttached) {
    target.dataset.listenerAttached = "true";
    target.addEventListener('click', async (e) => {
      const btn = e.target.closest('.btn-delete-calc');
      if (btn) {
        const id = btn.dataset.id;
        if (confirm('Hapus kalkulasi ini?')) {
          await fetch(`/api/projects/history-calc/${id}`, { method: 'DELETE' });
          setupHistoryUI(offset);
        }
      }
      if (e.target.id === 'btn-delete-all') {
        if (confirm('Hapus SEMUA riwayat kalkulasi?')) {
          await fetch(`/api/projects/history-calc`, { method: 'DELETE' });
          setupHistoryUI(0);
        }
      }
    });
  }

  // Ambil data terbaru
  const projects = await fetchProjects();
  const list = Object.values(projects).sort((a, b) => new Date(b.updated) - new Date(a.updated));

  // Ambil histori dengan limit & offset
  const response = await fetch(`/api/projects/history-calc?limit=10&offset=${offset}`);
  const data = await response.json();
  const calcHistory = data.history || [];
  const total = data.total || 0;

  // toggle snapshot view per project
  const toggleSnapshot = (projId, container) => {
    const proj = getProjects()[projId];
    if (!proj) return;
    const snapshots = proj.history?.snapshots || [];
    const currentIdx = proj.history?.currentIndex ?? -1;
    let snapHtml = `<ul style="list-style:none;margin:0;padding:0;">`;
    snapshots.forEach((snap, idx) => {
      const isCur = idx === currentIdx;
      snapHtml += `<li style="padding:8px 12px;background:${isCur?'var(--surface-2)':'var(--surface)'};border-bottom:1px solid var(--border);">
        Snapshot #${idx + 1} ${isCur?'(Current)':''}
      </li>`;
    });
    snapHtml += `</ul>`;
    const existing = container.querySelector('.snapshots');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.className = 'snapshots';
    div.innerHTML = snapHtml;
    container.appendChild(div);
  };

  // UI Construction
  let html = `
    <div style="max-width:800px;margin:0 auto;font-family:var(--font);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h2 style="margin:0;color:var(--text);">Project History</h2>
        <button id="btn-refresh" title="Refresh" style="background:var(--surface-2);color:var(--text);border:1px solid var(--border);width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:6px;cursor:pointer;font-size:18px;">⟳</button>
      </div>
      <div style="background:var(--surface);border-radius:8px;border:1px solid var(--border);overflow:hidden;">
  `;

  if (list.length === 0) {
    html += `<div style="padding:40px;text-align:center;color:var(--muted);">No projects found.</div>`;
  } else {
    html += `<ul style="list-style:none;margin:0;padding:0;">`;
    list.forEach(p => {
      html += `
        <li style="padding:16px 20px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);">
          <div><strong>${p.name}</strong></div>
          <div style="display:flex;gap:8px;">
            <a href="/simulator?proj=${p.id}" style="background:var(--accent);color:var(--bg);padding:6px 14px;border-radius:4px;text-decoration:none;">View</a>
            <button class="btn-snap" data-id="${p.id}" style="background:var(--surface-2);color:var(--text);border:1px solid var(--border);padding:6px 14px;border-radius:4px;cursor:pointer;">History</button>
          </div>
        </li>
      `;
    });
    html += `</ul>`;
  }
  html += `</div>`;

  // Histori Kalkulasi
  html += `
    <div style="margin-top:40px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h2 style="margin:0;color:var(--text);">Calculation History</h2>
        ${total > 0 ? `<button id="btn-delete-all" style="background:#ff4444;color:white;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;">Delete All</button>` : ''}
      </div>
      <div style="background:var(--surface);border-radius:8px;border:1px solid var(--border);overflow:hidden;">
  `;

  if (calcHistory.length === 0) {
    html += `<div style="padding:40px;text-align:center;color:var(--muted);">No history.</div>`;
  } else {
    html += `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:14px;"><thead>
             <tr style="background:var(--surface-2);border-bottom:1px solid var(--border);color:var(--text);">
             <th style="padding:12px;">Operation</th><th style="padding:12px;">Result</th><th style="padding:12px;">Time</th><th style="padding:12px;">Action</th></tr></thead><tbody>`;
    calcHistory.forEach((entry) => {
      const resultStr = typeof entry.result === 'object' ? 
        (entry.result.range ? `Range = ${entry.result.range}, Tolerance = ${entry.result.tolerance}` : JSON.stringify(entry.result)) : entry.result;
      html += `
        <tr style="border-bottom:1px solid var(--border);">
          <td style="padding:12px;color:var(--accent);">${entry.operation}</td>
          <td style="padding:12px;color:var(--text);">${resultStr}</td>
          <td style="padding:12px;color:var(--muted);">${new Date(entry.created_at).toLocaleString()}</td>
          <td style="padding:12px;"><button class="btn-delete-calc" data-id="${entry.id}" style="background:var(--surface-2);color:var(--text);border:1px solid var(--border);padding:6px 10px;border-radius:4px;cursor:pointer;">Delete</button></td>
        </tr>`;
    });
    html += `</tbody></table></div>`;
  }

  // Navigasi Paging
  const maxPage = Math.ceil(total / 10);
  const curPage = Math.floor(offset / 10) + 1;
  html += `
    <div style="padding:20px;display:flex;justify-content:center;gap:10px;align-items:center;">
      <button ${offset === 0 ? 'disabled' : ''} onclick="window.goPage(${offset - 10})" style="padding:6px 12px;cursor:pointer;background:var(--surface-2);color:var(--text);border:1px solid var(--border);border-radius:4px;">Prev</button>
      <span>Page ${curPage} of ${maxPage || 1}</span>
      <button ${offset + 10 >= total ? 'disabled' : ''} onclick="window.goPage(${offset + 10})" style="padding:6px 12px;cursor:pointer;background:var(--surface-2);color:var(--text);border:1px solid var(--border);border-radius:4px;">Next</button>
    </div>
  `;

  html += `</div></div></div>`;
  target.innerHTML = html;

  window.goPage = (newOffset) => setupHistoryUI(newOffset);
  
  target.querySelector('#btn-refresh')?.addEventListener('click', () => setupHistoryUI(offset));
  target.querySelectorAll('.btn-snap').forEach(btn => btn.addEventListener('click', e => toggleSnapshot(e.target.dataset.id, e.target.closest('li'))));
}
