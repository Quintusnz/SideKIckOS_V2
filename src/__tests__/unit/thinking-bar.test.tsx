import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, act } from '@testing-library/react';

import ThinkingBar from '@/app/components/ThinkingBar';
import { useActivityStore } from '@/app/components/useActivityStore';
import type {
  ActivityDoneMessage,
  ActivityMessage,
  ActivityUpdateMessage,
} from '@/types';

describe('ThinkingBar UI', () => {
  beforeEach(() => {
    act(() => {
      useActivityStore.getState().reset();
    });
  });

  it('renders fallback stages for a thinking activity', async () => {
    const activityMessage: ActivityMessage = {
      role: 'assistant',
      id: 'act-fallback',
      type: 'activity',
      activity: {
        title: 'Fallback run',
        status: 'thinking',
        label: 'Thinking…',
        startedAt: new Date().toISOString(),
      },
    };

    act(() => {
      useActivityStore.getState().ingestActivityMessage(activityMessage);
    });

  render(<ThinkingBar onStop={() => {}} onRetry={() => {}} />);

  expect(await screen.findAllByText('Planning')).not.toHaveLength(0);
  expect(screen.getAllByText('Searching')).not.toHaveLength(0);
  expect(screen.getAllByText('Summarizing')).not.toHaveLength(0);
  expect(screen.getAllByText('Thinking…')).not.toHaveLength(0);
  });

  it('shows step chips and timeline detail for synthetic updates', async () => {
    const activityId = 'act-detailed';
    const activityMessage: ActivityMessage = {
      role: 'assistant',
      id: activityId,
      type: 'activity',
      activity: {
        title: 'Detailed run',
        status: 'thinking',
        label: 'Planning…',
        startedAt: new Date().toISOString(),
      },
    };

    const planningStep: ActivityUpdateMessage = {
      role: 'assistant',
      id: 'step-1',
      type: 'activity.update',
      activityId,
      update: { kind: 'step.start', title: 'Planning' },
    };

    const searchCall: ActivityUpdateMessage = {
      role: 'assistant',
      id: 'tool-call',
      type: 'activity.update',
      activityId,
      update: {
        kind: 'tool.call',
        name: 'web.search',
      },
    };

    const searchResult: ActivityUpdateMessage = {
      role: 'assistant',
      id: 'tool-result',
      type: 'activity.update',
      activityId,
      update: {
        kind: 'tool.result',
        name: 'web.search',
        summary: 'Found 3 relevant documents.',
      },
    };

    const summarizingStep: ActivityUpdateMessage = {
      role: 'assistant',
      id: 'step-2',
      type: 'activity.update',
      activityId,
      update: { kind: 'step.start', title: 'Summarizing' },
    };

    const doneMessage: ActivityDoneMessage = {
      role: 'assistant',
      id: 'done',
      type: 'activity.done',
      activityId,
      durationMs: 4200,
    };

    act(() => {
      const store = useActivityStore.getState();
      store.ingestActivityMessage(activityMessage);
      store.ingestActivityUpdate(planningStep);
      store.ingestActivityUpdate(searchCall);
      store.ingestActivityUpdate(searchResult);
      store.ingestActivityUpdate(summarizingStep);
      store.ingestActivityDone(doneMessage);
    });

    render(<ThinkingBar onStop={() => {}} onRetry={() => {}} />);

    expect(await screen.findAllByText('Planning')).not.toHaveLength(0);
    expect(screen.getAllByText('Summarizing')).not.toHaveLength(0);
    expect(screen.getAllByText('Found 3 relevant documents.')).not.toHaveLength(0);
    expect(screen.getAllByText(/Completed in/)).not.toHaveLength(0);
  });
});
