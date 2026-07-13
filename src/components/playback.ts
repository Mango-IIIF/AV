import type { AVPlayerController } from '../controller';

export const playFromInteraction = (controller: AVPlayerController, target: EventTarget): void => {
  void controller.play().catch((cause: unknown) => {
    if (cause instanceof Error && cause.name === 'AbortError') return;
    const error = cause instanceof Error ? cause : new Error(String(cause));
    target.dispatchEvent(new CustomEvent('av-error', {
      detail: { error },
      bubbles: true,
      composed: true,
    }));
  });
};
