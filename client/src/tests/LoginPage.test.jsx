import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import LoginPage from '../pages/LoginPage';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';
import { renderWithRouter } from './testUtils';

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));

const login = vi.fn();

beforeEach(() => {
  useAuth.mockReturnValue({ user: null, login, sessionExpired: false });
});

const renderLogin = () => renderWithRouter(<LoginPage />, { route: '/login', path: '/login' });

describe('LoginPage', () => {
  test('renders the login form', () => {
    renderLogin();
    expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/register');
  });

  test('shows validation errors and does not call the API when fields are empty', async () => {
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(login).not.toHaveBeenCalled();
  });

  test('logs in with a trimmed email and redirects a freelancer to their gigs', async () => {
    login.mockResolvedValue({ role: 'freelancer' });
    renderLogin();

    await userEvent.type(screen.getByLabelText('Email'), '  thandiwe@example.com ');
    await userEvent.type(screen.getByLabelText('Password'), 'StrongPass1!');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(login).toHaveBeenCalledWith('thandiwe@example.com', 'StrongPass1!');
    expect(await screen.findByTestId('location')).toHaveTextContent('/my-gigs');
  });

  test('shows the API\'s generic error and clears the password on failure', async () => {
    login.mockRejectedValue(new ApiError('Invalid email or password.', 401));
    renderLogin();

    await userEvent.type(screen.getByLabelText('Email'), 'thandiwe@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'WrongPass1!');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
    expect(screen.getByLabelText('Password')).toHaveValue('');
  });

  test('shows the rate-limit message when too many attempts are made', async () => {
    login.mockRejectedValue(new ApiError('Too many failed login attempts. Please wait 15 minutes before trying again.', 429));
    renderLogin();

    await userEvent.type(screen.getByLabelText('Email'), 'thandiwe@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'WrongPass1!');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Too many failed login attempts/);
  });
});
