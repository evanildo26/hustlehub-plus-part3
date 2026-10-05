import { screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import ProtectedRoute from '../components/ProtectedRoute';
import { useAuth } from '../context/AuthContext';
import { renderWithRouter } from './testUtils';

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));

const renderGuarded = (roles) =>
  renderWithRouter(
    <ProtectedRoute roles={roles}>
      <p>Secret earnings page</p>
    </ProtectedRoute>,
    { route: '/earnings', path: '/earnings' }
  );

describe('ProtectedRoute', () => {
  test('redirects anonymous visitors to the login page', () => {
    useAuth.mockReturnValue({ user: null, loading: false });
    renderGuarded(['freelancer']);
    expect(screen.queryByText('Secret earnings page')).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/login');
  });

  test('shows access denied to a logged-in user with the wrong role', () => {
    useAuth.mockReturnValue({ user: { role: 'client' }, loading: false });
    renderGuarded(['freelancer']);
    expect(screen.getByRole('heading', { name: 'Access denied' })).toBeInTheDocument();
    expect(screen.queryByText('Secret earnings page')).not.toBeInTheDocument();
  });

  test('renders the page for an allowed role', () => {
    useAuth.mockReturnValue({ user: { role: 'freelancer' }, loading: false });
    renderGuarded(['freelancer']);
    expect(screen.getByText('Secret earnings page')).toBeInTheDocument();
  });

  test('shows a loader while the session is being checked', () => {
    useAuth.mockReturnValue({ user: null, loading: true });
    renderGuarded(['freelancer']);
    expect(screen.getByRole('status')).toHaveTextContent('Checking your session');
  });
});
