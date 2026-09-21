import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { request, advanceSession } from '@/services/http';
import { AuthProvider, useAuth } from '@/features/auth/hooks/AuthContext';
import { authApi } from '@/features/auth/auth.api';
import { CardForm } from '@/features/boards/components/CardForm';
import { TitleForm } from '@/components/common/TitleForm';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

it('times out stalled requests and preserves explicit cancellation while reading a body', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    ),
  );
  await expect(request('/boards', { timeoutMs: 20 })).rejects.toMatchObject({ status: 408 });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.reject(new DOMException('Aborted', 'AbortError')),
    }),
  );
  await expect(request('/boards')).rejects.toMatchObject({ name: 'AbortError' });
});

it('ignores unauthorized responses from an older session', async () => {
  let finish;
  const expired = vi.fn();
  window.addEventListener('flowboard:unauthorized', expired);
  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    ),
  );
  const pending = request('/boards');
  advanceSession();
  finish({ status: 401, ok: false, json: async () => ({ error: 'Expired' }) });
  await expect(pending).rejects.toMatchObject({ status: 401 });
  expect(expired).not.toHaveBeenCalled();
  window.removeEventListener('flowboard:unauthorized', expired);
});

it('discards late session restoration after sign-in, including StrictMode double effects', async () => {
  const releases = [];
  vi.spyOn(authApi, 'me').mockImplementation(
    () => new Promise((resolve) => releases.push(resolve)),
  );
  vi.spyOn(authApi, 'login').mockResolvedValue({ user: { name: 'New session' } });
  function Session() {
    const { user, signIn } = useAuth();
    return (
      <>
        <span>{user?.name || 'Guest'}</span>
        <button onClick={() => signIn({})}>Login</button>
      </>
    );
  }
  render(
    <StrictMode>
      <AuthProvider>
        <Session />
      </AuthProvider>
    </StrictMode>,
  );
  fireEvent.click(screen.getByText('Login'));
  await screen.findByText('New session');
  await act(async () => releases.forEach((resolve) => resolve({ user: { name: 'Old session' } })));
  expect(screen.getByText('New session')).toBeInTheDocument();
});

it('locks draft fields, blocks duplicate submits, and preserves an unchanged due timestamp', async () => {
  let finish;
  const submit = vi.fn(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const cancel = vi.fn();
  render(
    <CardForm
      card={{ title: 'Task', dueDate: '2026-10-20T15:30:00.000Z' }}
      onSubmit={submit}
      onCancel={cancel}
    />,
  );
  const form = screen.getByText('Save card').closest('form');
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(submit).toHaveBeenCalledOnce();
  expect(submit.mock.calls[0][0].dueDate).toBe('2026-10-20T15:30:00.000Z');
  expect(screen.getByLabelText('Card title')).toBeDisabled();
  await act(async () => finish(false));
  expect(screen.getByLabelText('Card title')).toBeEnabled();
  expect(cancel).not.toHaveBeenCalled();
});

it('rejects whitespace titles without a request and preserves the form after errors', async () => {
  const submit = vi.fn().mockRejectedValue(new Error('Unavailable'));
  render(<TitleForm label="Create board" onSubmit={submit} />);
  const input = screen.getByLabelText('Create board');
  fireEvent.change(input, { target: { value: '   ' } });
  fireEvent.submit(input.closest('form'));
  expect(submit).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('non-space');
  fireEvent.change(input, { target: { value: 'Keep my draft' } });
  fireEvent.submit(input.closest('form'));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Unavailable'));
  expect(input).toHaveValue('Keep my draft');
});

it('renders a recovery screen when a component crashes', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  function Broken() {
    throw new Error('Private stack detail');
  }
  render(
    <ErrorBoundary>
      <Broken />
    </ErrorBoundary>,
  );
  expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
  expect(screen.queryByText('Private stack detail')).not.toBeInTheDocument();
});

it('saves a date entered through a native input event', async () => {
  const submit = vi.fn().mockResolvedValue(true);
  render(<CardForm card={{ title: 'Dated task' }} onSubmit={submit} onCancel={vi.fn()} />);
  fireEvent.input(screen.getByLabelText('Due date'), { target: { value: '2026-10-20' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save card' }));
  await waitFor(() =>
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ dueDate: '2026-10-20T00:00:00.000Z' }),
    ),
  );
});
