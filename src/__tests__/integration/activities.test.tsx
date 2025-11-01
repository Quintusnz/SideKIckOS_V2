import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import Timeline from '@/components/Timeline';
import { FALLBACK_TIMELINE_EVENTS } from '@/lib/timeline';

describe('Activities timeline component', () => {
  it('renders fallback phases by default', () => {
    render(<Timeline events={FALLBACK_TIMELINE_EVENTS} />);

    FALLBACK_TIMELINE_EVENTS.forEach((event) => {
      expect(screen.queryByTestId(`timeline-item-${event.id}`)).not.toBeNull();
    });
  });

  it('toggles details visibility via Details button', () => {
    const events = FALLBACK_TIMELINE_EVENTS.map((event) =>
      event.id === 'phase-planning' ? { ...event, detail: 'More info', expandable: true } : event,
    );

    render(<Timeline events={events} />);

    const firstEvent = screen.getByTestId('timeline-item-phase-planning');
    const toggle = within(firstEvent).getByRole('button', { name: /details/i });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('More info')).toBeTruthy();

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('calls artifact callbacks when buttons clicked', () => {
    const handleOpen = vi.fn();
    const handleFocus = vi.fn();

    render(
      <Timeline
        events={FALLBACK_TIMELINE_EVENTS}
        onOpenArtifact={handleOpen}
        onFocusArtifact={handleFocus}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /open/i }));
    fireEvent.click(screen.getByRole('button', { name: /focus in chat/i }));

    expect(handleOpen).toHaveBeenCalledWith('phase-output');
    expect(handleFocus).toHaveBeenCalledWith('phase-output');
  });
});
