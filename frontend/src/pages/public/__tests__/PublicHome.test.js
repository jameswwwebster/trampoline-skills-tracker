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

test('renders Session Information heading', () => {
  render(<MemoryRouter><PublicHome /></MemoryRouter>);
  expect(screen.getByText('Session Information')).toBeInTheDocument();
});

test('renders £6 per hour', () => {
  render(<MemoryRouter><PublicHome /></MemoryRouter>);
  expect(screen.getByText(/£6 per hour/i)).toBeInTheDocument();
});

test('renders Tuesday session times', () => {
  render(<MemoryRouter><PublicHome /></MemoryRouter>);
  expect(screen.getByText('Tuesday')).toBeInTheDocument();
});

test('renders Welfare Officer section', () => {
  render(<MemoryRouter><PublicHome /></MemoryRouter>);
  expect(screen.getByText('Welfare Officer')).toBeInTheDocument();
  expect(screen.getByText('Wendy')).toBeInTheDocument();
});

test('renders sponsors section', () => {
  render(<MemoryRouter><PublicHome /></MemoryRouter>);
  expect(screen.getByAltText('British Engines')).toBeInTheDocument();
});

test('renders contact address', () => {
  render(<MemoryRouter><PublicHome /></MemoryRouter>);
  expect(screen.getByText(/Kenton Lane/i)).toBeInTheDocument();
  expect(screen.getByText(/contact@trampoline.life/i)).toBeInTheDocument();
});
