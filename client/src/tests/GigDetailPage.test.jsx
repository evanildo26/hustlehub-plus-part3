import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import GigDetailPage from '../pages/GigDetailPage';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../api/client';
import { renderWithRouter, sampleGig } from './testUtils';

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, api: { getGig: vi.fn(), createBooking: vi.fn() } };
});

const renderDetail = () => renderWithRouter(<GigDetailPage />, { route: '/gigs/65a000000000000000000001', path: '/gigs/:id' });

beforeEach(() => {
  api.getGig.mockResolvedValue({ data: sampleGig() });
});

describe('GigDetailPage booking flow', () => {
  test('a client books the gig and sees the simulated payment confirmation', async () => {
    useAuth.mockReturnValue({ user: { id: 'c1', role: 'client' } });
    api.createBooking.mockResolvedValue({
      data: {
        booking: { amount: 1500, paymentReference: 'SIM-PAY-ABC123' },
        transaction: { reference: 'TXN-XYZ789' },
      },
    });
    renderDetail();

    await userEvent.type(await screen.findByLabelText(/Notes for the freelancer/), 'Navy and gold please');
    await userEvent.click(screen.getByRole('button', { name: /Book now/ }));

    expect(api.createBooking).toHaveBeenCalledWith('65a000000000000000000001', 'Navy and gold please');
    expect(await screen.findByText('Booking confirmed 🎉')).toBeInTheDocument();
    expect(screen.getByText('SIM-PAY-ABC123')).toBeInTheDocument();
    expect(screen.getByText('TXN-XYZ789')).toBeInTheDocument();
  });

  test('blocks notes containing markup before calling the API', async () => {
    useAuth.mockReturnValue({ user: { id: 'c1', role: 'client' } });
    renderDetail();

    await userEvent.type(await screen.findByLabelText(/Notes for the freelancer/), '<script>');
    await userEvent.click(screen.getByRole('button', { name: /Book now/ }));

    expect(screen.getByText('Notes cannot contain < or >')).toBeInTheDocument();
    expect(api.createBooking).not.toHaveBeenCalled();
  });

  test('shows the booking rate-limit message from the API', async () => {
    useAuth.mockReturnValue({ user: { id: 'c1', role: 'client' } });
    api.createBooking.mockRejectedValue(new ApiError('You are making bookings too quickly. Please wait a few minutes and try again.', 429));
    renderDetail();

    await userEvent.click(await screen.findByRole('button', { name: /Book now/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('You are making bookings too quickly');
  });

  test('anonymous visitors are asked to log in instead of booking', async () => {
    useAuth.mockReturnValue({ user: null });
    renderDetail();
    expect(await screen.findByRole('link', { name: 'Log in to book' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Book now/ })).not.toBeInTheDocument();
  });

  test('freelancers cannot book; owners get an edit link', async () => {
    useAuth.mockReturnValue({ user: { id: 'f1', role: 'freelancer' } });
    renderDetail();
    expect(await screen.findByRole('link', { name: 'Edit gig' })).toHaveAttribute('href', '/my-gigs/65a000000000000000000001/edit');
    expect(screen.queryByRole('button', { name: /Book now/ })).not.toBeInTheDocument();
  });
});
