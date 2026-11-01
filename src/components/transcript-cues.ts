import type { AVPlayerController } from '../controller';
import { loadTranscript } from '../transcript';
import type { TranscriptCue, TranscriptResource } from '../types';

/*
 * The transcript panel and the captions often show the same transcript. They
 * share one load per resource and parse settings; a new Manifest brings new
 * resource objects, so nothing stale is kept.
 */
const loads = new WeakMap<TranscriptResource, Map<string, Promise<TranscriptCue[]>>>();

export const loadCues = (controller: AVPlayerController, resource: TranscriptResource): Promise<TranscriptCue[]> => {
  const config = controller.config;
  const options: Parameters<typeof loadTranscript>[1] = {};
  if (config.fetch) options.fetch = config.fetch;
  if (config.requestInit) options.requestInit = config.requestInit;
  if (config.transcript.showNotes !== undefined) options.showNotes = config.transcript.showNotes;
  if (config.transcript.showMetadata !== undefined) options.showMetadata = config.transcript.showMetadata;
  const key = `${Boolean(options.showNotes)}:${Boolean(options.showMetadata)}`;
  let byOptions = loads.get(resource);
  if (!byOptions) loads.set(resource, byOptions = new Map());
  let load = byOptions.get(key);
  if (!load) {
    load = loadTranscript(resource, options);
    byOptions.set(key, load);
    // A failed load is tried again next time.
    load.catch(() => byOptions?.delete(key));
  }
  return load;
};
