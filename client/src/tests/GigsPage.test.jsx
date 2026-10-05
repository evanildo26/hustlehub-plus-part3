import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import GigsPage from '../pages/GigsPage';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../api/client';
import { renderWithRouter, sampleGig } from './testUtils';

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, api: { listGigs: vi.fn() } };
});

const page = (gigs) => ({ data: gigs, pagination: { page: 1, limit: 12, total: gigs.length, pages: 1 } });

beforeEach(() => {
  useAuth.mockReturnValue({ user: null });
});

describe('GigsPage', () => {
  test('loads and displays gigs from the API', async () => {
    api.listGigs.mockResolvedValue(page([sampleGig(), sampleGig({ id: '2', title: 'SEO blog articles', category: 'writing' })]));
    renderWithRouter(<GigsPage />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading gigs');
    expect(await screen.findByRole('heading', { name: 'SEO blog articles' })).toBeInTheDocument();
    expect(screen.getByText('2 gigs available')).toBeInTheDocument();
  });

  test('searching sends the search term and category to the API', async () => {
    api.listGigs.mockResolvedValue(page([sampleGig()]));
    renderWithRouter(<GigsPage />);
    await screen.findByText('1 gig available');

    await userEvent.type(screen.getByLabelText('Search gigs'), 'logo');
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'design');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(api.listGigs).toHaveBeenLastCalledWith({ search: 'logo', category: 'design', page: 1, limit: 12 });
  });

  test('shows an empty state when nothing matches', async () => {
    api.listGigs.mockResolvedValue(page([]));
    renderWithRouter(<GigsPage />);
    expect(await screen.findByText('No gigs found')).toBeInTheDocument();
  });

  test('shows a friendly error if the API cannot be reached', async () => {
    api.listGigs.mockRejectedValue(new ApiError('Unable to reach the server. Please check your connection and try again.', 0));
    renderWithRouter(<GigsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach the server');
  });
});
