import { act, render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { BoardProvider } from '@/features/boards/hooks/BoardContext';
import { boardsApi } from '@/features/boards/boards.api';
const transport = vi.hoisted(() => ({
  handlers: {},
  connected: false,
  connect: vi.fn(),
  disconnect: vi.fn(),
}));
vi.mock('socket.io-client', () => ({
  io: () => ({
    ...transport,
    on: (event, callback) => {
      transport.handlers[event] = callback;
    },
  }),
}));
it('retries a rejected socket handshake and stops retrying after unmount', async () => {
  vi.useFakeTimers();
  try {
    vi.spyOn(boardsApi, 'boards').mockResolvedValue({ boards: [] });
    const view = render(
      <BoardProvider>
        <p>Workspace</p>
      </BoardProvider>,
    );
    await act(async () => transport.handlers.connect_error());
    await act(async () => vi.advanceTimersByTimeAsync(10000));
    expect(transport.connect).toHaveBeenCalledOnce();
    await act(async () => transport.handlers.connect_error());
    view.unmount();
    await vi.advanceTimersByTimeAsync(10000);
    expect(transport.connect).toHaveBeenCalledOnce();
  } finally {
    vi.useRealTimers();
  }
});
