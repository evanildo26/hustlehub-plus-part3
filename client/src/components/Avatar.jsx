const PALETTE = ['#0f766e', '#7c3aed', '#c2410c', '#0369a1', '#be185d', '#4d7c0f', '#b45309', '#4338ca'];

/** Picks the same colour for the same name every time. */
function colourFor(name = '') {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || '?';

/** Initials avatar - no uploaded images, so nothing external to load or sanitise. */
export default function Avatar({ name, size = 'md' }) {
  return (
    <span className={`avatar avatar--${size} avatar--c${PALETTE.indexOf(colourFor(name))}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
