import React from 'react';
import PublicNav from './PublicNav';
import PublicFooter from './PublicFooter';
import './public.css';

export default function PublicPolicies() {
  return (
    <div className="public-page">
      <PublicNav />
      <main className="pub-main">
        <p style={{ padding: '2rem' }}>Policies coming soon</p>
      </main>
      <PublicFooter />
    </div>
  );
}
