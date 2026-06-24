import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';

// BUG #6: No auth check — /checkout accessible without login

function Checkout() {
  const { items, getTotal, clearCart } = useCart();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    address: '',
    city: '',
    zipCode: '',
    cardNumber: '',
    expiry: '',
    cvv: ''
  });

  // BUG #1: Empty cart — delayed redirect instead of immediate guard
  useEffect(() => {
    if (items.length === 0) {
      const timer = setTimeout(() => {
        navigate('/cart');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [items.length, navigate]);

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  // BUG #4: No double-click protection — fast clicks submit multiple times
  const handlePlaceOrder = async (e) => {
    e.preventDefault();

    // No guard like: if (isSubmitting) return;
    setIsSubmitting(true);

    console.log('Order submitted!', {
      items,
      total: getTotal(),
      shipping: formData,
      timestamp: new Date().toISOString()
    });

    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    clearCart();
    // BUG #5: navigates to order-confirmation without setting an order-placed flag
    navigate('/order-confirmation');
  };

  const total = getTotal();

  return (
    <div className="checkout-page" id="checkout-page" data-testid="checkout-page">
      <h1 className="page-title" data-testid="checkout-title">Checkout</h1>

      {items.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p>Your cart is empty. Redirecting...</p>
        </div>
      ) : (
        <form onSubmit={handlePlaceOrder} className="checkout-form" id="checkout-form" data-testid="checkout-form">
          <div className="checkout-layout">
            <div className="checkout-fields">
              <div className="glass-card">
                <h2 className="section-subtitle">Shipping Information</h2>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="firstName">First Name</label>
                    <input
                      type="text"
                      name="firstName"
                      id="firstName"
                      data-testid="checkout-firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="lastName">Last Name</label>
                    <input
                      type="text"
                      name="lastName"
                      id="lastName"
                      data-testid="checkout-lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="address">Street Address</label>
                  <input
                    type="text"
                    name="address"
                    id="address"
                    data-testid="checkout-address"
                    value={formData.address}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="city">City</label>
                    <input
                      type="text"
                      name="city"
                      id="city"
                      data-testid="checkout-city"
                      value={formData.city}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="zipCode">ZIP Code</label>
                    <input
                      type="text"
                      name="zipCode"
                      id="zipCode"
                      data-testid="checkout-zipCode"
                      value={formData.zipCode}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="glass-card">
                <h2 className="section-subtitle">Payment Details</h2>

                <div className="form-group">
                  <label htmlFor="cardNumber">Card Number</label>
                  <input
                    type="text"
                    name="cardNumber"
                    id="cardNumber"
                    data-testid="checkout-cardNumber"
                    value={formData.cardNumber}
                    onChange={handleChange}
                    placeholder="1234 5678 9012 3456"
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="expiry">Expiry Date</label>
                    <input
                      type="text"
                      name="expiry"
                      id="expiry"
                      data-testid="checkout-expiry"
                      value={formData.expiry}
                      onChange={handleChange}
                      placeholder="MM/YY"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="cvv">CVV</label>
                    <input
                      type="text"
                      name="cvv"
                      id="cvv"
                      data-testid="checkout-cvv"
                      value={formData.cvv}
                      onChange={handleChange}
                      placeholder="123"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="checkout-summary glass-card">
              <h2 className="section-subtitle">Order Summary</h2>

              <div className="checkout-items">
                {items.map(item => (
                  <div key={item.id} className="checkout-item" data-testid={`checkout-item-${item.id}`}>
                    <span>{item.name} × {item.quantity}</span>
                    <span>${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="summary-divider" />

              <div className="summary-row total-row">
                <span>Total</span>
                <span data-testid="checkout-total">${total.toFixed(2)}</span>
              </div>

              {/* BUG #4: No disabled state while submitting — allows double-click */}
              <button
                type="submit"
                className="place-order-btn primary-btn"
                id="place-order"
                data-testid="place-order"
              >
                {isSubmitting ? 'Processing...' : 'Place Order'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

export default Checkout;
