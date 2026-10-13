/**
 * Text sanitisation helpers used by the request validators.
 *
 * Free-text fields (gig titles/descriptions, booking notes) are stored and
 * later rendered in the React UI. React already escapes text on render, but
 * we also clean the data on the way IN so that stored content is safe for
 * any future consumer (emails, CSV exports, admin tools) - defence in depth
 * against stored cross-site scripting (XSS).
 */

const TAG_PATTERN = /<[^>]*>/g; // Anything that looks like an HTML/XML tag, e.g. <script>, <img onerror=...>.
const ANGLE_BRACKETS = /[<>]/g; // Leftover/unbalanced brackets that could be used to rebuild a tag.
// Control characters except tab (\x09), newline (\x0A) and carriage return (\x0D).
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/**
 * Strips HTML tags, angle brackets and control characters, collapses runs
 * of spaces, and trims. Newlines are kept when `multiline` is true (gig
 * descriptions) and collapsed otherwise (titles).
 */
function sanitizeText(value, { multiline = false } = {}) {
  if (typeof value !== 'string') return value; // Non-strings are rejected by the type checks in the validators instead.
  // Remove tags until nothing changes: a single pass turns "<scr<script>ipt>" into "<script>"
  // (CodeQL js/incomplete-multi-character-sanitization). Leftover brackets are then removed too.
  let clean = value;
  let previous;
  do {
    previous = clean;
    clean = clean.replace(TAG_PATTERN, '');
  } while (clean !== previous);
  clean = clean.replace(ANGLE_BRACKETS, '').replace(CONTROL_CHARS, '');
  clean = multiline
    ? clean.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n') // Keep paragraphs, but no huge vertical gaps.
    : clean.replace(/\s+/g, ' ');
  return clean.trim();
}

/** Escapes characters that have special meaning in a regular expression. */
function escapeRegex(value) {
  // Used for the gig search box: user text is matched literally, so it can't
  // inject regex operators or craft a catastrophic-backtracking (ReDoS) pattern.
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { sanitizeText, escapeRegex };
