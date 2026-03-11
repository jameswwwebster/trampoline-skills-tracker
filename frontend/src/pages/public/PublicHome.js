import React from 'react';
import PublicNav from './PublicNav';
import PublicFooter from './PublicFooter';
import './public.css';

export default function PublicHome() {
  return (
    <div className="public-page">
      <PublicNav />
      <main style={{ flex: 1 }}>
        <p style={{ padding: '2rem' }}>Homepage coming soon</p>
      </main>
      <PublicFooter />
    </div>
  );
}
