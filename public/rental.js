async function api(path, opts = {}) {
  const res = await fetch(path, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.substring(2), value);
    } else if (key === 'html') {
      node.innerHTML = value;
    } else {
      node.setAttribute(key, value);
    }
  });
  children.flat().forEach(child => {
    if (typeof child === 'string' || typeof child === 'number') {
      node.appendChild(document.createTextNode(String(child)));
    } else if (child) {
      node.appendChild(child);
    }
  });
  return node;
}

function formatMoney(value) {
  return Number(value).toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

async function loadProfiles() {
  const profiles = await api('/api/rental/profiles');
  const list = document.getElementById('profile-list');
  list.innerHTML = '';
  if (!profiles.length) {
    list.appendChild(el('p', { class: 'muted' }, 'No tenant profiles yet. Create one above to start managing rentals.'));
    document.getElementById('line-items-panel').style.display = 'none';
    return;
  }

  profiles.forEach(profile => {
    const card = el('div', { class: 'card' });
    const header = el('div', { style: 'display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;' },
      el('div', { style: 'min-width:0;' },
        el('strong', {}, `${profile.lastname}, ${profile.firstname}`),
        el('div', { class: 'meta' }, `${profile.room || 'Room N/A'} • ${profile.status}`),
        el('div', { class: 'meta' }, profile.address || 'No address provided')
      ),
      el('div', { class: 'actions', style: 'display:flex; gap:8px; flex-wrap:wrap;' },
        el('button', { onclick: async () => { await showLineItems(profile); }, type: 'button', style: 'background:#2563eb; color:white; border:none; padding:8px 10px; border-radius:4px; cursor:pointer;' }, 'View Line Items'),
        el('button', { onclick: async () => { await deleteProfile(profile); }, type: 'button', style: 'background:#dc2626; color:white; border:none; padding:8px 10px; border-radius:4px; cursor:pointer;' }, 'Delete Profile')
      )
    );

    const details = el('div', { style: 'display:grid; gap:8px; margin-top:14px;' },
      el('div', { class: 'meta' }, `Rental: ${formatMoney(profile.rental)}`),
      el('div', { class: 'meta' }, `Created: ${new Date(profile.createdAt).toLocaleDateString()}`)
    );

    card.appendChild(header);
    card.appendChild(details);
    list.appendChild(card);
  });
}

async function showLineItems(profile) {
  const items = await api(`/api/rental/profiles/${profile.profile_id}/line-items`);
  const panel = document.getElementById('line-items-panel');
  const title = document.getElementById('line-items-title');
  const table = document.getElementById('line-items-table');
  const editPanel = document.getElementById('edit-line-items-panel');
  
  title.textContent = `Rental Line Items for ${profile.firstname} ${profile.lastname}`;
  table.innerHTML = '';

  // Store profile data for invoice printing
  panel.dataset.profileId = profile.profile_id;
  panel.dataset.profileName = `${profile.firstname} ${profile.lastname}`;
  panel.dataset.profileRoom = profile.room || 'N/A';
  panel.dataset.profileAddress = profile.address || '';
  panel.dataset.profileRental = profile.rental;

  if (!items.length) {
    table.appendChild(el('tr', {}, el('td', { colspan: 9, class: 'muted' }, 'No rental line items found. Add a line item manually using the editor below.')));
    panel.style.display = 'block';
  } else {
    for (const item of items) {
      const row = el('tr', {});
      const radioCell = el('td', {});
      const radio = el('input', { type: 'radio', name: 'selected-line-item', value: item.month, onchange: () => {
        panel.dataset.selectedMonth = item.month;
        panel.dataset.selectedItem = JSON.stringify(item);
      }});
      radioCell.appendChild(radio);
      row.appendChild(radioCell);
      row.appendChild(el('td', {}, item.month));
      row.appendChild(el('td', {}, formatMoney(item.rental)));
      row.appendChild(el('td', {}, item.previous_month_elec_read));
      row.appendChild(el('td', {}, item.current_month_elec_read));
      row.appendChild(el('td', {}, formatMoney(item.electricity_fees)));
      row.appendChild(el('td', {}, formatMoney(item.water_fees)));
      row.appendChild(el('td', {}, formatMoney(item.total)));
      const actionCell = el('td', {});
      const deleteButton = el('button', {
        type: 'button',
        onclick: async () => await deleteLineItem(item.rental_line_item_id, profile),
        style: 'background:#dc2626; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;'
      }, 'Delete');
      actionCell.appendChild(deleteButton);
      row.appendChild(actionCell);
      table.appendChild(row);
    }
    panel.style.display = 'block';
  }

  // Show edit panel for this profile
  document.getElementById('selected-tenant-name').textContent = `${profile.firstname} ${profile.lastname}`;
  document.getElementById('line-item-month').value = new Date().toISOString().slice(0,7);
  document.getElementById('prev-elec-read').value = '';
  document.getElementById('curr-elec-read').value = '';
  document.getElementById('electricity-fees').value = '';
  document.getElementById('water-fees').value = '';
  document.getElementById('line-item-total').value = '';
  editPanel.dataset.profileId = profile.profile_id;
  editPanel.style.display = 'block';
}

async function deleteLineItem(lineItemId, profile) {
  if (!confirm('Remove this rental line item?')) {
    return;
  }

  try {
    await api(`/api/rental/line-items/${lineItemId}`, { method: 'DELETE' });
    await showLineItems(profile);
    await loadProfiles();
  } catch (err) {
    console.error(err);
    alert('Unable to delete line item: ' + err.message);
  }
}

async function deleteProfile(profile) {
  if (!confirm('Delete this tenant profile and all related rental line items?')) {
    return;
  }

  try {
    await api(`/api/rental/profiles/${profile.profile_id}`, { method: 'DELETE' });
    document.getElementById('line-items-panel').style.display = 'none';
    document.getElementById('edit-line-items-panel').style.display = 'none';
    await loadProfiles();
  } catch (err) {
    console.error(err);
    alert('Unable to delete profile: ' + err.message);
  }
}

document.getElementById('profile-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    lastname: document.getElementById('lastname').value.trim(),
    firstname: document.getElementById('firstname').value.trim(),
    rental: Number(document.getElementById('rental').value) || 0,
    room: document.getElementById('room').value.trim(),
    address: document.getElementById('address').value.trim(),
    status: document.getElementById('status').value
  };

  if (!payload.lastname || !payload.firstname) {
    return alert('Lastname and firstname are required.');
  }

  try {
    await api('/api/rental/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    document.getElementById('profile-form').reset();
    loadProfiles();
  } catch (err) {
    console.error(err);
    alert('Unable to create profile.');
  }
});

document.getElementById('line-item-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const editPanel = document.getElementById('edit-line-items-panel');
  const profileId = editPanel.dataset.profileId;
  const month = document.getElementById('line-item-month').value;
  const payload = {
    previousMonthElecRead: Number(document.getElementById('prev-elec-read').value) || 0,
    currentMonthElecRead: Number(document.getElementById('curr-elec-read').value) || 0,
    electricityFees: Number(document.getElementById('electricity-fees').value) || 0,
    waterFees: Number(document.getElementById('water-fees').value) || 0,
    total: Number(document.getElementById('line-item-total').value) || 0
  };

  try {
    await api(`/api/rental/profiles/${profileId}/line-items/${month}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    alert('Rental line item saved successfully');
    document.getElementById('line-item-form').reset();
    // Reload to show updated data
    await loadProfiles();
  } catch (err) {
    console.error(err);
    alert('Unable to save rental line item: ' + err.message);
  }
});

document.getElementById('close-edit-panel').addEventListener('click', () => {
  document.getElementById('edit-line-items-panel').style.display = 'none';
  document.getElementById('line-items-panel').style.display = 'none';
});

async function printAllCurrentMonthReceipts() {
  try {
    const profiles = await api('/api/rental/profiles');
    const currentMonth = new Date().toISOString().slice(0, 7);
    const receipts = [];

    for (const profile of profiles) {
      const items = await api(`/api/rental/profiles/${profile.profile_id}/line-items`);
      const currentItem = items.find(item => item.month === currentMonth);
      if (currentItem) {
        receipts.push({ profile, item: currentItem });
      }
    }

    if (!receipts.length) {
      alert('There are no rental line items for the current month to print.');
      return;
    }

    const pages = [];
    for (let i = 0; i < receipts.length; i += 2) {
      pages.push(receipts.slice(i, i + 2));
    }

    const receiptPagesHtml = pages.map((pageGroup) => `
      <div class="receipt-page">
        <div class="receipt-grid">
          ${pageGroup.map(({ profile, item }) => `
            <div class="receipt-card">
              <div class="receipt-header">
                <h1>RENTAL RECEIPT</h1>
                <p>Month: ${item.month}</p>
              </div>

              <div class="receipt-details">
                <div class="detail-section">
                  <h3>Tenant Information</h3>
                  <p><strong>Name:</strong> ${profile.firstname} ${profile.lastname}</p>
                  <p><strong>Room:</strong> ${profile.room || 'N/A'}</p>
                  <p><strong>Address:</strong> ${profile.address || 'N/A'}</p>
                </div>
                <div class="detail-section">
                  <h3>Invoice Details</h3>
                  <p><strong>Month:</strong> ${item.month}</p>
                  <p><strong>Receipt Date:</strong> ${new Date().toLocaleDateString()}</p>
                </div>
              </div>

              <table class="receipt-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th style="text-align: right;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Monthly Rental</td>
                    <td style="text-align: right;">${formatMoney(item.rental)}</td>
                  </tr>
                  <tr>
                    <td>Electricity Fees (Reading: ${item.previous_month_elec_read} → ${item.current_month_elec_read})</td>
                    <td style="text-align: right;">${formatMoney(item.electricity_fees)}</td>
                  </tr>
                  <tr>
                    <td>Water Fees</td>
                    <td style="text-align: right;">${formatMoney(item.water_fees)}</td>
                  </tr>
                  <tr class="total-row">
                    <td>TOTAL AMOUNT DUE</td>
                    <td style="text-align: right;">${formatMoney(item.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Current Month Receipts</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 14px;
            background: #f5f5f5;
          }
          .receipt-page {
            page-break-after: always;
            min-height: 100vh;
            box-sizing: border-box;
          }
          .receipt-page:last-child {
            page-break-after: auto;
          }
          .receipt-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 20px;
            align-items: start;
          }
          .receipt-card {
            background: white;
            border: 1px solid #ccc;
            padding: 18px;
            min-height: 420px;
            box-sizing: border-box;
          }
          .receipt-header {
            text-align: center;
            margin-bottom: 18px;
            border-bottom: 2px solid #333;
            padding-bottom: 12px;
          }
          .receipt-header h1 {
            margin: 0;
            font-size: 1.4rem;
          }
          .receipt-header p {
            margin: 6px 0 0;
            font-size: 0.9rem;
          }
          .receipt-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 16px;
          }
          .detail-section {
            padding: 10px;
            background: #f9f9f9;
            border-radius: 4px;
          }
          .detail-section h3 {
            margin: 0 0 8px;
            font-size: 0.8rem;
          }
          .detail-section p {
            margin: 4px 0;
            font-size: 0.76rem;
          }
          .receipt-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.76rem;
          }
          .receipt-table th {
            background: #2563eb;
            color: white;
            padding: 8px;
            text-align: left;
          }
          .receipt-table td {
            padding: 8px;
            border-bottom: 1px solid #ddd;
            vertical-align: top;
          }
          .receipt-table tr:nth-child(even) {
            background: #f9f9f9;
          }
          .total-row {
            background: #f0f0f0;
            font-weight: bold;
          }
          @media print {
            body {
              background: white;
              padding: 0;
            }
            .receipt-page {
              min-height: auto;
              page-break-after: always;
            }
            .receipt-card {
              box-shadow: none;
            }
          }
        </style>
      </head>
      <body>
        ${receiptPagesHtml}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  } catch (err) {
    console.error(err);
    alert('Unable to print current month receipts: ' + err.message);
  }
}

document.getElementById('print-all-current-month-receipts-btn').addEventListener('click', printAllCurrentMonthReceipts);

document.getElementById('print-receipt-btn').addEventListener('click', () => {
  const panel = document.getElementById('line-items-panel');
  const selectedMonth = panel.dataset.selectedMonth;
  
  if (!selectedMonth) {
    alert('Please select a line item to print a receipt.');
    return;
  }

  const profileName = panel.dataset.profileName;
  const profileRoom = panel.dataset.profileRoom;
  const profileAddress = panel.dataset.profileAddress;
  const selectedItem = JSON.parse(panel.dataset.selectedItem);

  const receiptHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Receipt - ${profileName} - ${selectedMonth}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
          background: white;
        }
        .receipt-container {
          max-width: 800px;
          margin: 0 auto;
          border: 1px solid #ccc;
          padding: 30px;
        }
        .receipt-header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #333;
          padding-bottom: 20px;
        }
        .receipt-header h1 {
          margin: 0;
          color: #333;
        }
        .receipt-details {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 30px;
        }
        .detail-section {
          padding: 15px;
          background: #f9f9f9;
          border-radius: 4px;
        }
        .detail-section h3 {
          margin-top: 0;
          color: #333;
          font-size: 0.95rem;
        }
        .detail-section p {
          margin: 5px 0;
          font-size: 0.9rem;
        }
        .receipt-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        .receipt-table th {
          background: #2563eb;
          color: white;
          padding: 10px;
          text-align: left;
          font-weight: bold;
        }
        .receipt-table td {
          padding: 10px;
          border-bottom: 1px solid #ddd;
        }
        .receipt-table tr:nth-child(even) {
          background: #f9f9f9;
        }
        .total-row {
          background: #f0f0f0;
          font-weight: bold;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #ccc;
          font-size: 0.9rem;
          color: #666;
        }
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          .receipt-container {
            border: none;
            box-shadow: none;
          }
          button {
            display: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="receipt-container">
        <div class="receipt-header">
          <h1>RENTAL RECEIPT</h1>
          <p>Month: ${selectedMonth}</p>
        </div>

        <div class="receipt-details">
          <div class="detail-section">
            <h3>Tenant Information</h3>
            <p><strong>Name:</strong> ${profileName}</p>
            <p><strong>Room:</strong> ${profileRoom}</p>
            <p><strong>Address:</strong> ${profileAddress || 'N/A'}</p>
          </div>
          <div class="detail-section">
            <h3>Invoice Details</h3>
            <p><strong>Month:</strong> ${selectedMonth}</p>
            <p><strong>Receipt Date:</strong> ${new Date().toLocaleDateString()}</p>
          </div>
        </div>

        <table class="receipt-table">
          <thead>
            <tr>
              <th>Item</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Monthly Rental</td>
              <td style="text-align: right;">${formatMoney(selectedItem.rental)}</td>
            </tr>
            <tr>
              <td>Electricity Fees (Reading: ${selectedItem.previous_month_elec_read} → ${selectedItem.current_month_elec_read})</td>
              <td style="text-align: right;">${formatMoney(selectedItem.electricity_fees)}</td>
            </tr>
            <tr>
              <td>Water Fees</td>
              <td style="text-align: right;">${formatMoney(selectedItem.water_fees)}</td>
            </tr>
            <tr class="total-row">
              <td>TOTAL AMOUNT DUE</td>
              <td style="text-align: right;">${formatMoney(selectedItem.total)}</td>
            </tr>
          </tbody>
        </table>

        <div class="footer">
          <p>Thank you for your payment. Please make payment on or before the due date.</p>
          <p style="margin-top: 20px;">Generated on ${new Date().toLocaleString()}</p>
        </div>
      </div>
      <button onclick="window.print()" style="margin-top: 20px; padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer;">Print Receipt</button>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  printWindow.document.write(receiptHtml);
  printWindow.document.close();
  printWindow.focus();
});

loadProfiles().catch(err => console.error(err));
