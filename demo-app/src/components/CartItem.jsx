import React from 'react';
import { useCart } from '../context/CartContext';

function CartItem({ item }) {
  const { updateQuantity, removeFromCart } = useCart();

  // BUG #3: quantity input allows 0 — updateQuantity(id, 0) keeps item with $0.00 line
  const handleQuantityChange = (e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) {
      updateQuantity(item.id, val);
    }
  };

  const handleIncrement = () => {
    // BUG #8: No stock check — can increment quantity beyond available stock
    updateQuantity(item.id, item.quantity + 1);
  };

  const handleDecrement = () => {
    if (item.quantity > 1) {
      updateQuantity(item.id, item.quantity - 1);
    }
  };

  return (
    <div className="cart-item" id={`cart-item-${item.id}`} data-testid={`cart-item-${item.id}`}>
      <div
        className="cart-item-image"
        style={{ background: item.image }}
        data-testid={`cart-item-image-${item.id}`}
      />
      <div className="cart-item-details">
        <h3 className="cart-item-name" data-testid={`cart-item-name-${item.id}`}>
          {item.name}
        </h3>
        <p className="cart-item-price" data-testid={`cart-item-unit-price-${item.id}`}>
          ${item.price.toFixed(2)} each
        </p>
      </div>
      <div className="cart-item-controls">
        <button
          className="qty-btn"
          onClick={handleDecrement}
          id={`qty-decrease-${item.id}`}
          data-testid={`qty-decrease-${item.id}`}
        >
          −
        </button>
        <input
          type="number"
          className="qty-input"
          value={item.quantity}
          onChange={handleQuantityChange}
          min="0"
          id={`qty-input-${item.id}`}
          data-testid={`qty-input-${item.id}`}
        />
        <button
          className="qty-btn"
          onClick={handleIncrement}
          id={`qty-increase-${item.id}`}
          data-testid={`qty-increase-${item.id}`}
        >
          +
        </button>
      </div>
      <div className="cart-item-total" data-testid={`cart-item-total-${item.id}`}>
        ${(item.price * item.quantity).toFixed(2)}
      </div>
      <button
        className="remove-btn"
        onClick={() => removeFromCart(item.id)}
        id={`remove-item-${item.id}`}
        data-testid={`remove-item-${item.id}`}
      >
        ✕
      </button>
    </div>
  );
}

export default CartItem;
