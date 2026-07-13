let registration: Promise<unknown> | undefined;
const languageRegistrations = new Map<string, Promise<unknown>>();

const loadLanguage = (language: string): Promise<unknown> | undefined => {
  const normalized = language.toLowerCase();
  const code = normalized === 'zh-cn' || normalized === 'zh-tw'
    ? normalized
    : normalized.split('-')[0] ?? normalized;
  if (languageRegistrations.has(code)) return languageRegistrations.get(code);
  const pending = (() => {
    switch (code) {
      case 'de': return import('media-chrome/lang/de');
      case 'es': return import('media-chrome/lang/es');
      case 'fr': return import('media-chrome/lang/fr');
      case 'pt': return import('media-chrome/lang/pt');
      case 'zh-cn': return import('media-chrome/lang/zh-CN');
      case 'zh-tw': return import('media-chrome/lang/zh-TW');
      default: return undefined;
    }
  })();
  if (pending) languageRegistrations.set(code, pending);
  return pending;
};

export const ensureMediaChrome = async (language?: string): Promise<void> => {
  if (language) await loadLanguage(language);
  registration ??= import('media-chrome');
  await registration;
};
