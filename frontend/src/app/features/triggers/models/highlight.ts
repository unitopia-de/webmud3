/**
 * Highlight segment in *visible* (ANSI-stripped) coordinates.
 *
 * `start` is inclusive, `end` is exclusive — matches the JavaScript regex
 * substring convention.
 */
export interface HighlightSegment {
  start: number;
  end: number;
  foreground?: string;
  background?: string;
  bold?: boolean;
}

/** A queued sound playback emitted by the engine. */
export interface SoundPlay {
  soundId: string;
  volume?: number;
}

/** Whole-chunk engine output. */
export interface TriggerResult {
  /** The original text with ANSI highlight codes injected at match positions. */
  text: string;
  /** Sounds collected from sound-action triggers. */
  sounds: SoundPlay[];
}
