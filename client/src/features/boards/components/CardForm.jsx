import { useRef, useState } from 'react';
import { priorities } from '@shared/constants';
import { errorMessage } from '@/utils/errors';
export function CardForm({
  card = {},
  busy,
  stale = false,
  onSubmit,
  onCancel,
  submitLabel = 'Save card',
}) {
  const pending = useRef(false);
  const [saving, setSaving] = useState(false);
  const locked = busy || saving;
  const [input, setInput] = useState({
    title: card.title || '',
    description: card.description || '',
    priority: card.priority || 'medium',
    dueDate: card.dueDate?.slice(0, 10) || '',
    labels: (card.labels || []).join(', '),
  });
  const field = (key) => ({
    disabled: locked,
    value: input[key],
    onChange: (event) => setInput((old) => ({ ...old, [key]: event.target.value })),
  });
  const [error, setError] = useState('');
  return (
    <form
      className="card-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (locked || stale || pending.current) return;
        setError('');
        if (!input.title.trim()) {
          setError('Enter a card title.');
          return;
        }
        const labels = input.labels
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean);
        if (labels.length > 10 || labels.some((value) => value.length > 32)) {
          setError('Use up to 10 labels, each at most 32 characters.');
          return;
        }
        pending.current = true;
        setSaving(true);
        try {
          const success = await onSubmit({
            ...input,
            title: input.title.trim(),
            labels,
            dueDate:
              input.dueDate === card.dueDate?.slice(0, 10)
                ? card.dueDate
                : input.dueDate
                  ? `${input.dueDate}T00:00:00.000Z`
                  : null,
          });
          if (success) onCancel();
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          pending.current = false;
          setSaving(false);
        }
      }}
    >
      {stale && (
        <div className="error" role="status">
          This board changed while you were editing. Your draft is preserved. Copy any text you
          need, then cancel and reopen the card to review the latest details before saving.
        </div>
      )}
      <label>
        Card title
        <input autoFocus required maxLength={160} {...field('title')} />
      </label>
      <label>
        Description
        <textarea maxLength={5000} {...field('description')} />
      </label>
      <label>
        Priority
        <select
          disabled={locked}
          value={input.priority}
          onChange={(event) => {
            const priority = priorities.find((value) => value === event.target.value);
            if (priority) setInput((old) => ({ ...old, priority }));
          }}
        >
          {priorities.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      <label>
        Due date
        <input type="date" {...field('dueDate')} onInput={field('dueDate').onChange} />
      </label>
      <label>
        Labels, separated by commas
        <input maxLength={340} {...field('labels')} />
      </label>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <div className="actions">
        <button className="btn btn-primary btn-sm" disabled={locked || stale}>
          {locked && <span className="spinner spinner-sm" aria-hidden="true" />}
          {locked ? 'Saving…' : submitLabel}
        </button>
        <button
          className="btn btn-secondary btn-sm"
          type="button"
          disabled={locked}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
