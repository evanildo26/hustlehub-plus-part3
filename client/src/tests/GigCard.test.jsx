import { screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import GigCard from '../components/GigCard';
import { renderWithRouter, sampleGig } from './testUtils';

describe('GigCard', () => {
  test('renders the gig title, price, category and freelancer', () => {
    renderWithRouter(<GigCard gig={sampleGig()} />);
    expect(screen.getByRole('heading', { name: 'Modern logo and brand identity pack' })).toBeInTheDocument();
    expect(screen.getByText(/1\s?500,00/)).toBeInTheDocument(); // en-ZA currency formatting
    expect(screen.getByText('Design')).toBeInTheDocument();
    expect(screen.getByText('by Thandiwe Nkosi')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View Modern logo and brand identity pack' })).toHaveAttribute('href', '/gigs/65a000000000000000000001');
  });

  test('renders markup in data as plain text, never as HTML (XSS)', () => {
    const { container } = renderWithRouter(<GigCard gig={sampleGig({ title: '<img src=x onerror=alert(1)>' })} />);
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  test('truncates long descriptions', () => {
    renderWithRouter(<GigCard gig={sampleGig({ description: 'word '.repeat(60) })} />);
    expect(screen.getByText(/…$/)).toBeInTheDocument();
  });
});
