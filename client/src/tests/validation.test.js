import { describe, expect, test } from 'vitest';
import { PASSWORD_RULES, validateBookingNotes, validateGig, validateLogin, validateRegister } from '../utils/validation';

const validRegistration = { name: 'Sipho Dlamini', email: 'sipho@example.com', password: 'StrongPass1!', confirmPassword: 'StrongPass1!', role: 'client' };
const validGig = { title: 'Logo design', description: 'A clean modern logo with two revisions.', category: 'design', price: '150.50', deliveryDays: '3' };

describe('validateRegister', () => {
  test('accepts a valid registration', () => {
    expect(validateRegister(validRegistration)).toEqual({});
  });

  test('rejects script tags in the name', () => {
    expect(validateRegister({ ...validRegistration, name: '<script>x</script>' }).name).toMatch(/only contain letters/);
  });

  test('rejects the admin role (cannot self-register)', () => {
    expect(validateRegister({ ...validRegistration, role: 'admin' }).role).toBeDefined();
  });

  test('requires matching passwords', () => {
    expect(validateRegister({ ...validRegistration, confirmPassword: 'Different1!' }).confirmPassword).toBe('Passwords do not match');
  });

  test.each(['short1!', 'alllowercase1!', 'ALLUPPERCASE1!', 'NoNumbers!!', 'NoSymbols123'])('rejects weak password %s', (password) => {
    expect(validateRegister({ ...validRegistration, password, confirmPassword: password }).password).toBeDefined();
  });
});

describe('PASSWORD_RULES', () => {
  test('every rule passes for a strong password', () => {
    expect(PASSWORD_RULES.every((r) => r.test('StrongPass1!'))).toBe(true);
  });
});

describe('validateLogin', () => {
  test('requires a valid email and a password', () => {
    expect(validateLogin({ email: '', password: '' })).toEqual({ email: 'Email is required', password: 'Password is required' });
    expect(validateLogin({ email: 'bad', password: 'x' }).email).toBe('Enter a valid email address');
  });
});

describe('validateGig', () => {
  test('accepts a valid gig', () => {
    expect(validateGig(validGig)).toEqual({});
  });

  test.each([
    ['title', { title: 'abc' }],
    ['title', { title: 'Logo <b>bold</b> design' }],
    ['description', { description: 'too short' }],
    ['category', { category: 'hacking' }],
    ['price', { price: '10' }],
    ['price', { price: '100.555' }],
    ['deliveryDays', { deliveryDays: '0' }],
    ['deliveryDays', { deliveryDays: '2.5' }],
  ])('flags %s for %o', (field, override) => {
    expect(validateGig({ ...validGig, ...override })[field]).toBeDefined();
  });
});

describe('validateBookingNotes', () => {
  test('limits length and blocks markup', () => {
    expect(validateBookingNotes('Please use blue')).toEqual({});
    expect(validateBookingNotes('x'.repeat(501)).notes).toBeDefined();
    expect(validateBookingNotes('<img src=x>').notes).toBeDefined();
  });
});
