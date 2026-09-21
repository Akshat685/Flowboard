import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { boardsApi as api } from '@/features/boards/boards.api';
import { Kanban } from '@/features/boards/components/Kanban';
import { BoardProvider } from '@/features/boards/hooks/BoardContext';
vi.mock('socket.io-client', () => ({ io: () => ({ on: vi.fn(), disconnect: vi.fn() }) }));
const board = {
  _id: '507f1f77bcf86cd799439012',
  title: 'Launch',
  description: '',
  owner: '507f1f77bcf86cd799439011',
  createdAt: '2026-09-15T00:00:00.000Z',
  updatedAt: '2026-09-15T00:00:00.000Z',
  __v: 3,
  columns: [
    {
      _id: '507f1f77bcf86cd799439013',
      title: 'To do',
      createdAt: '2026-09-15T00:00:00.000Z',
      updatedAt: '2026-09-15T00:00:00.000Z',
      cards: [],
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
const details = {
  title: 'Write release notes',
  description: 'Include the new card fields.',
  priority: 'high',
  dueDate: '2026-10-20T00:00:00.000Z',
  labels: ['release', 'documentation'],
};
function renderBoard() {
  vi.spyOn(api, 'boards').mockResolvedValue({ boards: [board] });
  render(
    <BoardProvider>
      <Kanban board={board} />
    </BoardProvider>,
  );
  return userEvent.setup();
}
async function enterDetails(user) {
  await user.type(screen.getByLabelText('Card title'), `  ${details.title}  `);
  await user.type(screen.getByLabelText('Description'), details.description);
  await user.selectOptions(screen.getByRole('combobox', { name: /Priority/ }), details.priority);
  fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-10-20' } });
  await user.type(screen.getByLabelText('Labels, separated by commas'), 'release, documentation, ');
}
describe('creating cards with full details', () => {
  it('opens the full form and discards a canceled draft without creating a card', async () => {
    const create = vi.spyOn(api, 'createCard').mockResolvedValue({ board });
    const user = renderBoard();
    await user.click(screen.getByRole('button', { name: 'Add card to To do' }));
    expect(screen.getByLabelText('Card title')).toHaveValue('');
    expect(screen.getByLabelText('Description')).toHaveValue('');
    expect(screen.getByRole('combobox', { name: /Priority/ })).toHaveValue('medium');
    expect(screen.getByLabelText('Due date')).toHaveValue('');
    expect(screen.getByLabelText('Labels, separated by commas')).toHaveValue('');
    expect(create).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('Card title'), 'Canceled draft');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Card title')).not.toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Add card to To do' }));
    expect(screen.getByLabelText('Card title')).toHaveValue('');
  });
  it('submits every detail to the selected column and waits for success before closing', async () => {
    let finishCreation;
    const create = vi.spyOn(api, 'createCard').mockImplementation(
      () =>
        new Promise((resolve) => {
          finishCreation = resolve;
        }),
    );
    const user = renderBoard();
    await user.click(screen.getByRole('button', { name: 'Add card to Done' }));
    await enterDetails(user);
    await user.click(screen.getByRole('button', { name: 'Create card' }));
    expect(create).toHaveBeenCalledExactlyOnceWith(
      board._id,
      board.columns[1]._id,
      details,
      board.__v,
    );
    expect(screen.getByLabelText('Card title')).toHaveValue(`  ${details.title}  `);
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await act(async () => {
      finishCreation({ board });
    });
    await waitFor(() => expect(screen.queryByLabelText('Card title')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Add card to Done' })).toBeEnabled();
  });
  it('preserves every draft field after a failed request and lets the user retry', async () => {
    const create = vi
      .spyOn(api, 'createCard')
      .mockRejectedValueOnce(new Error('Unable to create card'))
      .mockResolvedValueOnce({ board });
    const user = renderBoard();
    await user.click(screen.getByRole('button', { name: 'Add card to To do' }));
    await enterDetails(user);
    await user.click(screen.getByRole('button', { name: 'Create card' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create card' })).toBeEnabled());
    expect(create).toHaveBeenCalledExactlyOnceWith(
      board._id,
      board.columns[0]._id,
      details,
      board.__v,
    );
    expect(screen.getByLabelText('Card title')).toHaveValue(`  ${details.title}  `);
    expect(screen.getByLabelText('Description')).toHaveValue(details.description);
    expect(screen.getByRole('combobox', { name: /Priority/ })).toHaveValue(details.priority);
    expect(screen.getByLabelText('Due date')).toHaveValue('2026-10-20');
    expect(screen.getByLabelText('Labels, separated by commas')).toHaveValue(
      'release, documentation, ',
    );
    await user.click(screen.getByRole('button', { name: 'Create card' }));
    await waitFor(() => expect(screen.queryByLabelText('Card title')).not.toBeInTheDocument());
    expect(create).toHaveBeenNthCalledWith(2, board._id, board.columns[0]._id, details, board.__v);
  });
});
