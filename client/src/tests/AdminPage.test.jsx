import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import AdminPage from '../pages/AdminPage';
import { api } from '../api/client';
import { renderWithRouter } from './testUtils';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    api: { adminStats: vi.fn(), adminUsers: vi.fn(), adminGigs: vi.fn(), securityEvents: vi.fn(), revokeSessions: vi.fn(), deleteGig: vi.fn() },
  };
});

const security = (overrides = {}) => ({
  windowHours: 24,
  totals: { failedLogins: 14, successfulLogins: 6, accountsLocked: 2, currentlyLocked: 1, accessDenied: 3, injectionAttempts: 1, invalidTokens: 2, rateLimited: 0, alerts: 1 },
  topIps: [{ ip: '203.0.113.9', count: 12 }],
  alerts: [
    {
      id: 'a1',
      event: 'SECURITY_ALERT',
      level: 'alert',
      ip: '203.0.113.9',
      createdAt: '2026-10-13T08:00:00Z',
      details: { pattern: 'BRUTE_FORCE_LOGIN', eventCount: 12, windowMinutes: 5 },
    },
  ],
  recentEvents: [
    {
      id: 'e1',
      event: 'LOGIN_FAILED',
      level: 'security',
      ip: '203.0.113.9',
      createdAt: '2026-10-13T07:59:00Z',
      details: { email: 'si***@demo.hustlehub.local', reason: 'bad_password' },
    },
    { id: 'e2', event: 'NOSQL_INJECTION_ATTEMPT', level: 'security', ip: '198.51.100.7', createdAt: '2026-10-13T07:58:00Z', path: '/api/auth/login', details: {} },
  ],
  ...overrides,
});

beforeEach(() => {
  api.adminStats.mockResolvedValue({
    data: { users: { client: 2, freelancer: 9, admin: 1 }, gigs: 29, bookings: 20, transactionVolume: 1000, platformRevenue: 100 },
  });
  api.adminUsers.mockResolvedValue({
    data: [{ id: 'u1', name: 'Sipho Dlamini', email: 'sipho@demo.hustlehub.local', role: 'client', createdAt: '2026-07-01' }],
  });
  api.adminGigs.mockResolvedValue({ data: [] });
  api.securityEvents.mockResolvedValue({ data: security() });
});

const renderAdmin = () => renderWithRouter(<AdminPage />, { route: '/admin', path: '/admin' });

describe('Admin security monitor', () => {
  test('shows alerts with an icon and label, the totals and recent events in plain language', async () => {
    renderAdmin();
    const alerts = await screen.findByRole('list', { name: 'Security alerts' });
    expect(within(alerts).getByText('Alert: Possible brute-force login attack')).toBeInTheDocument();
    expect(within(alerts).getByText(/12 events from 203\.0\.113\.9 in 5 minutes/)).toBeInTheDocument();

    expect(screen.getByText('Failed logins').nextSibling).toHaveTextContent('14');
    expect(screen.getByText('1 locked right now')).toBeInTheDocument();
    expect(screen.getByText('Failed login')).toBeInTheDocument();
    expect(screen.getByText(/si\*\*\*@demo\.hustlehub\.local · bad password/)).toBeInTheDocument();
    expect(screen.getByText('Injection attempt')).toBeInTheDocument();
  });

  test('says so when there are no alerts', async () => {
    api.securityEvents.mockResolvedValue({ data: security({ alerts: [] }) });
    renderAdmin();
    expect(await screen.findByText('No security alerts in this period.')).toBeInTheDocument();
  });

  test('changing the period reloads the events for that window', async () => {
    renderAdmin();
    await userEvent.selectOptions(await screen.findByLabelText('Period'), '168');
    expect(api.securityEvents).toHaveBeenLastCalledWith(168);
  });

  test("revoking a user's sessions asks for confirmation, then shows the result", async () => {
    api.revokeSessions.mockResolvedValue({ message: 'All sessions for Sipho Dlamini have been revoked.' });
    renderAdmin();

    await userEvent.click(await screen.findByRole('button', { name: 'Revoke sessions' }));
    expect(api.revokeSessions).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Revoke' }));

    expect(api.revokeSessions).toHaveBeenCalledWith('u1');
    expect(await screen.findByText('All sessions for Sipho Dlamini have been revoked.')).toBeInTheDocument();
  });
});
