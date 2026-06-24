import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

// BUG #5: No order-placed guard — back button allows re-visiting this page
// and potentially re-submitting by navigating back to checkout

function OrderConfirmation() {
  const navigate = useNavigate();

  // Generate a fake order number
  const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;

  return (
    <div className="order-confirmation-page" id="order-confirmation-page" data-testid="order-confirmation-page">
      <div className="confirmation-card glass-card">
        <div className="confirmation-icon">✓</div>
        <h1 className="confirmation-title" data-testid="confirmation-title">
          Order Placed Successfully!
        </h1>
        <p className="confirmation-subtitle">
          Thank you for your purchase. Your order has been confirmed.
        </p>

        <div className="order-details-box">
          <div className="order-detail-row">
            <span>Order Number</span>
            <span className="order-number" id="order-number" data-testid="order-number">
              {orderNumber}
            </span>
          </div>
          <div className="order-detail-row">
            <span>Status</span>
            <span className="order-status" data-testid="order-status">Processing</span>
          </div>
          <div className="order-detail-row">
            <span>Estimated Delivery</span>
            <span data-testid="delivery-estimate">3-5 Business Days</span>
          </div>
        </div>

        <div className="confirmation-actions">
          <Link
            to="/"
            className="primary-btn"
            id="go-home"
            data-testid="go-home"
          >
            Back to Home
          </Link>
          <Link
            to="/products"
            className="secondary-btn"
            id="continue-shopping-confirm"
            data-testid="continue-shopping-confirm"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}

export default OrderConfirmation;
