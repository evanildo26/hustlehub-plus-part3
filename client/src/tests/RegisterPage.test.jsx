import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import RegisterPage from '../pages/RegisterPage';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';
import { renderWithRouter } from './testUtils';

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));

const register = vi.fn();

beforeEach(() => {
  useAuth.mockReturnValue({ user: null, register });
});

const renderRegister = () => renderWithRouter(<RegisterPage />, { route: '/register', path: '/register' });

async function fillValidForm() {
  await userEvent.type(screen.getByLabelText('Full name'), 'Lerato Mokoena');
  await userEvent.type(screen.getByLabelText('Email'), 'lerato@example.com');
  await userEvent.type(screen.getByLabelText('Password'), 'StrongPass1!');
  await userEvent.type(screen.getByLabelText('Confirm password'), 'StrongPass1!');
}

describe('RegisterPage', () => {
  test('only offers client and freelancer roles (no admin)', () => {
    renderRegister();
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.value)).toEqual(['client', 'freelancer']);
  });

  test('password checklist updates as the user types', async () => {
    renderRegister();
    const rules = screen.getByRole('list', { name: 'Password requirements' });
    expect(within(rules).getByText('At least 8 characters').closest('li')).not.toHaveClass('ok');

    await userEvent.type(screen.getByLabelText('Password'), 'StrongPass1!');

    within(rules)
      .getAllByRole('listitem')
      .forEach((li) => expect(li).toHaveClass('ok'));
  });

  test('blocks submission when passwords do not match', async () => {
    renderRegister();
    await userEvent.type(screen.getByLabelText('Full name'), 'Lerato Mokoena');
    await userEvent.type(screen.getByLabelText('Email'), 'lerato@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'StrongPass1!');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'Different1!');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  test('registers a freelancer without sending confirmPassword, then goes to login', async () => {
    register.mockResolvedValue({});
    renderRegister();

    await userEvent.click(screen.getByLabelText(/Offer my services/));
    await fillValidForm();
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(register).toHaveBeenCalledWith({ name: 'Lerato Mokoena', email: 'lerato@example.com', password: 'StrongPass1!', role: 'freelancer' });
    expect(await screen.findByTestId('location')).toHaveTextContent('/login');
  });

  test('shows server-side field errors next to the right input', async () => {
    register.mockRejectedValue(new ApiError('Validation failed', 400, [{ field: 'email', message: 'A valid email address is required' }]));
    renderRegister();
    await fillValidForm();
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('A valid email address is required')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });
});
