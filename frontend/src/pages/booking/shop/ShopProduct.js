import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProduct } from './shopProducts';
import './shop.css';

const CART_KEY = 'shopCart';

function getCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; }
}
function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function SizeGuide({ guide }) {
  const [open, setOpen] = useState(false);
  if (!guide) return null;

  return (
    <div className="shop-size-guide">
      <button className="shop-size-guide-toggle" onClick={() => setOpen(o => !o)}>
        {open ? '▲' : '▼'} Size guide
      </button>
      {open && (
        <div className="shop-size-guide-content">
          {guide.note && <p className="shop-size-note">{guide.note}</p>}
          {guide.sections?.map((section, i) => (
            <div key={i}>
              <p className="shop-size-section-title">{section.title}</p>
              <table className="shop-size-table">
                <thead>
                  <tr>{section.headers.map((h, j) => <th key={j}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {section.rows.map((row, k) => (
                    <tr key={k}>{row.map((cell, l) => <td key={l}>{cell}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {guide.externalUrl && (
            <a href={guide.externalUrl} target="_blank" rel="noopener noreferrer" className="shop-size-external-link">
              ↗ {guide.externalLabel || 'Full size guide'}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function ShopProduct() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const product = getProduct(productId);

  const [selectedSize, setSelectedSize] = useState('');
  const [qty, setQty] = useState(1);
  const [customisation, setCustomisation] = useState('');
  const [mainImg, setMainImg] = useState(0);
  const [added, setAdded] = useState(false);

  if (!product) {
    return <div style={{ padding: '2rem', color: '#888' }}>Product not found.</div>;
  }

  const selectedVariant = product.variants.find(v => v.label === selectedSize);
  const price = selectedVariant ? selectedVariant.price : null;

  function handleAddToCart() {
    if (!selectedSize) return;
    if (product.customisation?.required && !customisation.trim()) return;

    const cart = getCart();
    const existingIdx = cart.findIndex(
      i => i.productId === product.id && i.size === selectedSize && i.customisation === customisation.trim()
    );

    if (existingIdx >= 0) {
      cart[existingIdx].quantity += qty;
    } else {
      cart.push({
        productId: product.id,
        productName: product.name,
        size: selectedSize,
        quantity: qty,
        customisation: customisation.trim() || null,
        price: selectedVariant.price,
        image: product.images[0],
      });
    }

    saveCart(cart);
    window.dispatchEvent(new CustomEvent('shop-cart-update'));
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  const canAdd = selectedSize &&
    (!product.customisation?.required || customisation.trim());

  return (
    <div className="shop-product">
      <div className="shop-product-gallery">
        <img
          src={product.images[mainImg]}
          alt={product.name}
          className="shop-product-main-img"
        />
        {product.images.length > 1 && (
          <div className="shop-product-thumbs">
            {product.images.map((img, i) => (
              <img
                key={i}
                src={img}
                alt=""
                className={`shop-product-thumb${mainImg === i ? ' active' : ''}`}
                onClick={() => setMainImg(i)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="shop-product-info">
        <h1 className="shop-product-name">{product.name}</h1>
        <p className="shop-product-price">
          {price ? `£${(price / 100).toFixed(2)}` : 'Select a size'}
        </p>
        <p className="shop-product-desc">{product.description}</p>

        <div className="shop-field">
          <label>Size</label>
          <select value={selectedSize} onChange={e => setSelectedSize(e.target.value)}>
            <option value="">Select a size</option>
            {product.variants.map(v => (
              <option key={v.label} value={v.label}>{v.label} — £{(v.price / 100).toFixed(2)}</option>
            ))}
          </select>
        </div>

        {product.customisation && (
          <div className="shop-field">
            <label>{product.customisation.label}{product.customisation.required ? ' *' : ''}</label>
            <input
              type="text"
              placeholder={product.customisation.placeholder}
              maxLength={product.customisation.maxLength}
              value={customisation}
              onChange={e => setCustomisation(e.target.value.toUpperCase())}
            />
          </div>
        )}

        <div className="shop-field">
          <label>Quantity</label>
          <div className="shop-qty">
            <button onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
            <span>{qty}</span>
            <button onClick={() => setQty(q => Math.min(10, q + 1))}>+</button>
          </div>
        </div>

        <button className="shop-add-btn" onClick={handleAddToCart} disabled={!canAdd}>
          {added ? '✓ Added to cart' : 'Add to cart'}
        </button>

        <button
          style={{ marginTop: '0.5rem', width: '100%', background: 'none', border: '1px solid #ddd', borderRadius: 8, padding: '0.6rem', cursor: 'pointer', fontSize: '0.9rem' }}
          onClick={() => navigate('/booking/cart')}
        >
          View cart
        </button>

        <SizeGuide guide={product.sizeGuide} />
      </div>
    </div>
  );
}
