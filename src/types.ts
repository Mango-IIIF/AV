export type JsonObject = { [key: string]: unknown };
export type IIIFPresentationVersion = 2 | 3;
export type MediaKind = 'audio' | 'video';

export interface LocalizedValue {
  language?: string;
  value: string;
}

export interface TimeSpan {
  start: number;
  end?: number;
}

export interface MediaSource {
  id: string;
  src: string;
  kind: MediaKind;
  format?: string;
  label?: string;
  width?: number;
  height?: number;
  duration?: number;
  quality?: string;
  isHls: boolean;
  segment?: TimeSpan;
  canvasTarget?: TimeSpan;
  timeMode?: 'trim' | 'scale' | 'loop';
}

export type TextTrackKind = 'captions' | 'subtitles' | 'descriptions' | 'metadata';

export interface TextTrack {
  id: string;
  src: string;
  kind: TextTrackKind;
  label: string;
  language?: string;
  format?: string;
  default?: boolean;
  forced?: boolean;
}

export interface TranscriptResource {
  id: string;
  src?: string;
  label: string;
  format?: string;
  language?: string;
  machineGenerated: boolean;
  cues?: TranscriptCue[];
}

export type TranscriptCueType = 'cue' | 'note' | 'metadata' | 'text';

export interface TranscriptCue {
  id: string;
  start?: number;
  end?: number;
  text: string;
  speaker?: string;
  type: TranscriptCueType;
}

export interface AVAnnotation {
  id: string;
  canvasId: string;
  motivation: string[];
  purpose: string[];
  label?: string;
  text: string;
  time?: TimeSpan;
  tags: string[];
  sourcePageId?: string;
}

export interface AVAnnotationDraft {
  motivation?: string[];
  purpose?: string[];
  label?: string;
  text: string;
  time?: TimeSpan;
  tags?: string[];
}

export interface AVAnnotationAdapter {
  create?: (canvas: AVCanvas, annotation: AVAnnotationDraft) => Promise<AVAnnotation>;
  update?: (canvas: AVCanvas, annotation: AVAnnotation) => Promise<AVAnnotation>;
  remove?: (canvas: AVCanvas, annotation: AVAnnotation) => Promise<void>;
}

export interface DownloadResource {
  id: string;
  label: string;
  format?: string;
  filename?: string;
}

export interface MetadataEntry {
  label: string;
  values: LocalizedValue[];
}

export interface AuthService {
  id: string;
  profile?: string;
  label?: string;
  serviceType: 'probe' | 'access' | 'token' | 'logout' | 'unknown';
  services: AuthService[];
}

export interface AVCanvas {
  id: string;
  index: number;
  label: string;
  summary?: string;
  duration?: number;
  width?: number;
  height?: number;
  behavior: string[];
  sources: MediaSource[];
  tracks: TextTrack[];
  transcripts: TranscriptResource[];
  annotations: AVAnnotation[];
  rendering: DownloadResource[];
  metadata: MetadataEntry[];
  poster?: string;
  accompanyingCanvas?: string;
  homepage?: string;
  authServices: AuthService[];
}

export interface Chapter {
  id: string;
  label: string;
  canvasId?: string;
  time?: TimeSpan;
  behavior: string[];
  summary?: string;
  homepage?: string;
  children: Chapter[];
}

export interface AVManifest {
  id: string;
  type: 'Manifest';
  version: IIIFPresentationVersion;
  label: string;
  summary?: string;
  behavior: string[];
  start?: { canvasId: string; time?: number };
  canvases: AVCanvas[];
  chapters: Chapter[];
  metadata: MetadataEntry[];
  rendering: DownloadResource[];
  rights?: string;
  requiredStatement?: MetadataEntry;
  homepage?: string;
  logo?: string;
}

export interface AVControlsConfig {
  navigation?: boolean;
  autoAdvance?: boolean;
  seek?: boolean;
  volume?: boolean;
  captions?: boolean;
  playbackRate?: boolean;
  pictureInPicture?: boolean;
  fullscreen?: boolean;
  sourceSelector?: boolean;
  download?: boolean;
  skipSeconds?: number;
}

export interface AVPanelsConfig {
  chapters?: boolean;
  transcript?: boolean;
  annotations?: boolean;
  metadata?: boolean;
  supplementalFiles?: boolean;
}

export interface AVTranscriptConfig {
  autoScroll?: boolean;
  search?: boolean;
  download?: boolean;
  showNotes?: boolean;
  showMetadata?: boolean;
  showSearchMarkers?: boolean;
}

export interface AVAudioArtConfig {
  transcript?: boolean;
  visualizer?: boolean | AVAudioVisualizerMode;
}

export type AVAudioVisualizerMode = 'pulse' | 'waveform' | 'spectrum';

export interface AVResumeConfig {
  enabled?: boolean;
  maxItems?: number;
  ttlDays?: number;
  prompt?: boolean;
}

/** Package-owned interface strings. Values may contain `{name}` placeholders. */
export interface AVStrings {
  chapters: string;
  transcript: string;
  annotations: string;
  metadata: string;
  files: string;
  rights: string;
  previous: string;
  next: string;
  previousSection: string;
  nextSection: string;
  autoAdvance: string;
  mediaPlayer: string;
  mediaSource: string;
  mediaInformation: string;
  download: string;
  downloadMediaFile: string;
  searchTranscript: string;
  transcriptSearchMatches: string;
  searchMatchAt: string;
  resumePrompt: string;
  resume: string;
  startOver: string;
  loadingManifest: string;
  loadingTranscript: string;
  unableToLoadPlayer: string;
  unableToLoadMedia: string;
  noMediaLoaded: string;
  noPlayableMedia: string;
  noManifest: string;
  noTranscript: string;
  noAnnotations: string;
  noMetadata: string;
  noChapters: string;
  noSupplementalFiles: string;
  autoSource: string;
  sourceNumber: string;
  transcriptNumber: string;
  sectionNumber: string;
  chapterNumber: string;
  untitledManifest: string;
  unableToLoadManifest: string;
  expectedManifest: string;
  manifestWithoutCanvases: string;
}

export interface AVPlayerConfig {
  controls?: AVControlsConfig;
  panels?: AVPanelsConfig;
  transcript?: AVTranscriptConfig;
  audioArt?: AVAudioArtConfig;
  resume?: AVResumeConfig;
  strings?: Partial<AVStrings>;
  preferredLanguages?: string[];
  autoAdvance?: boolean;
  repeat?: boolean;
  startCanvasId?: string;
  startTime?: number;
  activePanel?: 'chapters' | 'transcript' | 'annotations' | 'metadata' | 'files' | 'none';
  crossorigin?: 'anonymous' | 'use-credentials' | '';
  preload?: 'none' | 'metadata' | 'auto';
  playbackRates?: number[];
  fetch?: typeof globalThis.fetch;
  requestInit?: RequestInit;
  resolveRequest?: (url: string, context: { manifest?: AVManifest; canvas?: AVCanvas }) => string | Promise<string>;
  annotationAdapter?: AVAnnotationAdapter;
}

export interface AVPlayerState {
  status: 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'ended' | 'error';
  manifest?: AVManifest;
  canvasIndex: number;
  sourceIndex: number;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  playbackRate: number;
  autoAdvance: boolean;
  repeat: boolean;
  error?: Error;
}

export interface AVPlayerEventMap {
  'av-loadstart': { source: string | JsonObject };
  'av-ready': { manifest: AVManifest };
  'av-error': { error: Error };
  'av-canvaschange': { canvas: AVCanvas; canvasIndex: number };
  'av-sourcechange': { source: MediaSource; sourceIndex: number };
  'av-play': { canvasId: string; time: number };
  'av-pause': { canvasId: string; time: number };
  'av-timeupdate': { canvasId: string; time: number; duration: number };
  'av-seek': { canvasId: string; from: number; to: number };
  'av-ended': { canvasId: string };
  'av-annotationschange': { canvasId: string; annotations: AVAnnotation[] };
  'av-configchange': { config: Readonly<AVPlayerConfig> };
  'av-statechange': AVPlayerState;
}

export const defaultStrings: AVStrings = {
  chapters: 'Chapters',
  transcript: 'Transcript',
  annotations: 'Annotations',
  metadata: 'Metadata',
  files: 'Files',
  rights: 'Rights',
  previous: 'Previous',
  next: 'Next',
  previousSection: 'Previous section',
  nextSection: 'Next section',
  autoAdvance: 'Auto-advance',
  mediaPlayer: 'Media player',
  mediaSource: 'Media source',
  mediaInformation: 'Media information',
  download: 'Download',
  downloadMediaFile: 'Download media file',
  searchTranscript: 'Search transcript',
  transcriptSearchMatches: 'Transcript search matches',
  searchMatchAt: 'Search match at {time}',
  resumePrompt: 'Resume from {time}?',
  resume: 'Resume',
  startOver: 'Start over',
  loadingManifest: 'Loading IIIF manifest…',
  loadingTranscript: 'Loading transcript…',
  unableToLoadPlayer: 'Unable to load the player.',
  unableToLoadMedia: 'Unable to load media.',
  noMediaLoaded: 'No media loaded',
  noPlayableMedia: 'No playable audio or video source',
  noManifest: 'No manifest is loaded.',
  noTranscript: 'No transcript is available.',
  noAnnotations: 'No annotations are available.',
  noMetadata: 'No metadata is available.',
  noChapters: 'No structured navigation is available.',
  noSupplementalFiles: 'No supplemental files are available.',
  autoSource: 'Auto',
  sourceNumber: 'Source {number}',
  transcriptNumber: 'Transcript {number}',
  sectionNumber: 'Section {number}',
  chapterNumber: 'Chapter {number}',
  untitledManifest: 'Untitled manifest',
  unableToLoadManifest: 'Unable to load IIIF manifest ({status} {statusText}).',
  expectedManifest: 'Expected a IIIF Manifest, received {type}.',
  manifestWithoutCanvases: 'The IIIF Manifest does not contain any Canvases.',
};

export const defaultConfig: Required<
  Pick<AVPlayerConfig, 'controls' | 'panels' | 'transcript' | 'audioArt' | 'resume' | 'strings' | 'preferredLanguages' | 'autoAdvance' | 'repeat' | 'activePanel' | 'crossorigin' | 'preload' | 'playbackRates'>
> = {
  controls: {
    navigation: false,
    autoAdvance: false,
    seek: true,
    volume: true,
    captions: true,
    playbackRate: true,
    pictureInPicture: true,
    fullscreen: true,
    sourceSelector: true,
    download: false,
    skipSeconds: 10,
  },
  panels: {
    chapters: true,
    transcript: true,
    annotations: true,
    metadata: true,
    supplementalFiles: true,
  },
  transcript: {
    autoScroll: true,
    search: true,
    download: true,
    showNotes: false,
    showMetadata: false,
    showSearchMarkers: true,
  },
  audioArt: {
    transcript: false,
    visualizer: false,
  },
  resume: {
    enabled: false,
    maxItems: 200,
    ttlDays: 30,
    prompt: true,
  },
  strings: defaultStrings,
  preferredLanguages: ['en', 'none'],
  autoAdvance: false,
  repeat: false,
  activePanel: 'chapters',
  crossorigin: 'anonymous',
  preload: 'metadata',
  playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
};
