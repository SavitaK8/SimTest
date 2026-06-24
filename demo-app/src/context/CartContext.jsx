import React, { createContext, useContext, useState } from 'react';

const CartContext = createContext(null);

// BUG #2: Invalid coupon makes total NaN — discount is undefined for invalid codes, not 0
const VALID_COUPONS = {
  'SAVE10': 0.10,
  'SAVE20': 0.20
};

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [discount, setDiscount] = useState(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState('');

  const addToCart = (product, quantity = 1) => {
    setItems(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { ...product, quantity }];
    });
  };

  // BUG #3: Setting quantity to 0 doesn't remove item — shows $0.00 line
  const updateQuantity = (productId, quantity) => {
    setItems(prev =>
      prev.map(item =>
        item.id === productId ? { ...item, quantity: quantity } : item
      )
    );
  };

  const removeFromCart = (productId) => {
    setItems(prev => prev.filter(item => item.id !== productId));
  };

  const getSubtotal = () => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  // BUG #2: When invalid coupon is applied, discount becomes undefined
  // total * (1 - undefined) = NaN
  const getTotal = () => {
    const subtotal = getSubtotal();
    if (discount !== null) {
      return subtotal * (1 - discount);
    }
    return subtotal;
  };

  // BUG #2: applyCoupon sets discount to VALID_COUPONS[code] which is undefined for invalid codes
  const applyCoupon = (code) => {
    const discountValue = VALID_COUPONS[code.toUpperCase()];
    setCouponCode(code);
    // BUG: does not check if discountValue is undefined — sets it directly
    setDiscount(discountValue);
    if (VALID_COUPONS[code.toUpperCase()]) {
      setCouponError('');
      return { success: true, discount: discountValue };
    } else {
      setCouponError('Invalid coupon code');
      return { success: false, error: 'Invalid coupon code' };
    }
  };

  const clearCart = () => {
    setItems([]);
    setDiscount(null);
    setCouponCode('');
    setCouponError('');
  };

  const getCartCount = () => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  };

  return (
    <CartContext.Provider value={{
      items,
      addToCart,
      removeFromCart,
      updateQuantity,
      getSubtotal,
      getTotal,
      applyCoupon,
      clearCart,
      getCartCount,
      discount,
      couponCode,
      couponError
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
