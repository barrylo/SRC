async function fetchTasks() {
  const res = await fetch('/api/admin/tasks');
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function renderTable(tasks) {
  const tbody = document.querySelector('#table tbody');
  tbody.innerHTML = '';
  tasks.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${t.id}</td><td>${escapeHtml(t.title)}</td><td>${t.due||''}</td><td>${escapeHtml(t.category||'')}</td><td>${escapeHtml(t.priority||'')}</td><td>${escapeHtml(t.notes||'')}</td><td>${t.done}</td><td>${t.createdAt||''}</td>`;
    tbody.appendChild(tr);
  });
  document.getElementById('raw').textContent = JSON.stringify(tasks, null, 2);
}

function escapeHtml(s){ return String(s).replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[ch]); }

document.getElementById('refresh').addEventListener('click', async () => {
  try {
    const tasks = await fetchTasks();
    renderTable(tasks);
  } catch (e) {
    alert('Error: '+e.message);
  }
});

document.getElementById('export').addEventListener('click', async () => {
  const tasks = await fetchTasks();
  const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'tasks-export.json'; a.click();
  URL.revokeObjectURL(url);
});

// initial load
(async ()=>{
  try { const tasks = await fetchTasks(); renderTable(tasks); } catch(e){ document.getElementById('raw').textContent = 'Error: '+e.message }
})();
