const transcriptAnnotations = [
  {
    id: 'https://example.org/annotation/transcript/1',
    type: 'Annotation',
    motivation: ['supplementing'],
    body: { type: 'TextualBody', value: 'Welcome to the Mango IIIF audio and video demonstration.', purpose: ['supplementing'] },
    target: 'https://example.org/canvas/1#t=0,6',
  },
  {
    id: 'https://example.org/annotation/transcript/2',
    type: 'Annotation',
    motivation: ['supplementing'],
    body: { type: 'TextualBody', value: 'The transcript, chapters, annotations, and player all share one timeline.', purpose: ['supplementing'] },
    target: 'https://example.org/canvas/1#t=6,14',
  },
  {
    id: 'https://example.org/annotation/comment/1',
    type: 'Annotation',
    motivation: ['commenting'],
    body: [
      { type: 'TextualBody', value: 'An example time-synchronised annotation.', purpose: ['commenting'] },
      { type: 'TextualBody', value: 'demo', purpose: ['tagging'] },
    ],
    target: 'https://example.org/canvas/1#t=9,15',
  },
];

const base = {
  '@context': 'http://iiif.io/api/presentation/3/context.json',
  id: 'https://example.org/manifest/av-demo',
  type: 'Manifest',
  label: { en: ['Mango AV feature demonstration'] },
  summary: { en: ['A local IIIF Presentation 3 manifest used by the interactive configuration builder.'] },
  behavior: ['auto-advance'],
  metadata: [
    { label: { en: ['Repository'] }, value: { en: ['@mango-iiif/av'] } },
    { label: { en: ['Rendering'] }, value: { en: ['Framework-free Web Component'] } },
  ],
  rights: 'https://creativecommons.org/licenses/by/4.0/',
  requiredStatement: {
    label: { en: ['Attribution'] },
    value: { en: ['Demo media is loaded from public Mux test streams.'] },
  },
  rendering: [
    { id: '/sample-transcript.vtt', type: 'Text', format: 'text/vtt', label: { en: ['Sample transcript'] } },
  ],
  structures: [
    {
      id: 'https://example.org/range/root',
      type: 'Range',
      label: { en: ['Programme'] },
      items: [
        { id: 'https://example.org/range/introduction', type: 'Range', label: { en: ['Introduction'] }, items: ['https://example.org/canvas/1#t=0,8'] },
        { id: 'https://example.org/range/details', type: 'Range', label: { en: ['Feature details'] }, items: ['https://example.org/canvas/1#t=8,20'] },
      ],
    },
  ],
};

export const videoManifest = {
  ...base,
  id: 'https://example.org/manifest/video-demo',
  label: { en: ['Video, chapters, and transcript'] },
  items: [
    {
      id: 'https://example.org/canvas/1',
      type: 'Canvas',
      label: { en: ['Video section'] },
      duration: 30,
      width: 1280,
      height: 720,
      items: [{
        id: 'https://example.org/page/painting/1',
        type: 'AnnotationPage',
        items: [{
          id: 'https://example.org/annotation/painting/1',
          type: 'Annotation',
          motivation: 'painting',
          body: {
            id: 'https://stream.mux.com/DS00Spx1CV902MCtPj5WknGlR102V5HFkDe/high.mp4',
            type: 'Video',
            format: 'video/mp4',
            label: { en: ['MP4'] },
          },
          target: 'https://example.org/canvas/1',
        }],
      }],
      annotations: [{ id: 'https://example.org/page/supplementing/1', type: 'AnnotationPage', items: transcriptAnnotations }],
      metadata: [{ label: { en: ['Section type'] }, value: { en: ['Video'] } }],
    },
  ],
};

export const hlsManifest = {
  ...videoManifest,
  id: 'https://example.org/manifest/hls-demo',
  label: { en: ['HLS adaptive streaming'] },
  items: [{
    ...videoManifest.items[0],
    items: [{
      id: 'https://example.org/page/hls/1',
      type: 'AnnotationPage',
      items: [{
        id: 'https://example.org/annotation/hls/1',
        type: 'Annotation',
        motivation: 'painting',
        body: {
          id: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
          type: 'Video',
          format: 'application/vnd.apple.mpegurl',
          label: { en: ['Adaptive HLS'] },
        },
        target: 'https://example.org/canvas/1',
      }],
    }],
  }],
};

export const audioManifest = {
  ...base,
  id: 'https://example.org/manifest/audio-demo',
  label: { en: ['Audio player theme'] },
  items: [{
    id: 'https://example.org/canvas/1',
    type: 'Canvas',
    label: { en: ['Audio section'] },
    duration: 30,
    items: [{
      id: 'https://example.org/page/audio/1',
      type: 'AnnotationPage',
      items: [{
        id: 'https://example.org/annotation/audio/1',
        type: 'Annotation',
        motivation: 'painting',
        body: {
          id: 'https://stream.mux.com/O4h5z00885HEucNNa1rV02wZapcGp01FXXoJd35AHmGX7g/audio.m4a',
          type: 'Sound',
          format: 'audio/mp4',
          label: { en: ['M4A audio'] },
        },
        target: 'https://example.org/canvas/1',
      }],
    }],
    annotations: [{ id: 'https://example.org/page/audio-supplementing/1', type: 'AnnotationPage', items: transcriptAnnotations }],
  }],
};

export const manifests = { video: videoManifest, hls: hlsManifest, audio: audioManifest } as const;
