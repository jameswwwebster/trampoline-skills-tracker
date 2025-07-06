import React from 'react';

const LevelDisplay = ({ level, showName = true, className = '', size = 'normal' }) => {
  if (!level) {
    return (
      <span className={`badge badge-secondary ${className}`}>
        Not started
      </span>
    );
  }

  const sizeClass = size === 'small' ? 'level-badge-sm' : 'level-badge';
  
  return (
    <span className={`level-badge ${sizeClass} ${className}`}>
      Level {level.identifier}: {showName ? level.name : ''}
      {!showName && (
        <small className="text-muted d-block">
          {level.name}
        </small>
      )}
    </span>
  );
};

export default LevelDisplay; 