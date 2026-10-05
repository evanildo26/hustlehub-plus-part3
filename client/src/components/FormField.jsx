/**
 * Label + input + error message, wired together for accessibility
 * (aria-invalid and aria-describedby let screen readers announce errors).
 */
export default function FormField({ id, label, error, hint, as = 'input', children, ...inputProps }) {
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined;
  const Control = as;

  return (
    <div className={`field${error ? ' field--error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <Control id={id} name={id} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...inputProps}>
        {children}
      </Control>
      {hint && !error && (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field__error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
