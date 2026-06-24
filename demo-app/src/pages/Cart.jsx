import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CartItem from '../components/CartItem';
import { useCart } from '../context/CartContext';

function Cart() {
  const {
    items,
    getSubtotal,
    getTotal,
    applyCoupon,
    clearCart,
    couponCode,
    couponError,
    discount
  } = useCart();
  const navigate = useNavigate();
  const [couponInput, setCouponInput] = useState('');

  const handleApplyCoupon = () => {
    applyCoupon(couponInput);
  };

  // BUG #1: Empty cart → clicking checkout briefly shows checkout before redirecting
  // There's no immediate guard here; the Checkout page handles it with a delayed redirect
  const handleCheckout = () => {
    navigate('/checkout');
  };

  const subtotal = getSubtotal();
  const total = getTotal();

  return (
    <div className="cart-page" id="cart-page" data-testid="cart-page">
      <h1 className="page-title" data-testid="cart-title">Shopping Cart</h1>

      {items.length === 0 ? (
        <div className="empty-cart glass-card" id="empty-cart" data-testid="empty-cart">
          <div className="empty-cart-icon">🛒</div>
          <h2>Your cart is empty</h2>
          <p>Looks like you haven't added anything to your cart yet.</p>
          <button
            className="primary-btn"
            onClick={() => navigate('/products')}
            id="continue-shopping"
            data-testid="continue-shopping"
          >
            Continue Shopping
          </button>
          {/* BUG #1: Checkout button visible even when cart is empty */}
          <button
            className="primary-btn checkout-btn"
            onClick={handleCheckout}
            id="checkout-btn-empty"
            data-testid="checkout-btn-empty"
            style={{ marginTop: '1rem', opacity: 0.5 }}
          >
            Proceed to Checkout
          </button>
        </div>
      ) : (
        <div className="cart-layout">
          <div className="cart-items-section">
            <div className="cart-items-list" id="cart-items-list" data-testid="cart-items-list">
              {items.map(item => (
                <CartItem key={item.id} item={item} />
              ))}
            </div>
            <button
              className="clear-cart-btn"
              onClick={clearCart}
              id="clear-cart"
              data-testid="clear-cart"
            >
              Clear Cart
            </button>
          </div>

          <div className="cart-summary glass-card" id="cart-summary" data-testid="cart-summary">
            <h2>Order Summary</h2>

            <div className="summary-row">
              <span>Subtotal</span>
              <span data-testid="cart-subtotal">${subtotal.toFixed(2)}</span>
            </div>

            {discount !== null && (
              <div className="summary-row discount-row">
                <span>Discount</span>
                <span data-testid="cart-discount">
                  {typeof discount === 'number' ? `-${(discount * 100).toFixed(0)}%` : 'Invalid'}
                </span>
              </div>
            )}

            <div className="summary-row">
              <span>Shipping</span>
              <span data-testid="cart-shipping">Free</span>
            </div>

            <div className="summary-divider" />

            <div className="summary-row total-row">
              <span>Total</span>
              {/* BUG #2: Total shows NaN when invalid coupon is applied */}
              <span data-testid="cart-total" id="cart-total">
                ${total.toFixed(2)}
              </span>
            </div>

            <div className="coupon-section">
              <div className="coupon-input-group">
                <input
                  type="text"
                  placeholder="Coupon code"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  className="coupon-input"
                  id="coupon-input"
                  data-testid="coupon-input"
                />
                <button
                  className="apply-coupon-btn"
                  onClick={handleApplyCoupon}
                  id="apply-coupon"
                  data-testid="apply-coupon"
                >
                  Apply
                </button>
              </div>
              {couponError && (
                <p className="coupon-error" data-testid="coupon-error">{couponError}</p>
              )}
              {discount !== null && !couponError && (
                <p className="coupon-success" data-testid="coupon-success">
                  Coupon applied! {(discount * 100).toFixed(0)}% off
                </p>
              )}
            </div>

            <button
              className="checkout-btn primary-btn"
              onClick={handleCheckout}
              id="checkout-btn"
              data-testid="checkout-btn"
            >
              Proceed to Checkout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Cart;
