import React, { useState } from 'react';
import ProductCard from '../components/ProductCard';
import { products, categories } from '../data/mockData';

function Products() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="products-page" id="products-page" data-testid="products-page">
      <div className="products-header">
        <h1 data-testid="products-heading">All Products</h1>
        <p>Browse our complete collection</p>
      </div>

      <div className="products-filters">
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            id="search-input"
            data-testid="search-input"
          />
          {/* BUG #7: dangerouslySetInnerHTML renders search term — typing <script> causes console error */}
          <div
            className="search-preview"
            data-testid="search-preview"
            dangerouslySetInnerHTML={{ __html: searchTerm ? `Showing results for: <strong>${searchTerm}</strong>` : '' }}
          />
        </div>

        <div className="category-filters" id="category-filters" data-testid="category-filters">
          {categories.map(category => (
            <button
              key={category}
              className={`category-btn ${selectedCategory === category ? 'active' : ''}`}
              onClick={() => setSelectedCategory(category)}
              id={`category-${category.toLowerCase()}`}
              data-testid={`category-${category.toLowerCase()}`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="products-results-count" data-testid="results-count">
        {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} found
      </div>

      <div className="products-grid" id="products-grid" data-testid="products-grid">
        {filteredProducts.length > 0 ? (
          filteredProducts.map(product => (
            <ProductCard key={product.id} product={product} />
          ))
        ) : (
          <div className="no-results" data-testid="no-results">
            <p>No products found matching your criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Products;
