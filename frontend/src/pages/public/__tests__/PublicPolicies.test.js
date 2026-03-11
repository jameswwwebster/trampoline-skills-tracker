import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicPolicies from '../PublicPolicies';

test('renders all five section headings', () => {
  render(<MemoryRouter><PublicPolicies /></MemoryRouter>);
  expect(screen.getByText('Coaches')).toBeInTheDocument();
  expect(screen.getByText('Participants')).toBeInTheDocument();
  expect(screen.getByText('Parents & Guardians')).toBeInTheDocument();
  expect(screen.getByText('Photography')).toBeInTheDocument();
  expect(screen.getByText('Other Policies')).toBeInTheDocument();
});

test('photography section references "your account on this site"', () => {
  render(<MemoryRouter><PublicPolicies /></MemoryRouter>);
  expect(screen.getByText(/your account on this site/i)).toBeInTheDocument();
});

test('other policies has BG links', () => {
  render(<MemoryRouter><PublicPolicies /></MemoryRouter>);
  expect(screen.getAllByText(/British Gymnastics/i).length).toBeGreaterThan(0);
  expect(screen.getByText(/Privacy Policy/i)).toBeInTheDocument();
});
