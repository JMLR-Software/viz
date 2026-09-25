import { elapsedForPosition, positionAt } from "./lib/playback.js";
import type { Playback } from "./lib/playback.js";

export interface Player {
  readonly position: number;
  readonly playing: boolean;
  setPlaying(next: boolean): void;
  /** Pause and jump to a position (a scrub). */
  seek(position: number): void;
  /** Draw the current position again, after a filter, drag or resize. */
  redraw(): void;
}

export interface PlayerOptions {
  playback: Playback;
  button: HTMLButtonElement;
  autoplay: boolean;
  render: (position: number) => void;
}

/** The shared play/pause loop. Opens at 0 when autoplaying, else paused on the last frame. Renders once on creation. */
export function createPlayer({ playback, button, autoplay, render }: PlayerOptions): Player {
  let playing = false;
  let position = autoplay ? 0 : playback.span;
  let startedAt = 0;
  let loop = 0; // a pause then play before the old frame fires must not leave two loops running

  const setPlaying = (next: boolean): void => {
    const wasPlaying = playing;
    playing = next;
    button.textContent = playing ? "Pause" : "Play";
    if (!playing || wasPlaying) return;
    startedAt = performance.now() - elapsedForPosition(position >= playback.span ? 0 : position, playback);
    const id = ++loop;
    const tick = (now: number): void => {
      if (!playing || id !== loop) return;
      position = positionAt(now - startedAt, playback);
      render(position);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  button.addEventListener("click", () => setPlaying(!playing));
  setPlaying(autoplay);
  render(position);

  return {
    get position() {
      return position;
    },
    get playing() {
      return playing;
    },
    setPlaying,
    seek(next: number): void {
      setPlaying(false);
      position = next;
      render(position);
    },
    redraw(): void {
      render(position);
    },
  };
}
