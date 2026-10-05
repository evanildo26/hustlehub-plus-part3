import { useState } from 'react';

/**
 * Two-step button for destructive actions (delete, cancel): the first click
 * asks "Are you sure?", the second performs the action. Avoids accidental
 * clicks without relying on blocking browser dialogs.
 */
export default function ConfirmButton({ onConfirm, children, confirmLabel = 'Yes, continue', className = 'btn btn--danger btn--sm', disabled }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!asking) {
    return (
      <button type="button" className={className} onClick={() => setAsking(true)} disabled={disabled}>
        {children}
      </button>
    );
  }

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      setAsking(false);
    }
  };

  return (
    <span className="confirm">
      <span className="confirm__question">Are you sure?</span>
      <button type="button" className="btn btn--danger btn--sm" onClick={confirm} disabled={busy}>
        {busy ? 'Working…' : confirmLabel}
      </button>
      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAsking(false)} disabled={busy}>
        No
      </button>
    </span>
  );
}
