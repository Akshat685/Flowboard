import { useRef, useState } from 'react';
import { errorMessage } from '@/utils/errors';
export function TitleForm({ label, initial = '', busy, maxLength = 120, onSubmit }) {
  const [title, setTitle] = useState(initial);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  return (
    <form
      className="inline-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy || pending.current) return;
        setError('');
        if (!title.trim()) {
          setError('Enter a name containing at least one non-space character.');
          return;
        }
        pending.current = true;
        setSaving(true);
        try {
          if (await onSubmit(title.trim())) setTitle('');
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          pending.current = false;
          setSaving(false);
        }
      }}
    >
      <input
        disabled={busy || saving}
        aria-label={label}
        placeholder={label}
        required
        maxLength={maxLength}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <button className="btn btn-primary" disabled={busy || saving}>
        {saving && <span className="spinner spinner-sm" aria-hidden="true" />}
        {saving ? 'Creating…' : label}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
