import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const { getCartCount } = useCart();
  const navigate = useNavigate();
  const cartCount = getCartCount();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar" id="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo" id="navbar-logo">
          <span className="logo-icon">◆</span>
          <span className="logo-text">ShopSim</span>
        </Link>

        <div className="navbar-links">
          <Link to="/" className="nav-link" id="nav-dashboard" data-testid="nav-dashboard">
            Dashboard
          </Link>
          <Link to="/products" className="nav-link" id="nav-products" data-testid="nav-products">
            Products
          </Link>
          <Link to="/cart" className="nav-link cart-link" id="nav-cart" data-testid="nav-cart">
            Cart
            {cartCount > 0 && (
              <span className="cart-badge" id="cart-badge" data-testid="cart-badge">
                {cartCount}
              </span>
            )}
          </Link>
          {isAuthenticated ? (
            <>
              <Link to="/profile" className="nav-link" id="nav-profile" data-testid="nav-profile">
                {user?.name || 'Profile'}
              </Link>
              <button
                onClick={handleLogout}
                className="nav-btn logout-btn"
                id="logout-btn"
                data-testid="logout-btn"
              >
                Logout
              </button>
            </>
          ) : (
            <Link to="/login" className="nav-btn login-link" id="nav-login" data-testid="nav-login">
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
