import { AppSettings, DEFAULT_SETTINGS } from '../types.ts';

const STORAGE_KEY = 'izy_notion_settings';
const FAVORITES_KEY = 'izy_notion_favorites';

// Chrome Extensions allow LocalStorage within the popup context.
// For a production app, we would migrate to `chrome.storage.sync` which is async.
// To keep the React App simple (synchronous initial state), we stick to localStorage for now
// as it persists perfectly fine within the Extension's sandbox.

export const saveSettings = (settings: AppSettings): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    // Optional: Sync to chrome storage if desired for multi-device sync
    // if (typeof chrome !== 'undefined' && chrome.storage) {
    //   chrome.storage.sync.set({ [STORAGE_KEY]: settings });
    // }
  } catch (e) {
    console.error("Error saving settings", e);
  }
};

export const getSettings = (): AppSettings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
};

export const toggleFavorite = (pageId: string): void => {
  const favs = getFavorites();
  if (favs.includes(pageId)) {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs.filter(id => id !== pageId)));
  } else {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favs, pageId]));
  }
};

export const getFavorites = (): string[] => {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
};

export const isPageFavorite = (pageId: string): boolean => {
  return getFavorites().includes(pageId);
};