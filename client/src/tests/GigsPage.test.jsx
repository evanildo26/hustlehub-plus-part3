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
  return { ...actual, api: { listGigs: vi.fn(), categories: vi.fn() } };
});

const page = (gigs) => ({ data: gigs, pagination: { page: 1, limit: 12, total: gigs.length, pages: 1 } });

beforeEach(() => {
  useAuth.mockReturnValue({ user: null });
  api.categories.mockResolvedValue({ data: [{ category: 'design', count: 3 }, { category: 'writing', count: 1 }], total: 4 });
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

  test('category chips show live counts and filter the results when clicked', async () => {
    api.listGigs.mockResolvedValue(page([sampleGig()]));
    renderWithRouter(<GigsPage />);

    const designChip = await screen.findByRole('button', { name: /Design\s*3 gigs/ });
    await userEvent.click(designChip);

    expect(api.listGigs).toHaveBeenLastCalledWith({ search: '', category: 'design', page: 1, limit: 12 });
    expect(designChip).toHaveAttribute('aria-pressed', 'true');
  });

  test('popular search pills run a search', async () => {
    api.listGigs.mockResolvedValue(page([sampleGig()]));
    renderWithRouter(<GigsPage />);
    await screen.findByText('1 gig available');

    await userEvent.click(screen.getByRole('button', { name: 'Logo' }));
    expect(api.listGigs).toHaveBeenLastCalledWith({ search: 'Logo', category: '', page: 1, limit: 12 });
    expect(screen.getByLabelText('Search gigs')).toHaveValue('Logo');
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
