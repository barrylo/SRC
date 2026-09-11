(() => {
  const { createElement: h, useState } = React;

  function GuestCheckoutToggle() {
    const [isGuest, setIsGuest] = useState(true);
    const [email, setEmail] = useState('');
    const [shipping, setShipping] = useState('');

    function handlePlaceOrder(e) {
      e.preventDefault();
      if (!email.trim() || !shipping.trim()) return alert('Email and shipping address are required');
      const payload = { guest: isGuest, email: email.trim(), shipping: shipping.trim() };
      // Simulated submit (replace with real API endpoint)
      alert('Order submitted (simulated)\n' + JSON.stringify(payload, null, 2));
    }

    return h('form', { onSubmit: handlePlaceOrder, style: { maxWidth: 720 } },
      h('label', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
        h('input', { type: 'checkbox', checked: isGuest, onChange: (ev) => setIsGuest(ev.target.checked) }),
        h('strong', null, 'Checkout as Guest')
      ),
      h('p', { className: 'muted' }, 'Only email, shipping address, and payment required. Account creation is optional after order.'),

      h('div', { style: { marginTop: 12 } },
        h('label', null, 'Email ', h('input', { type: 'email', value: email, onChange: (e) => setEmail(e.target.value), required: true }))
      ),

      h('div', { style: { marginTop: 8 } },
        h('label', null, 'Shipping Address ', h('input', { type: 'text', value: shipping, onChange: (e) => setShipping(e.target.value), required: true }))
      ),

      h('div', { id: 'account-section', style: { display: isGuest ? 'none' : 'block', marginTop: 12 } },
        h('p', null, 'Create an account (optional)'),
        h('label', null, 'Password ', h('input', { type: 'password' }))
      ),

      h('div', { style: { marginTop: 16 } }, h('button', { type: 'submit' }, 'Place Order'))
    );
  }

  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(h(GuestCheckoutToggle));
})();
