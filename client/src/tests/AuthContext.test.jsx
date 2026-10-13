import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { api } from '../api/client';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, api: { login: vi.fn(), logout: vi.fn(), me: vi.fn() } };
});

function Probe() {
  const { user, login, logout } = useAuth();
  return (
    <div>
      <p data-testid="user">{user ? user.name : 'anonymous'}</p>
      <button type="button" onClick={() => login('sipho@demo.hustlehub.local', 'DemoPass1!')}>
        login
      </button>
      <button type="button" onClick={logout}>
        logout
      </button>
    </div>
  );
}

const renderProvider = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );

beforeEach(() => {
  sessionStorage.clear();
  api.login.mockResolvedValue({ token: 'jwt-123', data: { id: 'c1', name: 'Sipho', role: 'client' } });
});

describe('AuthContext logout', () => {
  test('revokes the token on the server, then clears the session', async () => {
    api.logout.mockResolvedValue({ success: true });
    renderProvider();

    await userEvent.click(screen.getByRole('button', { name: 'login' }));
    expect(screen.getByTestId('user')).toHaveTextContent('Sipho');
    expect(sessionStorage.getItem('hh_token')).toBe('jwt-123');

    await userEvent.click(screen.getByRole('button', { name: 'logout' }));
    expect(api.logout).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('anonymous')).toBeInTheDocument();
    expect(sessionStorage.getItem('hh_token')).toBeNull();
  });

  test('still clears the local session if the server cannot be reached', async () => {
    api.logout.mockRejectedValue(new Error('offline'));
    renderProvider();

    await userEvent.click(screen.getByRole('button', { name: 'login' }));
    await userEvent.click(screen.getByRole('button', { name: 'logout' }));
    expect(await screen.findByText('anonymous')).toBeInTheDocument();
    expect(sessionStorage.getItem('hh_token')).toBeNull();
  });
});
