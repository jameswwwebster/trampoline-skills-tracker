import React, { useEffect } from 'react';

export default function Toast({ message, type = 'success', onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div style={{
      position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
      background: type === 'error' ? '#e74c3c' : type === 'warning' ? '#e67e22' : '#27ae60',
      color: '#fff', padding: '0.75rem 1.25rem', borderRadius: 8,
      boxShadow: '0 4px 16px rgba(0,0,0,0.2)', zIndex: 9999,
      fontSize: '0.9rem', fontWeight: 500, maxWidth: '90vw', textAlign: 'center',
      cursor: 'pointer',
    }} onClick={onDismiss}>
      {message}
    </div>
  );
}
