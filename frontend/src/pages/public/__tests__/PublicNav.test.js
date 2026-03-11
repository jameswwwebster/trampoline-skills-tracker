import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicNav from '../PublicNav';

test('renders brand name', () => {
  render(<MemoryRouter><PublicNav /></MemoryRouter>);
  expect(screen.getByText('Trampoline Life')).toBeInTheDocument();
});

test('renders Sessions link', () => {
  render(<MemoryRouter><PublicNav /></MemoryRouter>);
  expect(screen.getByText('Sessions')).toBeInTheDocument();
});

test('renders Policies link', () => {
  render(<MemoryRouter><PublicNav /></MemoryRouter>);
  expect(screen.getByText('Policies')).toBeInTheDocument();
});

test('renders Book a session button', () => {
  render(<MemoryRouter><PublicNav /></MemoryRouter>);
  expect(screen.getByText('Book a session')).toBeInTheDocument();
});

test('renders Shop link', () => {
  render(<MemoryRouter><PublicNav /></MemoryRouter>);
  expect(screen.getByText('Shop')).toBeInTheDocument();
});
