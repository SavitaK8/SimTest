import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';

function ProductCard({ product }) {
  const { addToCart } = useCart();
  const isOutOfStock = product.stock === 0;

  const handleAddToCart = () => {
    // BUG #8: Can add to cart even when stock is 0 — only visual indication, no functional guard beyond label
    if (!isOutOfStock) {
      addToCart(product, 1);
    }
  };

  return (
    <div className="product-card" id={`product-card-${product.id}`} data-testid={`product-card-${product.id}`}>
      <Link to={`/products/${product.id}`} className="product-card-link">
        <div
          className="product-image"
          style={{ background: product.image }}
          data-testid={`product-image-${product.id}`}
        >
          {isOutOfStock && (
            <div className="out-of-stock-overlay" data-testid={`out-of-stock-${product.id}`}>
              Out of Stock
            </div>
          )}
        </div>
        <div className="product-info">
          <h3 className="product-name" data-testid={`product-name-${product.id}`}>
            {product.name}
          </h3>
          <p className="product-category">{product.category}</p>
          <p className="product-price" data-testid={`product-price-${product.id}`}>
            ${product.price.toFixed(2)}
          </p>
        </div>
      </Link>
      <button
        className={`add-to-cart-btn ${isOutOfStock ? 'disabled' : ''}`}
        onClick={handleAddToCart}
        id={`add-to-cart-${product.id}`}
        data-testid={`add-to-cart-${product.id}`}
        disabled={isOutOfStock}
      >
        {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
      </button>
    </div>
  );
}

export default ProductCard;
