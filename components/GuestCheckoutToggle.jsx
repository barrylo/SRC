import React from 'react'

function GuestCheckoutToggle({ isGuest = true, onChange = () => {} }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <label
        htmlFor="guest-checkout-toggle"
        style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
      >
        <input
          id="guest-checkout-toggle"
          type="checkbox"
          checked={isGuest}
          onChange={(e) => onChange(e.target.checked)}
          style={{ width: 18, height: 18, marginRight: 8 }}
        />
        <span style={{ fontWeight: 600 }}>Checkout as Guest</span>
      </label>
      <p style={{ margin: 0, color: '#555', fontSize: 14 }}>
        Only email, shipping address, and payment required. Account creation
        is optional after order.
      </p>
    </div>
  )
}

export default GuestCheckoutToggle
