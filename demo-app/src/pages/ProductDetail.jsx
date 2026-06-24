import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { products } from '../data/mockData';

function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [addedMessage, setAddedMessage] = useState('');

  const product = products.find(p => p.id === parseInt(id));

  if (!product) {
    return (
      <div className="product-detail-page" data-testid="product-not-found">
        <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <h2>Product Not Found</h2>
          <p>The product you're looking for doesn't exist.</p>
          <button className="primary-btn" onClick={() => navigate('/products')}>
            Back to Products
          </button>
        </div>
      </div>
    );
  }

  const isOutOfStock = product.stock === 0;

  const handleAddToCart = () => {
    // BUG #8: No validation against product.stock — can add any quantity
    addToCart(product, quantity);
    setAddedMessage(`Added ${quantity} × ${product.name} to cart!`);
    setTimeout(() => setAddedMessage(''), 3000);
  };

  return (
    <div className="product-detail-page" id="product-detail-page" data-testid="product-detail-page">
      <button
        className="back-btn"
        onClick={() => navigate('/products')}
        id="back-to-products"
        data-testid="back-to-products"
      >
        ← Back to Products
      </button>

      <div className="product-detail-card glass-card">
        <div className="product-detail-grid">
          <div
            className="product-detail-image"
            style={{ background: product.image }}
            data-testid="product-detail-image"
          >
            {isOutOfStock && (
              <div className="out-of-stock-overlay large">Out of Stock</div>
            )}
          </div>

          <div className="product-detail-info">
            <span className="product-detail-category" data-testid="product-detail-category">
              {product.category}
            </span>
            <h1 className="product-detail-name" id="product-detail-name" data-testid="product-detail-name">
              {product.name}
            </h1>
            <p className="product-detail-price" id="product-detail-price" data-testid="product-detail-price">
              ${product.price.toFixed(2)}
            </p>
            <p className="product-detail-description" data-testid="product-detail-description">
              {product.description}
            </p>

            <div className="product-detail-stock" data-testid="product-detail-stock">
              <span className={`stock-indicator ${isOutOfStock ? 'out' : 'in'}`}>
                {isOutOfStock ? '● Out of Stock' : `● ${product.stock} in stock`}
              </span>
            </div>

            <div className="product-detail-actions">
              <div className="quantity-selector">
                <button
                  className="qty-btn"
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  id="detail-qty-decrease"
                  data-testid="detail-qty-decrease"
                >
                  −
                </button>
                <input
                  type="number"
                  className="qty-input"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                  id="detail-qty-input"
                  data-testid="detail-qty-input"
                />
                <button
                  className="qty-btn"
                  onClick={() => setQuantity(q => q + 1)}
                  id="detail-qty-increase"
                  data-testid="detail-qty-increase"
                >
                  +
                </button>
              </div>

              <button
                className={`add-to-cart-detail-btn ${isOutOfStock ? 'disabled' : ''}`}
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                id="detail-add-to-cart"
                data-testid="detail-add-to-cart"
              >
                {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
              </button>
            </div>

            {addedMessage && (
              <div className="added-message" data-testid="added-message">
                ✓ {addedMessage}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductDetail;
