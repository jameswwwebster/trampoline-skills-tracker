import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicHome from '../PublicHome';

test('renders skeleton placeholder text', () => {
  render(<MemoryRouter><PublicHome /></MemoryRouter>);
  expect(screen.getByText(/Homepage coming soon/i)).toBeInTheDocument();
});
