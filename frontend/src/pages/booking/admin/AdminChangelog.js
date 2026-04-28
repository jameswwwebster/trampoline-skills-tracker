import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import ChangelogPanel from './ChangelogPanel';
import '../booking-shared.css';

export default function AdminChangelog() {
  const navigate = useNavigate();
  return (
    <div className="bk-page">
      <button
        type="button"
        className="bk-btn bk-btn--sm"
        onClick={() => navigate('/admin-hub')}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginBottom: '1rem', border: '1px solid var(--booking-border)' }}
      >
        <ArrowLeftIcon style={{ width: 14, height: 14 }} /> Admin
      </button>
      <ChangelogPanel />
    </div>
  );
}
