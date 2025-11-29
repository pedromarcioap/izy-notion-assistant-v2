// Notion API Helper
class NotionAPI {
    constructor(token) {
        this.token = token;
        this.baseUrl = 'https://api.notion.com/v1';
        this.headers = {
            'Authorization': `Bearer ${token}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
        };
    }

    async search(query = '', sort = null) {
        const body = {};
        if (query) body.query = query;
        if (sort) body.sort = sort;

        // Filter only for pages and databases to avoid noise? Or keep all?
        // Prompt says "pages and databases".
        body.filter = {
            value: 'page',
            property: 'object'
        };
        // Actually Notion search filter is limited. 'value' can be 'page' or 'database'.
        // If we want both, we shouldn't filter, or filter separately.
        // Let's not filter by object type to get both, unless specific requirements.
        // But for "Recents" (pages edited), usually we want pages.
        // Let's clear the filter for general search to allow databases too.
        delete body.filter;

        const response = await fetch(`${this.baseUrl}/search`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        return await response.json();
    }

    async getRecent() {
        // Last 10 pages edited
        const body = {
            sort: {
                direction: 'descending',
                timestamp: 'last_edited_time'
            },
            page_size: 10
        };

        const response = await fetch(`${this.baseUrl}/search`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
             // Handle invalid token specially if 401
             if (response.status === 401) throw new Error("Invalid Token");
             throw new Error(`API Error: ${response.status}`);
        }
        return await response.json();
    }

    async appendBlock(blockId, children) {
        const response = await fetch(`${this.baseUrl}/blocks/${blockId}/children`, {
            method: 'PATCH',
            headers: this.headers,
            body: JSON.stringify({ children })
        });

        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        return await response.json();
    }
}

// App State
const state = {
    token: null,
    inboxPageId: null,
    favorites: [], // Array of { id, title, icon, url }
    currentTab: 'recents'
};

// DOM Elements
const views = {
    auth: document.getElementById('auth-view'),
    main: document.getElementById('main-view')
};

const tabs = {
    recents: document.getElementById('tab-recents'),
    search: document.getElementById('tab-search'),
    favorites: document.getElementById('tab-favorites'),
    note: document.getElementById('tab-note')
};

const lists = {
    recents: document.getElementById('recents-list'),
    search: document.getElementById('search-list'),
    favorites: document.getElementById('favorites-list')
};

// Init
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    setupEventListeners();

    if (state.token) {
        showMainView();
        loadRecents(); // Load initial data
    } else {
        showAuthView();
    }
});

// Settings & Auth
async function loadSettings() {
    const data = await chrome.storage.local.get(['notion_token', 'inbox_page_id', 'favorites']);
    state.token = data.notion_token;
    state.inboxPageId = data.inbox_page_id;
    state.favorites = data.favorites || [];
}

async function saveSettings(token, inboxId) {
    await chrome.storage.local.set({
        notion_token: token,
        inbox_page_id: inboxId
    });
    state.token = token;
    state.inboxPageId = inboxId;
}

function showAuthView() {
    views.auth.classList.remove('hidden');
    views.main.classList.add('hidden');
    document.getElementById('settings-btn').style.display = 'none'; // Hide settings btn in auth view

    // Fill inputs if available
    if (state.token) document.getElementById('notion-token').value = state.token;
    if (state.inboxPageId) document.getElementById('inbox-page-id').value = state.inboxPageId;
}

function showMainView() {
    views.auth.classList.add('hidden');
    views.main.classList.remove('hidden');
    document.getElementById('settings-btn').style.display = 'block';
}

// Event Listeners
function setupEventListeners() {
    // Auth
    document.getElementById('save-auth-btn').addEventListener('click', async () => {
        const token = document.getElementById('notion-token').value.trim();
        const inboxId = document.getElementById('inbox-page-id').value.trim();
        const errorMsg = document.getElementById('auth-error');

        if (!token) {
            errorMsg.textContent = "Token is required.";
            errorMsg.style.display = 'block';
            return;
        }

        // Verify token by making a simple call
        const api = new NotionAPI(token);
        try {
            document.getElementById('save-auth-btn').textContent = "Validando...";
            await api.getRecent(); // Simple read check

            await saveSettings(token, inboxId);
            errorMsg.style.display = 'none';
            document.getElementById('save-auth-btn').textContent = "Salvar Configuração";
            showMainView();
            loadRecents();
        } catch (e) {
            console.error(e);
            errorMsg.textContent = "Token inválido ou erro de conexão.";
            errorMsg.style.display = 'block';
            document.getElementById('save-auth-btn').textContent = "Salvar Configuração";
        }
    });

    // Settings Button
    document.getElementById('settings-btn').addEventListener('click', () => {
        showAuthView();
    });

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
        });
    });

    // Search
    const searchInput = document.getElementById('search-input');
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value.trim();

        if (query.length > 0) {
            document.getElementById('search-loading').classList.remove('hidden');
            debounceTimer = setTimeout(() => {
                performSearch(query);
            }, 500); // 500ms debounce
        } else {
            lists.search.innerHTML = '';
            document.getElementById('search-loading').classList.add('hidden');
        }
    });

    // Quick Note
    document.getElementById('send-note-btn').addEventListener('click', sendQuickNote);
}

function switchTab(tabName) {
    // Update buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update views
    Object.values(tabs).forEach(el => el.classList.add('hidden'));
    tabs[tabName].classList.remove('hidden');

    state.currentTab = tabName;

    if (tabName === 'recents') loadRecents();
    if (tabName === 'favorites') loadFavoritesUI();
}

// Logic: Recents
async function loadRecents() {
    const list = lists.recents;
    const loader = document.getElementById('recents-loading');

    list.innerHTML = '';
    loader.classList.remove('hidden');

    try {
        const api = new NotionAPI(state.token);
        const data = await api.getRecent();

        loader.classList.add('hidden');
        renderList(list, data.results);
    } catch (e) {
        loader.classList.add('hidden');
        list.innerHTML = `<div class="error-msg">Erro ao carregar recentes: ${e.message}</div>`;
        if (e.message === "Invalid Token") {
             // Maybe redirect to auth?
        }
    }
}

// Logic: Search
async function performSearch(query) {
    const list = lists.search;
    const loader = document.getElementById('search-loading');

    try {
        const api = new NotionAPI(state.token);
        const data = await api.search(query);

        loader.classList.add('hidden');
        renderList(list, data.results);
    } catch (e) {
        loader.classList.add('hidden');
        list.innerHTML = `<div class="error-msg">Erro na busca: ${e.message}</div>`;
    }
}

// Logic: Favorites
async function toggleFavorite(item) {
    const index = state.favorites.findIndex(f => f.id === item.id);
    if (index === -1) {
        // Add
        state.favorites.push({
            id: item.id,
            title: getTitle(item),
            icon: getIcon(item),
            url: item.url,
            last_edited_time: item.last_edited_time
        });
    } else {
        // Remove
        state.favorites.splice(index, 1);
    }

    await chrome.storage.local.set({ favorites: state.favorites });

    // Refresh current view if needed
    if (state.currentTab === 'favorites') {
        loadFavoritesUI();
    } else {
        // Just update icons in the current list
        updateFavoriteIcons();
    }
}

function loadFavoritesUI() {
    const list = lists.favorites;
    const emptyMsg = document.getElementById('favorites-empty');

    list.innerHTML = '';

    if (state.favorites.length === 0) {
        emptyMsg.classList.remove('hidden');
        return;
    } else {
        emptyMsg.classList.add('hidden');
    }

    // Render from local state
    // We map them to match the structure expected by renderList somewhat, or custom render
    // renderList expects Notion API objects roughly. Let's adapt.
    state.favorites.forEach(fav => {
        const el = createListItem(fav, true);
        list.appendChild(el);
    });
}

function updateFavoriteIcons() {
    // Find all fav buttons in DOM and update state
    document.querySelectorAll('.fav-btn').forEach(btn => {
        const id = btn.dataset.id;
        const isFav = state.favorites.some(f => f.id === id);
        btn.classList.toggle('active', isFav);
        btn.textContent = isFav ? '★' : '☆';
    });
}

// Logic: Quick Note
async function sendQuickNote() {
    const input = document.getElementById('note-input');
    const status = document.getElementById('note-status');
    const content = input.value.trim();

    if (!content) return;

    status.textContent = "Enviando...";
    status.className = "state-msg";
    status.classList.remove('hidden');

    const api = new NotionAPI(state.token);

    try {
        let targetId = state.inboxPageId;

        // If no ID configured, search for "Inbox"
        if (!targetId) {
            status.textContent = "Procurando página 'Inbox'...";
            const searchResults = await api.search("Inbox");
            // Find first page exactly named "Inbox" or containing it?
            // Let's take the first result that is a page
            const inboxPage = searchResults.results.find(r => r.object === 'page');

            if (inboxPage) {
                targetId = inboxPage.id;
                // Optionally save it for future
                state.inboxPageId = targetId;
                chrome.storage.local.set({ inbox_page_id: targetId });
            } else {
                throw new Error("Página 'Inbox' não encontrada. Configure o ID nas opções.");
            }
        }

        status.textContent = "Salvando nota...";

        // Block structure for paragraph
        const children = [
            {
                object: 'block',
                type: 'paragraph',
                paragraph: {
                    rich_text: [
                        {
                            type: 'text',
                            text: {
                                content: content
                            }
                        }
                    ]
                }
            }
        ];

        await api.appendBlock(targetId, children);

        input.value = '';
        status.textContent = "Nota salva com sucesso!";
        setTimeout(() => status.classList.add('hidden'), 2000);

    } catch (e) {
        console.error(e);
        status.textContent = `Erro: ${e.message}`;
        status.className = "error-msg";
        status.classList.remove('hidden');
    }
}

// Helpers
function renderList(container, items) {
    container.innerHTML = '';
    if (!items || items.length === 0) {
        container.innerHTML = '<div class="state-msg">Nenhum resultado encontrado.</div>';
        return;
    }

    items.forEach(item => {
        // Pre-process item for display
        const simpleItem = {
            id: item.id,
            title: getTitle(item),
            icon: getIcon(item),
            url: item.url,
            last_edited_time: item.last_edited_time
        };
        container.appendChild(createListItem(simpleItem, false));
    });

    updateFavoriteIcons();
}

function createListItem(item, isFromFav) {
    const div = document.createElement('div');
    div.className = 'list-item';

    const isFav = state.favorites.some(f => f.id === item.id);

    div.innerHTML = `
        <div class="item-icon">${item.icon}</div>
        <div class="item-content">
            <div class="item-title">${escapeHtml(item.title)}</div>
            ${item.last_edited_time ? `<div class="item-meta">Editado: ${new Date(item.last_edited_time).toLocaleDateString()}</div>` : ''}
        </div>
        <div class="item-actions">
            <button class="fav-btn ${isFav ? 'active' : ''}" data-id="${item.id}">${isFav ? '★' : '☆'}</button>
        </div>
    `;

    // Click on item -> Open Notion
    div.querySelector('.item-content').addEventListener('click', () => {
        // Open in new tab
        chrome.tabs.create({ url: item.url });
    });

    // Click on Fav -> Toggle
    div.querySelector('.fav-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(item);
    });

    return div;
}

function getTitle(item) {
    if (item.title && typeof item.title === 'string') return item.title; // for favorites stored locally

    // For API objects
    if (item.properties) {
        // Search for title property (usually "Name" or "title")
        const titleProp = Object.values(item.properties).find(p => p.type === 'title');
        if (titleProp && titleProp.title && titleProp.title.length > 0) {
            return titleProp.title.map(t => t.plain_text).join('');
        }
    }

    // Fallback for databases or pages without title
    if (item.object === 'database' && item.title && Array.isArray(item.title)) {
        return item.title.map(t => t.plain_text).join('') || "Sem título";
    }

    return "Sem título";
}

function getIcon(item) {
    if (item.icon && typeof item.icon === 'string') return item.icon; // stored locally

    if (item.icon) {
        if (item.icon.type === 'emoji') return item.icon.emoji;
        if (item.icon.type === 'external') return '📄'; // Image icon, simplificando
    }
    return '📄';
}

function escapeHtml(text) {
    if (!text) return text;
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
