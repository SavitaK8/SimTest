import React from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { products } from '../data/mockData';

function Dashboard() {
  const featuredProducts = products.slice(0, 4);

  return (
    <div className="dashboard-page" id="dashboard-page" data-testid="dashboard-page">
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title" data-testid="hero-title">
            Discover <span className="gradient-text">Premium</span> Products
          </h1>
          <p className="hero-subtitle">
            Curated collection of the finest items, delivered to your doorstep
          </p>
          <Link to="/products" className="hero-cta" id="browse-products-btn" data-testid="browse-products-btn">
            Browse All Products
            <span className="cta-arrow">→</span>
          </Link>
        </div>
        <div className="hero-glow" />
      </section>

      <section className="featured-section">
        <div className="section-header">
          <h2 className="section-title" data-testid="featured-title">Featured Products</h2>
          <Link to="/products" className="view-all-link" data-testid="view-all-link">
            View All →
          </Link>
        </div>
        <div className="products-grid" id="featured-grid" data-testid="featured-grid">
          {featuredProducts.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section className="stats-section">
        <div className="stat-card" data-testid="stat-products">
          <span className="stat-number">{products.length}</span>
          <span className="stat-label">Products</span>
        </div>
        <div className="stat-card" data-testid="stat-categories">
          <span className="stat-number">4</span>
          <span className="stat-label">Categories</span>
        </div>
        <div className="stat-card" data-testid="stat-shipping">
          <span className="stat-number">Free</span>
          <span className="stat-label">Shipping</span>
        </div>
        <div className="stat-card" data-testid="stat-support">
          <span className="stat-number">24/7</span>
          <span className="stat-label">Support</span>
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
