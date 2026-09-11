async function convertTemp(e) {
  e.preventDefault();
  const value = document.getElementById('value').value;
  const from = document.getElementById('from').value;
  const to = document.getElementById('to').value;
  const resultEl = document.getElementById('result');
  resultEl.textContent = 'Converting...';

  try {
    const res = await fetch('http://localhost:5000/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: Number(value), from, to })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Conversion failed');
    resultEl.textContent = `Result: ${data.value}`;
    await loadHistory();
  } catch (err) {
    resultEl.textContent = 'Error: ' + err.message;
  }
}

document.getElementById('converter').addEventListener('submit', convertTemp);

async function loadHistory() {
  const histEl = document.getElementById('history');
  const emptyEl = document.getElementById('history-empty');
  histEl.innerHTML = '';
  try {
    const res = await fetch('http://localhost:5000/history');
    const data = await res.json();
    if (data.length === 0) {
      emptyEl.style.display = 'block';
    } else {
      emptyEl.style.display = 'none';
      data.slice().reverse().forEach(item => {
        const li = document.createElement('li');
        li.style.padding = '6px 0';
        li.style.borderBottom = '1px solid #ddd';
        const time = new Date(item.ts).toLocaleTimeString();
        li.textContent = `${item.value}°${item.from} → ${item.result.toFixed(2)}°${item.to} (${time})`;
        histEl.appendChild(li);
      });
    }
  } catch (e) {
    emptyEl.textContent = 'Unable to load history';
    emptyEl.style.display = 'block';
  }
}

// initial load
loadHistory().catch(()=>{});

// clear history button handler
document.getElementById('clear-history').addEventListener('click', async () => {
  if (!confirm('Clear all history?')) return;
  try {
    await fetch('http://localhost:5000/history/clear', { method: 'POST' });
    await loadHistory();
  } catch (e) {
    alert('Error clearing history: ' + e.message);
  }
});

// export to csv button handler
document.getElementById('export-history').addEventListener('click', async () => {
  try {
    const res = await fetch('http://localhost:5000/history');
    const data = await res.json();
    if (data.length === 0) {
      alert('No history to export');
      return;
    }
    // prepare csv header
    const headers = ['Value', 'From Unit', 'To Unit', 'Result', 'Timestamp'];
    // prepare csv rows
    const rows = data.map(item => [
      item.value,
      item.from,
      item.to,
      item.result.toFixed(2),
      new Date(item.ts).toLocaleString()
    ]);
    // escape and quote CSV fields
    const csvRows = [
      headers.map(h => `"${h}"`).join(','),
      ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ];
    const csv = csvRows.join('\n');
    // create blob and download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'temperature-conversions.csv';
    link.click();
  } catch (e) {
    alert('Error exporting history: ' + e.message);
  }
});
