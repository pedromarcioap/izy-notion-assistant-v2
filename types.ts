export enum PageType {
  DATABASE = 'DATABASE',
  PAGE = 'PAGE',
  NOTE = 'NOTE'
}

export interface PageData {
  id: string;
  title: string;
  type: PageType;
  lastEdited: string; // ISO String
  url: string;
  content?: string; // Content snippet or properties summary
  tags: string[];
  icon: string;
}

export enum TabView {
  DASHBOARD = 'DASHBOARD',
  SEARCH = 'SEARCH',
  NOTES = 'NOTES',
  SETTINGS = 'SETTINGS'
}

export interface AppSettings {
  notionToken: string;
  corsProxy: string; // Needed for web-based dev, obsolete in Extension if background used
  userName: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  notionToken: '',
  // Default proxy empty because extensions don't need it. 
  // User only needs this if testing in a regular browser window.
  corsProxy: '', 
  userName: 'User'
};