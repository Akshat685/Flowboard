import { useState } from 'react';
import { CardForm } from './CardForm';
export function CardComposer({ columnTitle, busy, onSubmit }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button
        className="add-card-button"
        type="button"
        disabled={busy}
        aria-label={`Add card to ${columnTitle}`}
        onClick={() => setOpen(true)}
      >
        + Add card
      </button>
    );
  return (
    <div className="task-card card-composer">
      <h3>New card</h3>
      <CardForm
        busy={busy}
        submitLabel="Create card"
        onSubmit={onSubmit}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}
