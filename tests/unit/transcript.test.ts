import { describe, expect, it, vi } from 'vitest';
import { loadTranscript, parseTimedText, parseTranscript } from '../../src/transcript';

describe('transcript parsing', () => {
  it('parses multiline WebVTT cues and optional notes', () => {
    const cues = parseTimedText(`WEBVTT

NOTE editorial comment

00:01.500 --> 00:04.000 align:start
First line
Second line
`, 'vtt', { showNotes: true });
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({ type: 'note', text: 'editorial comment' });
    expect(cues[1]).toMatchObject({ start: 1.5, end: 4, text: 'First line\nSecond line' });
  });

  it('takes the speaker from a WebVTT voice tag', () => {
    const cues = parseTimedText(`WEBVTT

00:00.000 --> 00:02.000
<v Ana>Hello there.</v>

00:02.000 --> 00:04.000
<v.loud Ben Ito>Hi!

00:04.000 --> 00:06.000
No voice.
`, 'vtt');
    expect(cues.map((cue) => [cue.speaker, cue.text])).toEqual([['Ana', 'Hello there.'], ['Ben Ito', 'Hi!'], [undefined, 'No voice.']]);
  });

  it('parses SRT timestamps with comma milliseconds', () => {
    const cues = parseTimedText('1\n00:00:02,250 --> 00:00:04,500\nHello\n', 'srt');
    expect(cues[0]).toMatchObject({ start: 2.25, end: 4.5, text: 'Hello' });
  });

  it('parses structured JSON with speakers', () => {
    const cues = parseTranscript([{ speaker: 'Ada', spans: [{ begin: 1, end: 3, text: 'Hello' }] }], 'application/json');
    expect(cues[0]).toMatchObject({ speaker: 'Ada', start: 1, end: 3, text: 'Hello' });
  });

  it('rejects invalid WebVTT', () => {
    expect(() => parseTimedText('00:00.000 --> 00:01.000\nNo header', 'vtt')).toThrow('missing WEBVTT header');
  });

  it('rejects DOCX resources without fetching them', async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(loadTranscript({
      id: 'word-transcript',
      src: 'https://example.org/transcript.docx',
      label: 'Word transcript',
      machineGenerated: false,
    }, { fetch: fetcher })).rejects.toThrow('DOCX transcripts are not supported');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
