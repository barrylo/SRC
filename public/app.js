async function api(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v])=>{ if(k.startsWith('on') && typeof v === 'function') e.addEventListener(k.substring(2), v); else if(k==='html') e.innerHTML=v; else e.setAttribute(k,v); });
  children.flat().forEach(c => { if (typeof c === 'string') e.appendChild(document.createTextNode(c)); else if (c) e.appendChild(c); });
  return e;
}

async function load() {
  const tasks = await api('/api/tasks');
  const list = document.getElementById('tasks');
  list.innerHTML = '';
  tasks.sort((a,b)=> (a.done === b.done) ? 0 : a.done ? 1 : -1 ).forEach(t => {
    const item = el('li', { class: 'task' + (t.done? ' done':'' ) });
    const left = el('div', { class: 'left' },
      el('input', { type: 'checkbox', onchange: async () => { await api('/api/tasks/'+t.id, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ done: !t.done }) }); load(); } , title: 'Mark done' }),
      el('div', {}, el('strong', {}, t.title), (t.due || t.category || t.priority) ? el('div',{class:'muted'}, [t.due ? 'due '+t.due : null, t.category ? t.category : null, t.priority ? 'priority: '+t.priority : null].filter(Boolean).join(' • ')) : null)
    );
    const actions = el('div', { class: 'actions' },
      el('button', { onclick: async () => { const newTitle = prompt('Edit task title', t.title); if (newTitle!==null) { await api('/api/tasks/'+t.id, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ title: newTitle }) }); load(); } } }, 'Edit'),
      el('button', { onclick: async () => { if (!confirm('Delete this task?')) return; await api('/api/tasks/'+t.id, { method:'DELETE' }); load(); } }, 'Delete')
    );
    item.appendChild(left);
    item.appendChild(actions);
    // set checkbox state after append to avoid double events
    list.appendChild(item);
    item.querySelector('input[type=checkbox]').checked = !!t.done;
  });
}

document.getElementById('task-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('title').value.trim();
  const due = document.getElementById('due').value || null;
  const category = document.getElementById('category').value.trim() || '';
  const priority = document.getElementById('priority').value || 'medium';
  if (!title) return alert('Enter a title');
  await api('/api/tasks', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ title, due, category, priority }) });
  document.getElementById('title').value = '';
  document.getElementById('due').value = '';
  document.getElementById('category').value = '';
  document.getElementById('priority').value = 'medium';
  load();
});

load().catch(err=>console.error(err));

// Guest checkout integration for checkout page
function initGuestCheckoutToggle() {
  const toggle = document.getElementById('guest-toggle');
  if (!toggle) return;

  const accountSection = document.getElementById('account-section');
  const checkoutForm = document.getElementById('checkout-form');

  function updateUI(isGuest) {
    if (accountSection) accountSection.style.display = isGuest ? 'none' : 'block';
    // Email is always required per FR-1
    const email = document.getElementById('email');
    if (email) email.required = true;
  }

  // initialize
  updateUI(toggle.checked);

  toggle.addEventListener('change', (e) => {
    updateUI(e.target.checked);
  });

  if (checkoutForm) {
    checkoutForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const isGuest = toggle.checked;
      const email = document.getElementById('email').value.trim();
      const shipping = document.getElementById('shipping').value.trim();
      if (!email || !shipping) return alert('Email and shipping address are required');

      const payload = { guest: isGuest, email, shipping };
      try {
        // placeholder API call - adapt to your backend endpoint
        await api('/api/checkout', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        alert('Order placed (simulated)');
        window.location.href = '/';
      } catch (err) {
        console.error(err);
        alert('Checkout failed: ' + err.message);
      }
    });
  }
}

// Run guest checkout init on pages that include the elements
try { initGuestCheckoutToggle(); } catch (err) { console.error('Guest toggle init error', err); }
