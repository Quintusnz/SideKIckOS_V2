import { beforeEach, describe, expect, it } from 'vitest';
import {
  type ActivityDoneMessage,
  type ActivityMessage,
  type ActivityUpdateMessage,
} from '@/types';
import { useActivityStore } from '@/app/components/useActivityStore';

describe('useActivityStore', () => {
  beforeEach(() => {
    useActivityStore.getState().reset();
  });

  it('tracks timeline and chips for a successful activity', () => {
    const activityId = 'act_123';
    const startedAt = '2025-10-31T02:21:00.000Z';

    const activityMessage: ActivityMessage = {
      role: 'assistant',
      id: activityId,
      type: 'activity',
      activity: {
        title: 'Research & Synthesis',
        status: 'thinking',
        stepsTotal: 3,
        stepIndex: 1,
        label: 'Planning…',
        startedAt,
      },
    };

    const stepStartUpdate: ActivityUpdateMessage = {
      role: 'assistant',
      id: 'u1',
      type: 'activity.update',
      activityId,
      update: { kind: 'step.start', title: 'Plan approach' },
    };

    const toolCallUpdate: ActivityUpdateMessage = {
      role: 'assistant',
      id: 'u3',
      type: 'activity.update',
      activityId,
      update: {
        kind: 'tool.call',
        name: 'web.search',
        args: { q: 'site:docs vercel ai sdk v5 UIMessage' },
      },
    };

    const toolResultUpdate: ActivityUpdateMessage = {
      role: 'assistant',
      id: 'u4',
      type: 'activity.update',
      activityId,
      update: {
        kind: 'tool.result',
        name: 'web.search',
        summary: '3 docs found',
      },
    };

    const doneMessage: ActivityDoneMessage = {
      role: 'assistant',
      id: 'u8',
      type: 'activity.done',
      activityId,
      durationMs: 7421,
    };

    useActivityStore.getState().ingestActivityMessage(activityMessage);
    useActivityStore.getState().ingestActivityUpdate(stepStartUpdate);
    useActivityStore.getState().ingestActivityUpdate(toolCallUpdate);
    useActivityStore.getState().ingestActivityUpdate(toolResultUpdate);
    useActivityStore.getState().ingestActivityDone(doneMessage);

    const state = useActivityStore.getState();

    expect(state.currentActivityId).toBe(activityId);
    expect(state.status).toBe('done');
    expect(state.label).toContain('Completed');
    expect(state.timeline).toHaveLength(5);

    const stepChip = state.chips.find((chip) => chip.kind === 'step');
    expect(stepChip).toBeDefined();
    expect(stepChip?.state).toBe('completed');

    const toolChip = state.chips.find((chip) => chip.kind === 'tool');
    expect(toolChip).toBeDefined();
    expect(toolChip?.state).toBe('completed');
    expect(toolChip?.detail).toBe('3 docs found');
  });

  it('records errors and exposes them via status and chips', () => {
    const activityId = 'act_error';
    const activityMessage: ActivityMessage = {
      role: 'assistant',
      id: activityId,
      type: 'activity',
      activity: {
        title: 'Investigate issue',
        status: 'thinking',
        startedAt: '2025-10-31T03:00:00.000Z',
      },
    };

    const errorUpdate: ActivityUpdateMessage = {
      role: 'assistant',
      id: 'err1',
      type: 'activity.update',
      activityId,
      update: { kind: 'error', text: 'Tool failure' },
    };

    useActivityStore.getState().ingestActivityMessage(activityMessage);
    useActivityStore.getState().ingestActivityUpdate(errorUpdate);

    const state = useActivityStore.getState();

    expect(state.status).toBe('error');
    expect(state.label).toBe('Tool failure');
    expect(state.chips.some((chip) => chip.kind === 'error')).toBe(true);
  });
});
