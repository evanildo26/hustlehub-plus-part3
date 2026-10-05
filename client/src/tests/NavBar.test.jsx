import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import NavBar from '../components/NavBar';
import { useAuth } from '../context/AuthContext';
import { renderWithRouter } from './testUtils';

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));

const linkNames = () => screen.getAllByRole('link').map((l) => l.textContent);

describe('NavBar', () => {
  test('anonymous visitors see browse, log in and sign up', () => {
    useAuth.mockReturnValue({ user: null, logout: vi.fn() });
    renderWithRouter(<NavBar />);
    expect(linkNames()).toEqual(expect.arrayContaining(['Browse gigs', 'Log in', 'Sign up']));
  });

  test('freelancers see gig and earnings links but not admin', () => {
    useAuth.mockReturnValue({ user: { name: 'Thandiwe', role: 'freelancer' }, logout: vi.fn() });
    renderWithRouter(<NavBar />);
    expect(linkNames()).toEqual(expect.arrayContaining(['My gigs', 'Earnings']));
    expect(linkNames()).not.toContain('Admin');
  });

  test('clients do not see freelancer or admin links', () => {
    useAuth.mockReturnValue({ user: { name: 'Sipho', role: 'client' }, logout: vi.fn() });
    renderWithRouter(<NavBar />);
    expect(linkNames()).toEqual(expect.arrayContaining(['My bookings', 'Payments']));
    expect(linkNames()).not.toContain('My gigs');
    expect(linkNames()).not.toContain('Admin');
  });

  test('log out clears the session and returns to the login page', async () => {
    const logout = vi.fn();
    useAuth.mockReturnValue({ user: { name: 'Sipho', role: 'client' }, logout });
    renderWithRouter(<NavBar />);

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(logout).toHaveBeenCalled();
    expect(screen.getByTestId('location')).toHaveTextContent('/login');
  });
});
