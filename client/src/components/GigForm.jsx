import { useState } from 'react';
import FormField from './FormField';
import { Alert } from './Feedback';
import { CATEGORIES, PRICE_MAX, PRICE_MIN, hasErrors, validateGig } from '../utils/validation';
import { capitalise } from '../utils/format';

const EMPTY = { title: '', description: '', category: '', price: '', deliveryDays: '', isActive: true };

/**
 * Create/edit form for a gig. Validates on submit, shows field errors from
 * either the client-side check or the API's response, and only ever sends
 * the fields the API allows.
 */
export default function GigForm({ initialValues, submitLabel, onSubmit }) {
  const [values, setValues] = useState(() => ({ ...EMPTY, ...initialValues }));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((errs) => ({ ...errs, [field]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    const clientErrors = validateGig(values);
    if (hasErrors(clientErrors)) {
      setErrors(clientErrors);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        title: values.title.trim(),
        description: values.description.trim(),
        category: values.category,
        price: Number(values.price),
        deliveryDays: Number(values.deliveryDays),
        isActive: Boolean(values.isActive),
      });
    } catch (err) {
      setErrors(err.fieldMap || {});
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="form card" onSubmit={handleSubmit} noValidate>
      <Alert>{formError}</Alert>
      <FormField id="title" label="Title" value={values.title} onChange={update('title')} error={errors.title} maxLength={100} placeholder="e.g. Modern logo and brand identity pack" />
      <FormField
        id="description"
        as="textarea"
        rows={6}
        label="Description"
        value={values.description}
        onChange={update('description')}
        error={errors.description}
        maxLength={2000}
        hint={`${values.description.trim().length}/2000 characters (minimum 20). Plain text only.`}
      />
      <div className="form__row">
        <FormField id="category" as="select" label="Category" value={values.category} onChange={update('category')} error={errors.category}>
          <option value="">Select a category</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {capitalise(c)}
            </option>
          ))}
        </FormField>
        <FormField
          id="price"
          type="number"
          inputMode="decimal"
          min={PRICE_MIN}
          max={PRICE_MAX}
          step="0.01"
          label="Price (ZAR)"
          value={values.price}
          onChange={update('price')}
          error={errors.price}
        />
        <FormField id="deliveryDays" type="number" min={1} max={90} step="1" label="Delivery (days)" value={values.deliveryDays} onChange={update('deliveryDays')} error={errors.deliveryDays} />
      </div>
      <label className="checkbox">
        <input type="checkbox" checked={Boolean(values.isActive)} onChange={update('isActive')} />
        Listed on the marketplace (clients can find and book it)
      </label>
      <div className="form__actions">
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
