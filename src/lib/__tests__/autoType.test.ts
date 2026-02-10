import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';

// Mock dependencies before importing
vi.mock('@/stores/connectionStore', () => ({
  useConnectionStore: {
    getState: vi.fn(() => ({
      sendMessage: vi.fn(),
    })),
  },
}));

vi.mock('@/stores/sessionStore', () => ({
  useSessionStore: {
    getState: vi.fn(() => ({
      activeSessionId: 'session-1',
    })),
    subscribe: vi.fn(() => vi.fn()), // returns unsubscribe
  },
}));

vi.mock('@/terminal/terminalInstance', () => ({
  getTerminalInstance: vi.fn(() => null),
}));

import { scheduleAutoType, cancelAutoType } from '@/lib/autoType';
import { useConnectionStore } from '@/stores/connectionStore';
import { useSessionStore } from '@/stores/sessionStore';
import { getTerminalInstance } from '@/terminal/terminalInstance';

describe('autoType', () => {
  let sendMessageMock: Mock;

  beforeEach(() => {
    vi.useFakeTimers();
    sendMessageMock = vi.fn();
    (useConnectionStore.getState as Mock).mockReturnValue({
      sendMessage: sendMessageMock,
    });
    (useSessionStore.getState as Mock).mockReturnValue({
      activeSessionId: 'session-1',
    });
    cancelAutoType();
    // Reset getTerminalInstance to default (null) in case a test overrode it
    (getTerminalInstance as Mock).mockReturnValue(null);
  });

  afterEach(() => {
    cancelAutoType();
    vi.useRealTimers();
  });

  it('sends claude\\r after initial delay', async () => {
    scheduleAutoType('hello world');

    // Before delay — nothing sent
    expect(sendMessageMock).not.toHaveBeenCalled();

    // After initial delay (800ms)
    await vi.advanceTimersByTimeAsync(800);

    expect(sendMessageMock).toHaveBeenCalledWith('input', {
      sessionId: 'session-1',
      data: 'claude\r',
    });
  });

  it('chunks large text (10K+ chars) into ≤4KB pieces', async () => {
    const largeText = 'A'.repeat(10000);
    scheduleAutoType(largeText);

    // Initial delay + claude command
    await vi.advanceTimersByTimeAsync(800);

    // Safety timeout fires at 15s — prompt detection gives up and proceeds
    // Plus extra time for chunk delays (50ms each * ~3 chunks + final delay)
    await vi.advanceTimersByTimeAsync(15500);

    // Count input calls (excluding the initial 'claude\r')
    const inputCalls = sendMessageMock.mock.calls.filter(
      (c: unknown[]) => c[0] === 'input' && (c[1] as Record<string, string>).data !== 'claude\r'
    );

    // 10000 chars / 4096 = 3 chunks + final \r
    // Each chunk should be ≤ 4096 chars
    const chunkCalls = inputCalls.filter(
      (c: unknown[]) => (c[1] as Record<string, string>).data !== '\r'
    );
    for (const call of chunkCalls) {
      expect((call[1] as Record<string, string>).data.length).toBeLessThanOrEqual(4096);
    }
    expect(chunkCalls.length).toBeGreaterThanOrEqual(3);
  });

  it('sends final \\r after all chunks', async () => {
    scheduleAutoType('some context text');

    // Initial delay + safety timeout + chunk delays
    await vi.advanceTimersByTimeAsync(800 + 15000 + 500);

    // Last input call should be the final \r
    const inputCalls = sendMessageMock.mock.calls.filter(
      (c: unknown[]) => c[0] === 'input'
    );
    const lastCall = inputCalls[inputCalls.length - 1];
    expect((lastCall[1] as Record<string, string>).data).toBe('\r');
  });

  it('cancelAutoType stops further sends', async () => {
    scheduleAutoType('hello world');

    // Initial delay
    await vi.advanceTimersByTimeAsync(400);

    // Cancel before claude\r is sent
    cancelAutoType();

    await vi.advanceTimersByTimeAsync(1000);

    // Only the initial timer was set, but cancelled before firing
    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it('auto-confirms intermediate trust/permission prompts', async () => {
    // Simulate terminal showing trust prompt, then after confirmation shows the real prompt
    let callCount = 0;
    const mockGetTerminal = getTerminalInstance as Mock;
    mockGetTerminal.mockImplementation(() => {
      callCount++;
      // callCount 1 = initial focus before claude\r, 2 = first poll (detectScreenState)
      if (callCount <= 2) {
        // First few polls: show the trust prompt screen
        return {
          focus: vi.fn(),
          buffer: {
            active: {
              cursorY: 5,
              getLine: (i: number) => ({
                translateToString: () => {
                  const lines: Record<number, string> = {
                    5: 'Enter to confirm · Esc to cancel',
                    4: '  2. No, exit',
                    3: '  1. Yes, I trust this folder',
                    2: '',
                    1: 'Quick safety check: Is this a project you created or one you trust?',
                    0: 'Accessing workspace:',
                  };
                  return lines[i] ?? '';
                },
              }),
            },
          },
        };
      }
      // After confirmation: show the Claude prompt
      return {
        focus: vi.fn(),
        buffer: {
          active: {
            cursorY: 2,
            getLine: (i: number) => ({
              translateToString: () => (i === 2 ? '❯ ' : ''),
            }),
          },
        },
      };
    });

    scheduleAutoType('test context');

    // Advance enough for: initial delay (800) + poll (300) + confirm pause (500) + poll (300) + chunk delays (200) + margin
    await vi.advanceTimersByTimeAsync(2500);

    // Verify claude\r was sent
    expect(sendMessageMock).toHaveBeenCalledWith('input', {
      sessionId: 'session-1',
      data: 'claude\r',
    });

    // Verify at least one \r was sent to confirm the trust prompt (plus the final submit \r)
    const enterCalls = sendMessageMock.mock.calls.filter(
      (c: unknown[]) => c[0] === 'input' && (c[1] as Record<string, string>).data === '\r'
    );
    expect(enterCalls.length).toBeGreaterThanOrEqual(2); // 1 confirm + 1 final submit

    // Context should have been sent
    const chunkCalls = sendMessageMock.mock.calls.filter(
      (c: unknown[]) =>
        c[0] === 'input' &&
        (c[1] as Record<string, string>).data !== 'claude\r' &&
        (c[1] as Record<string, string>).data !== '\r'
    );
    const combined = chunkCalls.map((c: unknown[]) => (c[1] as Record<string, string>).data).join('');
    expect(combined).toBe('test context');

    // Restore mock
    mockGetTerminal.mockReturnValue(null);
  });

  it('second scheduleAutoType cancels the first', async () => {
    scheduleAutoType('first context');

    // Advance partially
    await vi.advanceTimersByTimeAsync(400);

    // Schedule another — should cancel the first
    scheduleAutoType('second context');

    // Advance past first's delay
    await vi.advanceTimersByTimeAsync(800);

    // The claude\r should be sent (from second schedule)
    const claudeCalls = sendMessageMock.mock.calls.filter(
      (c: unknown[]) => c[0] === 'input' && (c[1] as Record<string, string>).data === 'claude\r'
    );
    expect(claudeCalls).toHaveLength(1);

    // Advance to safety timeout
    await vi.advanceTimersByTimeAsync(15000);

    // Context chunks should come from 'second context', not 'first context'
    const chunkCalls = sendMessageMock.mock.calls.filter(
      (c: unknown[]) =>
        c[0] === 'input' &&
        (c[1] as Record<string, string>).data !== 'claude\r' &&
        (c[1] as Record<string, string>).data !== '\r'
    );
    // All chunk data combined should be 'second context'
    const combined = chunkCalls.map((c: unknown[]) => (c[1] as Record<string, string>).data).join('');
    expect(combined).toBe('second context');
  });
});
