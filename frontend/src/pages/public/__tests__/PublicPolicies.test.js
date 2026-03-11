import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicPolicies from '../PublicPolicies';

test('renders skeleton placeholder text', () => {
  render(<MemoryRouter><PublicPolicies /></MemoryRouter>);
  expect(screen.getByText(/Policies coming soon/i)).toBeInTheDocument();
});
