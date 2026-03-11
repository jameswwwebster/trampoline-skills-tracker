import React from 'react';
import { Link } from 'react-router-dom';
import { SHOP_PRODUCTS } from './shopProducts';
import './shop.css';

function formatPrice(product) {
  const prices = product.variants.map(v => v.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) return `£${(min / 100).toFixed(2)}`;
  return `From £${(min / 100).toFixed(2)}`;
}

export default function ShopListing() {
  return (
    <div>
      <div style={{ padding: '1.5rem 1.5rem 0', borderBottom: '1px solid #eee' }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>Kit Shop</h1>
        <p style={{ color: '#666', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          Kit is collected from the club — no delivery.
        </p>
      </div>
      <div className="shop-grid">
        {SHOP_PRODUCTS.map(product => (
          <Link key={product.id} to={`/booking/shop/${product.id}`} className="shop-card">
            <img
              src={product.images[0]}
              alt={product.name}
              className="shop-card-img"
            />
            <div className="shop-card-body">
              <p className="shop-card-name">{product.name}</p>
              <p className="shop-card-price">{formatPrice(product)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
