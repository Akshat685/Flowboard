import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/hooks/AuthContext';
import { BoardProvider } from '@/features/boards/hooks/BoardContext';
import { Kanban } from '@/features/boards/components/Kanban';
import App from '@/App';
import { authApi } from '@/features/auth/auth.api';
import { boardsApi as api } from '@/features/boards/boards.api';
import { request } from '@/services/http';
vi.mock('socket.io-client', () => ({ io: () => ({ on: vi.fn(), disconnect: vi.fn() }) }));
const user = { _id: '507f1f77bcf86cd799439011', name: 'Test User', email: 'test@example.com' };
const board = {
  _id: '507f1f77bcf86cd799439012',
  owner: user._id,
  title: 'Launch',
  description: '',
  createdAt: '2026-09-15T00:00:00.000Z',
  updatedAt: '2026-09-15T00:00:00.000Z',
  __v: 3,
  columns: [
    {
      _id: '507f1f77bcf86cd799439013',
      title: 'To do',
      createdAt: '2026-09-15T00:00:00.000Z',
      updatedAt: '2026-09-15T00:00:00.000Z',
      cards: [
        {
          _id: '507f1f77bcf86cd799439014',
          title: 'Write guide',
          description: '',
          priority: 'medium',
          labels: [],
          dueDate: null,
          createdAt: '2026-09-15T00:00:00.000Z',
          updatedAt: '2026-09-15T00:00:00.000Z',
        },
      ],
    },
    {
      _id: '507f1f77bcf86cd799439015',
      title: 'Done',
      createdAt: '2026-09-15T00:00:00.000Z',
      updatedAt: '2026-09-15T00:00:00.000Z',
      cards: [],
    },
  ],
};
const json = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
});
describe('API contract and session handling', () => {
  it('sends cookies, protection header, versions and the matching move endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ board }));
    vi.stubGlobal('fetch', fetchMock);
    await api.moveCard(
      board._id,
      board.columns[0].cards[0]._id,
      {
        sourceColumnId: board.columns[0]._id,
        targetColumnId: board.columns[1]._id,
        targetIndex: 0,
      },
      3,
    );
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(`/api/boards/${board._id}/cards/${board.columns[0].cards[0]._id}/move`);
    expect(options.credentials).toBe('include');
    expect(options.headers['X-Flowboard-Request']).toBe('1');
    expect(JSON.parse(options.body)).toMatchObject({ version: 3, targetIndex: 0 });
  });
  it('handles 204 responses, network errors and expired sessions', async () => {
    const expired = vi.fn();
    window.addEventListener('flowboard:unauthorized', expired);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(null, 204))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(json({ error: 'Please sign in again' }, 401));
    vi.stubGlobal('fetch', fetchMock);
    expect(await authApi.logout()).toBeNull();
    await expect(api.boards()).rejects.toMatchObject({ status: 0 });
    await expect(api.boards()).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledOnce();
    window.removeEventListener('flowboard:unauthorized', expired);
  });
  it('renders loading, restores a session and creates a board through the UI', async () => {
    let release;
    vi.spyOn(authApi, 'me').mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    vi.spyOn(api, 'boards').mockResolvedValue({ boards: [] });
    vi.spyOn(api, 'board').mockResolvedValue({ board });
    const create = vi.spyOn(api, 'createBoard').mockResolvedValue({ board });
    render(
      <MemoryRouter initialEntries={['/boards']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Restoring');
    release({ user });
    await screen.findByRole('button', { name: 'Create board' });
    await userEvent.type(screen.getByRole('textbox', { name: 'Create board' }), 'Launch');
    await userEvent.click(screen.getByRole('button', { name: 'Create board' }));
    await screen.findByRole('heading', { name: 'Launch' });
    expect(create).toHaveBeenCalledWith({ title: 'Launch' });
  });
  it('shows login errors and protects boards when no session exists', async () => {
    vi.spyOn(authApi, 'me').mockRejectedValue({ status: 401 });
    vi.spyOn(authApi, 'login').mockRejectedValue(new Error('Invalid email or password'));
    render(
      <MemoryRouter initialEntries={['/boards']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    );
    await screen.findByRole('button', { name: 'Sign in' });
    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'bad-password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
  });
});
it('creates an account, shows login confirmation, and requires a separate sign-in', async () => {
  vi.spyOn(authApi, 'me').mockRejectedValue({ status: 401 });
  const register = vi.spyOn(authApi, 'register').mockResolvedValue({ user });
  const login = vi.spyOn(authApi, 'login').mockResolvedValue({ user });
  const boards = vi.spyOn(api, 'boards').mockResolvedValue({ boards: [] });
  render(
    <MemoryRouter initialEntries={['/register']}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
  await screen.findByRole('button', { name: 'Create account' });
  await userEvent.type(screen.getByLabelText('Name'), user.name);
  await userEvent.type(screen.getByLabelText('Email'), user.email);
  await userEvent.type(screen.getByLabelText('Password'), 'Testing123!safe');
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Account created successfully. Please sign in.',
  );
  expect(register).toHaveBeenCalledWith({
    name: user.name,
    email: user.email,
    password: 'Testing123!safe',
  });
  expect(login).not.toHaveBeenCalled();
  expect(boards).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Password')).toHaveValue('');
  await userEvent.type(screen.getByLabelText('Email'), user.email);
  await userEvent.type(screen.getByLabelText('Password'), 'Testing123!safe');
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByRole('button', { name: 'Create board' });
  expect(login).toHaveBeenCalledWith({ email: user.email, password: 'Testing123!safe' });
});
it('keeps failed registration on the account form without signing in', async () => {
  vi.spyOn(authApi, 'me').mockRejectedValue({ status: 401 });
  vi.spyOn(authApi, 'register').mockRejectedValue(
    new Error('An account with that email already exists'),
  );
  const login = vi.spyOn(authApi, 'login');
  render(
    <MemoryRouter initialEntries={['/register']}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
  await screen.findByRole('button', { name: 'Create account' });
  await userEvent.type(screen.getByLabelText('Name'), user.name);
  await userEvent.type(screen.getByLabelText('Email'), user.email);
  await userEvent.type(screen.getByLabelText('Password'), 'Testing123!safe');
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'An account with that email already exists',
  );
  expect(screen.getByLabelText('Name')).toHaveValue(user.name);
  expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled();
  expect(login).not.toHaveBeenCalled();
});
it('moves a card through the accessible column menu with the correct source, destination and version', async () => {
  vi.spyOn(api, 'boards').mockResolvedValue({ boards: [board] });
  const move = vi.spyOn(api, 'moveCard').mockResolvedValue({ board });
  render(
    <BoardProvider>
      <Kanban board={board} />
    </BoardProvider>,
  );
  fireEvent.change(screen.getByLabelText('Move Write guide to column'), {
    target: { value: board.columns[1]._id },
  });
  await waitFor(() =>
    expect(move).toHaveBeenCalledWith(
      board._id,
      board.columns[0].cards[0]._id,
      {
        sourceColumnId: board.columns[0]._id,
        targetColumnId: board.columns[1]._id,
        targetIndex: 0,
      },
      3,
    ),
  );
});
it('preserves AbortError so cancelled requests are not mislabeled as network failures', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')));
  await expect(request('/boards')).rejects.toMatchObject({ name: 'AbortError' });
});
it('allows a native button handle to lift a card with the keyboard and cancel without saving', async () => {
  vi.spyOn(api, 'boards').mockResolvedValue({ boards: [board] });
  const move = vi.spyOn(api, 'moveCard').mockResolvedValue({ board });
  render(
    <BoardProvider>
      <Kanban board={board} />
    </BoardProvider>,
  );
  const handle = screen.getByRole('button', { name: 'Drag Write guide' });
  handle.focus();
  fireEvent.keyDown(handle, { key: ' ', code: 'Space', keyCode: 32, which: 32 });
  await waitFor(() =>
    expect(screen.getByText('You have lifted an item in position 1')).toBeInTheDocument(),
  );
  fireEvent.keyDown(handle, { key: 'Escape', code: 'Escape', keyCode: 27, which: 27 });
  await waitFor(() => expect(screen.getByText(/Movement cancelled/)).toBeInTheDocument());
  expect(move).not.toHaveBeenCalled();
});

it('preserves an open card draft and blocks overwriting a newer live board version', async () => {
  vi.spyOn(api, 'boards').mockResolvedValue({ boards: [board] });
  const update = vi.spyOn(api, 'updateCard');
  const view = render(
    <BoardProvider>
      <Kanban board={board} />
    </BoardProvider>,
  );
  await userEvent.click(screen.getByRole('button', { name: /edit/i }));
  await userEvent.type(screen.getByLabelText('Card title'), ' draft');
  const changed = structuredClone(board);
  changed.__v++;
  changed.columns[0].cards[0].title = 'Remote edit';
  view.rerender(
    <BoardProvider>
      <Kanban board={changed} />
    </BoardProvider>,
  );
  expect(screen.getByLabelText('Card title')).toHaveValue('Write guide draft');
  expect(screen.getByRole('status')).toHaveTextContent('board changed');
  expect(screen.getByRole('button', { name: 'Save card' })).toBeDisabled();
  fireEvent.submit(screen.getByLabelText('Card title').closest('form'));
  expect(update).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
  await userEvent.click(screen.getByRole('button', { name: /^✏️ edit$/i }));
  expect(screen.getByLabelText('Card title')).toHaveValue('Remote edit');
});

it('loads the next board page through accessible navigation', async () => {
  vi.spyOn(authApi, 'me').mockResolvedValue({ user });
  const list = vi.spyOn(api, 'boards').mockImplementation(async (page) => ({
    boards: [{ ...board, title: page === 2 ? 'Second page board' : 'First page board' }],
    page,
    pages: 2,
    total: 25,
  }));
  render(
    <MemoryRouter initialEntries={['/boards']}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
  await screen.findByText('First page board');
  expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: /next/i }));
  await screen.findByText('Second page board');
  expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  expect(list).toHaveBeenLastCalledWith(
    2,
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
});

it('restores drag handles when a card being edited is deleted in another tab', async () => {
  vi.spyOn(api, 'boards').mockResolvedValue({ boards: [board] });
  const withTwoCards = structuredClone(board);
  withTwoCards.columns[0].cards.push({
    ...board.columns[0].cards[0],
    _id: '507f1f77bcf86cd799439099',
    title: 'Remaining task',
  });
  const view = render(
    <BoardProvider>
      <Kanban board={withTwoCards} />
    </BoardProvider>,
  );
  await userEvent.click(screen.getAllByRole('button', { name: /edit/i })[0]);
  const changed = structuredClone(withTwoCards);
  changed.columns[0].cards.shift();
  changed.__v++;
  view.rerender(
    <BoardProvider>
      <Kanban board={changed} />
    </BoardProvider>,
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Drag Remaining task' })).toHaveAttribute(
      'data-rfd-drag-handle-draggable-id',
    ),
  );
});
