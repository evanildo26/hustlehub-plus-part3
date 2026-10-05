/**
 * Client-side validation that mirrors the API's rules.
 *
 * This is for user experience only - instant, friendly feedback before a
 * request is sent. It is NOT a security control: the API re-validates
 * everything, because anyone can bypass the browser and call it directly.
 * Each function returns an object of { field: message } (empty = valid).
 */

export const CATEGORIES = ['design', 'development', 'writing', 'marketing', 'video', 'music', 'business', 'other'];
export const PRICE_MIN = 50;
export const PRICE_MAX = 100000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_PATTERN = /^[a-zA-Z\s'-]+$/;
const MARKUP_PATTERN = /[<>]/;

export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 && p.length <= 128 },
  { id: 'lower', label: 'A lowercase letter', test: (p) => /[a-z]/.test(p) },
  { id: 'upper', label: 'An uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { id: 'number', label: 'A number', test: (p) => /[0-9]/.test(p) },
  { id: 'symbol', label: 'A special character', test: (p) => /[^a-zA-Z0-9]/.test(p) },
];

export function validateLogin({ email, password }) {
  const errors = {};
  if (!email.trim()) errors.email = 'Email is required';
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = 'Enter a valid email address';
  if (!password) errors.password = 'Password is required';
  return errors;
}

export function validateRegister({ name, email, password, confirmPassword, role }) {
  const errors = {};
  const trimmedName = name.trim();
  if (!trimmedName) errors.name = 'Name is required';
  else if (trimmedName.length < 2 || trimmedName.length > 100) errors.name = 'Name must be between 2 and 100 characters';
  else if (!NAME_PATTERN.test(trimmedName)) errors.name = 'Name may only contain letters, spaces, hyphens and apostrophes';

  if (!email.trim()) errors.email = 'Email is required';
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = 'Enter a valid email address';

  const failed = PASSWORD_RULES.find((rule) => !rule.test(password));
  if (!password) errors.password = 'Password is required';
  else if (failed) errors.password = `Password needs: ${failed.label.toLowerCase()}`;

  if (confirmPassword !== password) errors.confirmPassword = 'Passwords do not match';
  if (!['client', 'freelancer'].includes(role)) errors.role = 'Choose whether you are a client or a freelancer';
  return errors;
}

export function validateGig({ title, description, category, price, deliveryDays }) {
  const errors = {};
  const t = title.trim();
  const d = description.trim();
  if (t.length < 5 || t.length > 100) errors.title = 'Title must be between 5 and 100 characters';
  else if (MARKUP_PATTERN.test(t)) errors.title = 'Title cannot contain < or >';

  if (d.length < 20 || d.length > 2000) errors.description = 'Description must be between 20 and 2000 characters';
  else if (MARKUP_PATTERN.test(d)) errors.description = 'Description cannot contain < or >';

  if (!CATEGORIES.includes(category)) errors.category = 'Choose a category';

  const priceNumber = Number(price);
  if (price === '' || Number.isNaN(priceNumber)) errors.price = 'Price is required';
  else if (priceNumber < PRICE_MIN || priceNumber > PRICE_MAX) errors.price = `Price must be between R${PRICE_MIN} and R${PRICE_MAX.toLocaleString('en-ZA')}`;
  else if (!/^\d+(\.\d{1,2})?$/.test(String(price))) errors.price = 'Price may have at most two decimal places';

  const days = Number(deliveryDays);
  if (!Number.isInteger(days) || days < 1 || days > 90) errors.deliveryDays = 'Delivery time must be 1 to 90 whole days';
  return errors;
}

export function validateBookingNotes(notes) {
  const errors = {};
  if (notes.length > 500) errors.notes = 'Notes must be 500 characters or fewer';
  else if (MARKUP_PATTERN.test(notes)) errors.notes = 'Notes cannot contain < or >';
  return errors;
}

export const hasErrors = (errors) => Object.keys(errors).length > 0;
