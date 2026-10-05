import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

/** Shows the current path so tests can assert on navigation. */
// oxlint-disable-next-line react/only-export-components -- test helper, never hot-reloaded
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

/**
 * Renders `ui` at `route` inside a router. `path` is the route pattern the
 * element is mounted on (e.g. "/gigs/:id"); any other path renders nothing,
 * so redirects can be detected with the location probe.
 */
export function renderWithRouter(ui, { route = '/', path = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path={path} element={ui} />
        <Route path="*" element={null} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>
  );
}

export const sampleGig = (overrides = {}) => ({
  id: '65a000000000000000000001',
  title: 'Modern logo and brand identity pack',
  description: 'Three logo concepts, two revision rounds, colour palette and font guide.',
  category: 'design',
  price: 1500,
  deliveryDays: 5,
  isActive: true,
  freelancer: { id: 'f1', name: 'Thandiwe Nkosi' },
  ...overrides,
});
