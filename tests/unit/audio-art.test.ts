import { describe, expect, it } from 'vitest';
import {
  resolveAudioVisualizerMode,
  resolveVisualizerIntensity,
  spectrumBarHeight,
  waveformAmplitude,
} from '../../src/components/audio-art';

describe('resolveAudioVisualizerMode', () => {
  it.each([
    { value: true, expected: 'pulse' },
    { value: false, expected: undefined },
    { value: undefined, expected: undefined },
    { value: 'pulse' as const, expected: 'pulse' },
    { value: 'waveform' as const, expected: 'waveform' },
    { value: 'spectrum' as const, expected: 'spectrum' },
  ])('resolves $value to $expected', ({ value, expected }) => {
    expect(resolveAudioVisualizerMode(value)).toBe(expected);
  });
});

describe('resolveVisualizerIntensity', () => {
  it.each([
    // An unset custom property computes to the empty string, which must render
    // exactly as the package default rather than hiding the visualizer.
    { value: '', expected: 1 },
    { value: ' ', expected: 1 },
    { value: 'none', expected: 1 },
    { value: '-0.5', expected: 1 },
    { value: '0', expected: 0 },
    { value: ' 0.4 ', expected: .4 },
    { value: '1', expected: 1 },
    { value: '2.5', expected: 2.5 },
  ])('resolves "$value" to $expected', ({ value, expected }) => {
    expect(resolveVisualizerIntensity(value)).toBe(expected);
  });
});

describe('waveformAmplitude', () => {
  const height = 200;
  const level = .5;
  // 5 + .5 * 200 * .12 = 17, comfortably under the 32px ceiling.
  const unscaled = 17;

  it('reproduces the previous amplitude at the default intensity', () => {
    expect(waveformAmplitude(height, level, 1, false)).toBe(unscaled);
  });

  it('scales the trace, not just its opacity', () => {
    expect(waveformAmplitude(height, level, .4, false)).toBeCloseTo(unscaled * .4);
    expect(waveformAmplitude(height, level, 0, false)).toBe(0);
  });

  it('keeps the wave inside the artwork when intensity is raised', () => {
    expect(waveformAmplitude(height, level, 5, false)).toBe(height * .16);
  });

  it('stays flat under reduced motion at every intensity', () => {
    expect(waveformAmplitude(height, level, 2, true)).toBe(0);
  });
});

describe('spectrumBarHeight', () => {
  const height = 200;

  it('reproduces the previous bar height at the default intensity', () => {
    expect(spectrumBarHeight(height, .5, 1)).toBeCloseTo(32);
  });

  it('scales bars with intensity', () => {
    expect(spectrumBarHeight(height, .5, .4)).toBeCloseTo(12.8);
  });

  it('caps bars at the height a full-energy unscaled bar would reach', () => {
    expect(spectrumBarHeight(height, .9, 4)).toBe(height * .32);
  });

  it('never collapses a bar below a visible pixel', () => {
    expect(spectrumBarHeight(height, 0, 1)).toBe(1);
  });
});
