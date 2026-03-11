import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicHome from '../PublicHome';

test('renders public page', () => {
  render(<MemoryRouter><PublicHome /></MemoryRouter>);
  expect(document.querySelector('.public-page')).toBeInTheDocument();
});

test('renders hero headline', () => {
  render(<MemoryRouter><PublicHome /></MemoryRouter>);
  expect(screen.getByText(/The only/i)).toBeInTheDocument();
  expect(screen.getByText(/club in Newcastle/i)).toBeInTheDocument();
});

test('renders Book a session CTA', () => {
  render(<MemoryRouter><PublicHome /></MemoryRouter>);
  const ctaLinks = screen.getAllByText('Book a session');
  expect(ctaLinks.length).toBeGreaterThanOrEqual(1);
});
