import React from 'react';

export const getStatusBadge = (status) => {
  switch (status) {
    case 'AWARDED':
      return <span className="badge badge-warning">Awarded</span>;
    case 'PRINTED':
      return <span className="badge badge-info">Marked as Printed</span>;
    case 'DELIVERED':
      return <span className="badge badge-success">Delivered</span>;
    default:
      return <span className="badge badge-secondary">{status}</span>;
  }
};

export const getTypeText = (type) => {
  switch (type) {
    case 'LEVEL_COMPLETION':
      return 'Level Completion';
    case 'SPECIAL_ACHIEVEMENT':
      return 'Special Achievement';
    case 'PARTICIPATION':
      return 'Participation';
    default:
      return type;
  }
};
