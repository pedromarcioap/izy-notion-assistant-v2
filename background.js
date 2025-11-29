// Service Worker placeholder if needed.
// Currently the popup logic handles API calls directly which is allowed in Manifest V3 if host_permissions are set.
// However, sometimes it's better to proxy through background if we need persistent state or CORS issues arise in some environments.
// But Notion API supports CORS if origin is not present or correct.
// In Chrome Extensions, the origin is `chrome-extension://<id>`.
// Notion API sets Access-Control-Allow-Origin: * (usually) or requires handling.
// Actually, standard practice for MV3 is fetch in popup or background.
// If we encounter CORS issues, we can move fetch here.
// For now, let's keep it empty or just log installation.

chrome.runtime.onInstalled.addListener(() => {
  console.log("Izy Notion Assistant Installed");
});
