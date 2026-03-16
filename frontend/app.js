/**
 * CryptoAlgoBot - Main Application Coordinator
 *
 * Modern ES6 Module Architecture
 * - State Management: store.js
 * - API Client: api-client.js
 * - Components: chart-renderer.js, bot-manager.js
 *
 * Usage:
 *   <script type="module" src="app.js"></script>
 */

// Import modules
import store from './state/store.js';
import api from './services/api-client.js';
import chartRenderer from './components/charts/chart-renderer.js';
import botManager from './components/bots/bot-manager.js';

// ============================================================================
// APPLICATION STATE
// ============================================================================

const app = {
    initialized: false,
    activeTab: 'dashboard',
    refreshInterval: null
};

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize application
 */
async function init() {
    console.log('🚀 CryptoAlgoBot başlatılıyor...');

    try {
        // 1. Initialize components
        botManager.init();

        // 2. Setup UI
        setupTabs();
        setupEventListeners();

        // 3. Show default tab (portfolio)
        switchTab('tab-portfolio');

        // 4. Load initial data
        await loadDashboard();
        await loadActiveTasks();
        await loadDatabaseInventory();  // Load inventory
        await loadMarketList();  // Load market list
        await loadRiskSettings();  // Load risk settings
        await loadAdvancedSettings();  // Load advanced settings
        await loadSymbolsForBot();  // Load symbols for bot launcher
        await loadStrategiesForBot();  // Load strategies
        await loadTimeframesForBot();  // Load timeframes

        // 5. Start auto-refresh
        startAutoRefresh();

        app.initialized = true;
        console.log('✅ Uygulama başarıyla başlatıldı');

    } catch (error) {
        console.error('❌ Uygulama başlatma hatası:', error);
    }
}

// ============================================================================
// TAB NAVIGATION
// ============================================================================

/**
 * Setup tab navigation
 */
function setupTabs() {
    const tabs = document.querySelectorAll('.menu-item');

    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();

            // data-target attribute'ını kullan (HTML ile uyumlu)
            const targetTab = tab.dataset.target || tab.dataset.tab;
            switchTab(targetTab);
        });
    });
}

/**
 * Switch to tab
 * @param {string} tabId - Tab ID
 */
function switchTab(tabId) {
    if (!tabId) {
        console.warn('⚠️ [TAB] No tabId provided');
        return;
    }

    app.activeTab = tabId;

    console.log(`📑 [TAB] Switching to: ${tabId}`);

    // Update menu items
    document.querySelectorAll('.menu-item').forEach(item => {
        const target = item.dataset.target || item.dataset.tab;
        if (target === tabId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        const contentId = content.id.replace('tab-', '');
        if (tabId === content.id || tabId === contentId) {
            content.style.display = 'block';
            console.log(`✅ [TAB] Showing: ${content.id}`);
        } else {
            content.style.display = 'none';
        }
    });

    // Update store
    store.setState('ui', { ...store.get('ui'), activeTab: tabId });

    console.log(`📑 [TAB] Switched to: ${tabId}`);
}

// ============================================================================
// DATA LOADING
// ============================================================================

/**
 * Load dashboard data
 */
async function loadDashboard() {
    try {
        const metrics = await api.getDashboardMetrics();
        store.setState('system', {
            status: 'online',
            metrics: metrics,
            lastUpdate: new Date().toISOString()
        });

        console.log('📊 [DASHBOARD] Metrics loaded');

    } catch (error) {
        console.error('❌ [DASHBOARD] Load error:', error);
        store.setState('system', { status: 'error' });
    }
}

/**
 * Load active download tasks
 */
async function loadActiveTasks() {
    try {
        const data = await api.getActiveDownloads();
        store.setState('downloads', data);

        // Render tasks
        renderActiveTasks(data.downloads || {});

        console.log('📥 [DOWNLOADS] Tasks loaded');

    } catch (error) {
        console.error('❌ [DOWNLOADS] Load error:', error);
    }
}

/**
 * Load database inventory
 */
async function loadDatabaseInventory() {
    try {
        const inventory = await api.getDataInventory();
        const stats = await api.getDataStats();

        store.setState('inventory', { inventory, stats });

        // Render inventory
        renderDatabaseInventory(inventory, stats);

        console.log('📊 [INVENTORY] Loaded');

    } catch (error) {
        console.error('❌ [INVENTORY] Load error:', error);
    }
}

/**
 * Render database inventory
 */
function renderDatabaseInventory(inventory, stats) {
    const statsEl = document.getElementById('data-stats-summary');
    const tableEl = document.getElementById('data-stats-table');

    if (!statsEl || !tableEl) return;

    const totalCandles = inventory?.total_candles || stats?.total_candles || 0;
    const inventoryList = inventory?.inventory || stats?.stats || [];

    // Update summary
    const millions = (totalCandles / 1000000).toFixed(2);
    statsEl.innerHTML = `
        <span style="font-size:1.3rem; font-weight:700; color:var(--neon-blue);">📊 Toplam: ${millions} Milyon</span>
        <div style="display:flex; gap:20px; margin-top:8px;">
            <span style="font-size:0.85rem; color:var(--text-muted);">
                📦 ${inventoryList.length} farklı sembol/timeframe kombinasyonu
            </span>
        </div>
    `;

    // Render table
    if (inventoryList.length === 0) {
        tableEl.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px;">📭 Veritabanında henüz veri yok</p>';
        return;
    }

    tableEl.innerHTML = `
        <table style="width:100%; border-collapse:collapse;">
            <thead>
                <tr style="border-bottom:2px solid rgba(255,255,255,0.15); position: sticky; top: 0; background: #0a0e1a;">
                    <th style="padding:12px 10px; text-align:left; font-size:0.8rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">🪙 Sembol</th>
                    <th style="padding:12px 10px; text-align:left; font-size:0.8rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">📅 Başlangıç</th>
                    <th style="padding:12px 10px; text-align:left; font-size:0.8rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">📅 Bitiş</th>
                    <th style="padding:12px 10px; text-align:right; font-size:0.8rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">📊 Mum Sayısı</th>
                </tr>
            </thead>
            <tbody>
                ${inventoryList.map(item => {
                    const countFormatted = (item.count || 0).toLocaleString('tr-TR');
                    const countShort = item.count >= 1000000 ? `${(item.count / 1000000).toFixed(2)}M` :
                                      item.count >= 1000 ? `${(item.count / 1000).toFixed(0)}K` : item.count;
                    const countColor = item.count >= 1000000 ? '#00ff88' :
                                      item.count >= 100000 ? 'var(--neon-green)' : 'var(--text-main)';

                    // GERÇEK MARKET TYPE TESPİTİ
                    const symbol = item.symbol || 'N/A';
                    const isFutures = symbol.includes(':USDT') || symbol.includes(':USDC') || symbol.endsWith('-SWAP');
                    const marketTypeLabel = isFutures ? '💹 Vadeli' : '💰 Spot';
                    const marketTypeColor = isFutures ? 'var(--neon-blue)' : 'var(--neon-green)';
                    const marketTypeKey = isFutures ? 'future' : 'spot';

                    return `
                        <tr style="border-bottom:1px solid rgba(255,255,255,0.05); transition: background 0.2s;"
                            onmouseover="this.style.background='rgba(255,255,255,0.03)'"
                            onmouseout="this.style.background='transparent'">
                            <td style="padding:12px 10px;">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <span style="font-weight:700; font-size:0.95rem; color:var(--text-main);">${symbol}</span>
                                    <span style="font-size:0.7rem; padding:2px 8px; border-radius:4px;
                                                background:${isFutures ? 'rgba(88, 166, 255, 0.2)' : 'rgba(46, 220, 135, 0.2)'}; color:${marketTypeColor}; font-weight:600;">
                                        ${marketTypeLabel}
                                    </span>
                                </div>
                                <div style="font-size:0.7rem; color:var(--text-muted); margin-top:4px;">
                                    ⏱️ ${item.timeframe || '1m'}
                                </div>
                            </td>
                            <td style="padding:12px 10px;">
                                <span style="font-size:0.85rem; color:#ffa500; font-weight:600;">📅 ${item.min_date || 'N/A'}</span>
                            </td>
                            <td style="padding:12px 10px;">
                                <span style="font-size:0.85rem; color:#ff6b6b; font-weight:600;">📅 ${item.max_date || 'N/A'}</span>
                            </td>
                            <td style="padding:12px 10px; text-align:right;">
                                <div style="display:flex; align-items:center; justify-content:flex-end; gap:12px;">
                                    <button class="data-btn data-btn-danger" onclick="deleteSymbolData('${symbol}', '${marketTypeKey}')"
                                        title="${symbol} verilerini sil"
                                        style="padding:4px 10px; font-size:0.75rem; background: linear-gradient(135deg, #dc2626, #991b1b);">
                                        🗑️ Sil
                                    </button>
                                    <span style="font-size:1rem; font-weight:700; color:${countColor};">${countShort}</span>
                                </div>
                                <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">
                                    ${countFormatted} mum
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

/**
 * Render active tasks
 */
function renderActiveTasks(downloads) {
    const tasksListEl = document.getElementById('active-tasks-list');
    const tasksCountEl = document.getElementById('active-tasks-count');

    if (!tasksListEl) return;

    const tasks = Object.entries(downloads);
    const activeCount = tasks.filter(([_, t]) => t.status === 'running').length;
    const totalCount = tasks.length;

    // Update count
    if (tasksCountEl) {
        tasksCountEl.textContent = `${activeCount} Aktif / ${totalCount} Toplam`;
    }

    if (tasks.length === 0) {
        tasksListEl.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                📭 Aktif veya tamamlanmış indirme yok
            </div>
        `;
        return;
    }

    // Render tasks
    tasksListEl.innerHTML = tasks.map(([key, task]) => {
        const statusClass = task.status === 'running' ? 'running' :
                           task.status === 'completed' ? 'completed' :
                           task.status === 'paused' ? 'paused' : 'stopped';

        const statusDisplay = task.status === 'running' ? '🔄 İndiriliyor' :
                             task.status === 'completed' ? '✅ Tamamlandı' :
                             task.status === 'paused' ? '⏸️ Duraklatıldı' : '⏹️ Durduruldu';

        const progress = task.progress || (task.status === 'completed' ? 100 : 0);
        const speed = task.speed || 0;

        // Tarih bilgileri
        let startDate = task.start_date || '...';
        let lastCandleDate = '-';

        if (task.target_start_ms && !startDate) {
            startDate = new Date(task.target_start_ms).toLocaleDateString('tr-TR');
        }

        if (task.current_ts) {
            const dateObj = new Date(task.current_ts);
            lastCandleDate = dateObj.toLocaleString('tr-TR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Europe/Istanbul'
            });
        }

        // Sembol ve market type
        let symbolName = key;
        let marketType = task.market_type || 'future';

        if (key.includes('_future') || key.includes('_spot')) {
            const parts = key.split('_');
            marketType = parts[parts.length - 1];
            symbolName = parts.slice(0, -1).join('_');
        }

        // Silme butonları
        const deleteButtons = `
            <div style="display:flex; gap:4px;">
                <button class="task-btn task-btn-delete" onclick="deleteDownloadTask('${key}', '${marketType}')" title="Sadece görevi sil (veri korunur)"
                    style="background: linear-gradient(135deg, #6b7280, #4b5563); border: none; color: white; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">
                    🗑️
                </button>
                <button class="task-btn task-btn-danger" onclick="deleteDownloadTaskWithData('${key}', '${marketType}')" title="Görev + TÜM veriyi sil (DB + Flat files)"
                    style="background: linear-gradient(135deg, #dc2626, #991b1b); border: none; color: white; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.9rem; animation: pulse 2s infinite;">
                    ⚠️
                </button>
            </div>
        `;

        const pauseButton = (task.status === 'running' || task.status === 'paused') ? `
            <button class="task-btn" onclick="togglePause('${key}', '${task.status === 'paused' ? 'resume' : 'pause'}')" title="${task.status === 'paused' ? 'Devam Et' : 'Duraklat'}"
                style="background: var(--neon-blue); border: none; color: white; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">
                ${task.status === 'paused' ? '▶️' : '⏸️'}
            </button>
        ` : '';

        return `
            <div class="task-item ${statusClass}">
                <div class="task-header">
                    <span class="task-symbol">${symbolName}</span>
                    <span class="task-status status-${statusClass}">${statusDisplay}</span>
                </div>

                <div class="task-body">
                    <div class="task-info">
                        <span class="task-info-label">Timeframe</span>
                        <span class="task-info-value">${task.timeframe || '1m'}</span>
                    </div>
                    <div class="task-info">
                        <span class="task-info-label">Market</span>
                        <span class="task-info-value">${marketType === 'future' ? '💹 Futures' : '💰 Spot'}</span>
                    </div>
                    <div class="task-info">
                        <span class="task-info-label">Başlangıç</span>
                        <span class="task-info-value">${startDate}</span>
                    </div>
                    <div class="task-info">
                        <span class="task-info-label">Son Mum</span>
                        <span class="task-info-value">${lastCandleDate}</span>
                    </div>
                </div>

                <div class="task-progress-section">
                    <div class="task-progress-bar-wrapper">
                        <div class="task-progress-bar-fill" style="width: ${Math.min(progress, 100)}%"></div>
                    </div>
                    <div class="task-progress-text">
                        <span>📊 %${Math.round(progress)} tamamlandı</span>
                        ${speed > 0 ? `<span>⚡ ${Math.round(speed)} mum/sn</span>` : ''}
                    </div>
                </div>

                <div class="task-footer">
                    ${deleteButtons}
                    ${pauseButton}
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Load market list from exchange
 */
async function loadMarketList() {
    try {
        const response = await fetch('/api/v1/exchange/markets');
        const data = await response.json();

        const marketListEl = document.getElementById('market-selection-list');
        const searchInput = document.getElementById('market-search');

        if (marketListEl && data.markets && data.markets.length > 0) {
            // Store markets in state for filtering
            store.setState('markets', { list: data.markets, filtered: data.markets });

            renderMarketList(data.markets);

            // Add search listener
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    filterMarkets(e.target.value);
                });
            }

            console.log(`📊 [MARKETS] ${data.markets.length} market loaded`);
        }

    } catch (error) {
        console.error('❌ [MARKETS] Load error:', error);
    }
}

/**
 * Render market list
 */
function renderMarketList(markets) {
    const marketListEl = document.getElementById('market-selection-list');
    if (!marketListEl) return;

    marketListEl.innerHTML = markets.map(m => `
        <div class="market-item" onclick="selectMarket('${m.symbol}', '${m.raw_type}')">
            <span>${m.symbol}</span>
            <span class="market-type">${m.type}</span>
        </div>
    `).join('');
}

/**
 * Filter markets by search query
 */
function filterMarkets(query) {
    const state = store.get('markets');
    if (!state || !state.list) return;

    const filtered = state.list.filter(m =>
        m.symbol.toLowerCase().includes(query.toLowerCase()) ||
        m.base.toLowerCase().includes(query.toLowerCase())
    );

    store.setState('markets', { ...state, filtered });
    renderMarketList(filtered);

    console.log(`🔍 [FILTER] ${filtered.length} markets found`);
}

/**
 * Save market selection (called from HTML)
 */
window.saveMarketSelection = function() {
    console.log('💾 [MARKET] Selection saved');
    // Implement market selection logic here
};

/**
 * Select market (called from HTML)
 */
window.selectMarket = function(symbol, marketType) {
    console.log(`📊 [MARKET] Selected: ${symbol} (${marketType})`);

    // Auto-fill symbol in download section
    const selectedSymbolEl = document.getElementById('selected-symbol-val');
    const selectedMarketTypeEl = document.getElementById('market-type-display');

    if (selectedSymbolEl) {
        selectedSymbolEl.textContent = symbol;
        console.log(`✅ [MARKET] Symbol filled: ${symbol}`);
    }

    if (selectedMarketTypeEl) {
        selectedMarketTypeEl.textContent = marketType === 'future' ? '💹 Vadeli' : '💰 Spot';
        console.log(`✅ [MARKET] Market type filled: ${marketType}`);
    }

    // Scroll to download section
    const downloadSection = document.getElementById('download-controls');
    if (downloadSection) {
        downloadSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        console.log('📜 [MARKET] Scrolled to download section');
    }
};

/**
 * Delete symbol data (called from HTML)
 */
window.deleteSymbolData = async function(symbol, marketType) {
    if (!confirm(`${symbol} (${marketType === 'future' ? 'Futures' : 'Spot'}) verilerini silmek istediğinizden emin misiniz?\n\nBu işlem geri alınamaz!`)) {
        return;
    }

    try {
        alert(`🗑️ ${symbol} verileri siliniyor...`);

        const result = await api.deleteData(symbol, marketType);

        if (result.status === 'success') {
            alert(`✅ ${symbol} verileri silindi!`);
            await loadDatabaseInventory(); // Refresh inventory
            await loadActiveTasks();
        } else {
            alert(`❌ Silme hatası: ${result.message}`);
        }
    } catch (error) {
        alert(`❌ Silme hatası: ${error.message}`);
    }
};

/**
 * Start download (called from HTML)
 */
window.startDownload = async function() {
    const symbol = document.getElementById('selected-symbol-val')?.textContent;
    const startDate = document.getElementById('download-start-date')?.value;
    const marketType = document.getElementById('market-type-filter')?.value || 'future';

    if (!symbol) {
        alert('❌ Lütfen bir sembol seçin!');
        return;
    }

    if (!startDate) {
        alert('❌ Lütfen bir başlangıç tarihi seçin!');
        return;
    }

    try {
        console.log(`🚀 [DOWNLOAD] Starting: ${symbol} from ${startDate}`);

        const result = await api.startDownload(symbol, '1m', startDate);

        if (result.status === 'started' || result.status === 'exists') {
            alert(`✅ ${result.message}`);
            await loadActiveTasks(); // Refresh tasks
        } else {
            alert(`⚠️ ${result.message}`);
        }

    } catch (error) {
        console.error('❌ [DOWNLOAD] Error:', error);
        alert('❌ İndirme hatası: ' + error.message);
    }
};

/**
 * Stop download (called from HTML)
 */
window.stopDownload = async function() {
    const symbol = document.getElementById('selected-symbol-val')?.textContent;

    if (!symbol) {
        alert('❌ Lütfen bir sembol seçin!');
        return;
    }

    try {
        const result = await api.stopDownload(symbol);
        alert(result.message);
        await loadActiveTasks();
    } catch (error) {
        alert('❌ Durdurma hatası: ' + error.message);
    }
};

/**
 * Delete all data (called from HTML)
 */
window.deleteAllData = async function() {
    if (!confirm('⚠️ DİKKAT! Tüm veriler silinecek. Emin misiniz?')) {
        return;
    }

    try {
        const response = await fetch('/api/v1/data/delete-all', { method: 'DELETE' });
        const result = await response.json();

        if (result.status === 'success') {
            alert(`✅ ${result.message}`);
            await loadActiveTasks();
        } else {
            alert(`⚠️ ${result.message}`);
        }
    } catch (error) {
        alert('❌ Silme hatası: ' + error.message);
    }
};

/**
 * Delete download task (called from HTML)
 */
window.deleteDownloadTask = async function(symbol, marketType) {
    if (!confirm(`${symbol} (${marketType}) için indirme görevi silinecek. Veri KORUNUR, sadece görev silinir. Emin misiniz?`)) {
        return;
    }

    try {
        const result = await api.deleteDownloadTask(symbol, marketType);

        if (result.status === 'success') {
            alert(`✅ ${result.message}`);
            await loadActiveTasks();
        } else {
            alert(`❌ Silme hatası: ${result.message}`);
        }
    } catch (error) {
        alert('❌ Silme hatası: ' + error.message);
    }
};

/**
 * Delete download task with data (called from HTML)
 */
window.deleteDownloadTaskWithData = async function(symbol, marketType) {
    if (!confirm(`⚠️ DİKKAT! ${symbol} (${marketType}) için:\n\n• İndirme görevi silinecek\n• TÜM mum verileri silinecek (DB)\n• TÜM flat file'lar silinecek\n\nBu işlem GERİ ALINAMAZ! Emin misiniz?`)) {
        return;
    }

    // İkinci onay
    if (!confirm('Gerçekten emin misiniz? TÜM veriler silinecek!')) {
        return;
    }

    try {
        alert(`⚠️ ${symbol} görev + veri siliniyor...`);

        // 1. Önce download task sil
        await api.deleteDownloadTask(symbol, marketType);

        // 2. Veriyi sil (DB + Flat files)
        const symbolClean = symbol.split('_')[0].trim();
        const deleteDataResult = await fetch('/api/v1/data/delete-klines', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                symbol: symbolClean,
                market_type: marketType
            })
        });

        const deleteDataJson = await deleteDataResult.json();

        if (deleteDataJson.status === 'success') {
            alert(`✅ ${symbol} görev + TÜM veriler silindi!`);
        } else {
            alert(`⚠️ Görev silindi ama veri silme hatası: ${deleteDataJson.message}`);
        }

        await loadActiveTasks();

    } catch (error) {
        alert('❌ Silme hatası: ' + error.message);
    }
};

/**
 * Toggle pause (called from HTML)
 */
window.togglePause = async function(symbol, action) {
    try {
        const result = await api.togglePause(symbol, action);

        if (result.status === 'success') {
            alert(`✅ ${result.message}`);
            await loadActiveTasks();
        } else {
            alert(`❌ Hata: ${result.message}`);
        }
    } catch (error) {
        alert('❌ Hata: ' + error.message);
    }
};

// ============================================================================
// SETTINGS FORMS
// ============================================================================

/**
 * Load risk settings
 */
async function loadRiskSettings() {
    try {
        const data = await api.getRiskSettings();

        if (data.status === 'success' && data.config) {
            // Fill form inputs
            document.getElementById('risk-max-risk-percent').value = data.config.max_risk_per_trade_percent || 1.0;
            document.getElementById('risk-max-leverage').value = data.config.max_leverage || 10;
            document.getElementById('risk-max-positions').value = data.config.max_open_positions || 5;
            document.getElementById('risk-max-losses').value = data.config.max_consecutive_losses || 5;

            console.log('⚙️ [SETTINGS] Risk settings loaded');
        }
    } catch (error) {
        console.error('❌ [SETTINGS] Risk load error:', error);
    }
}

/**
 * Save risk settings
 */
async function saveRiskSettings() {
    const data = {
        max_risk_per_trade_percent: parseFloat(document.getElementById('risk-max-risk-percent').value),
        max_leverage: parseInt(document.getElementById('risk-max-leverage').value),
        max_open_positions: parseInt(document.getElementById('risk-max-positions').value),
        max_consecutive_losses: parseInt(document.getElementById('risk-max-losses').value)
    };

    // Validation
    if (data.max_risk_per_trade_percent < 0.1 || data.max_risk_per_trade_percent > 5.0) {
        showToast('❌ Risk %0.1 - %5.0 arasında olmalı!', 'error');
        return;
    }
    if (data.max_leverage < 1 || data.max_leverage > 50) {
        showToast('❌ Kaldıraç 1x - 50x arasında olmalı!', 'error');
        return;
    }

    try {
        const result = await api.saveRiskSettings(data);

        if (result.status === 'success') {
            showToast('✅ Risk ayarları güncellendi (Hot-Reload)', 'success');
            console.log('⚙️ [SETTINGS] Risk settings saved');
        } else {
            showToast('❌ ' + result.message, 'error');
        }
    } catch (error) {
        showToast('❌ Kaydetme hatası: ' + error.message, 'error');
    }
}

/**
 * Load advanced settings
 */
async function loadAdvancedSettings() {
    try {
        const data = await api.getAdvancedSettings();

        if (data.status === 'success' && data.config) {
            // WFO
            const wfo = data.config.wfo || {};
            document.getElementById('wfo-enabled').checked = wfo.enabled || false;
            document.getElementById('wfo-interval').value = wfo.reoptimize_interval || 168;

            // ML
            const ml = data.config.ml || {};
            document.getElementById('ml-enabled').checked = ml.enabled || true;
            document.getElementById('ml-threshold').value = ml.confidence_threshold || 0.6;

            // HTF
            const htf = data.config.htf || {};
            document.getElementById('htf-enabled').checked = htf.enabled || true;
            document.getElementById('htf-ema-fast').value = htf.ema_fast || 20;
            document.getElementById('htf-ema-slow').value = htf.ema_slow || 50;

            // Kalman
            const kalman = data.config.kalman || { enabled: true, q: 0.001, r: 0.1 };
            document.getElementById('kalman-enabled').checked = kalman.enabled;
            document.getElementById('kalman-q').value = kalman.q;
            document.getElementById('kalman-r').value = kalman.r;

            // Candle Lock
            const candleLock = data.config.candle_lock || { enabled: true, interval: 1 };
            document.getElementById('candle-lock-enabled').checked = candleLock.enabled;
            document.getElementById('candle-lock-interval').value = candleLock.interval;

            console.log('⚙️ [SETTINGS] Advanced settings loaded');
        }
    } catch (error) {
        console.error('❌ [SETTINGS] Advanced load error:', error);
    }
}

/**
 * Save advanced settings
 */
async function saveAdvancedSettings() {
    const data = {
        wfo: {
            enabled: document.getElementById('wfo-enabled').checked,
            reoptimize_interval: parseInt(document.getElementById('wfo-interval').value),
            optimization_metric: 'sharpe',
            train_days: 30,
            test_days: 7
        },
        ml: {
            enabled: document.getElementById('ml-enabled').checked,
            confidence_threshold: parseFloat(document.getElementById('ml-threshold').value)
        },
        htf: {
            enabled: document.getElementById('htf-enabled').checked,
            ema_fast: parseInt(document.getElementById('htf-ema-fast').value),
            ema_slow: parseInt(document.getElementById('htf-ema-slow').value)
        },
        kalman: {
            enabled: document.getElementById('kalman-enabled').checked,
            q: parseFloat(document.getElementById('kalman-q').value),
            r: parseFloat(document.getElementById('kalman-r').value)
        },
        candle_lock: {
            enabled: document.getElementById('candle-lock-enabled').checked,
            interval: parseInt(document.getElementById('candle-lock-interval').value)
        }
    };

    // Validation
    if (data.ml.confidence_threshold < 0.3 || data.ml.confidence_threshold > 0.9) {
        showToast('❌ ML güven eşiği %30 - %90 arasında olmalı!', 'error');
        return;
    }

    try {
        const result = await api.saveAdvancedSettings(data);

        if (result.status === 'success') {
            showToast('✅ Gelişmiş ayarlar güncellendi (Hot-Reload)', 'success');
            console.log('⚙️ [SETTINGS] Advanced settings saved');
        } else {
            showToast('❌ ' + result.message, 'error');
        }
    } catch (error) {
        showToast('❌ Kaydetme hatası: ' + error.message, 'error');
    }
}

/**
 * Save API keys
 */
async function saveApiKeys() {
    const apiKey = document.getElementById('api-key-input').value;
    const apiSecret = document.getElementById('api-secret-input').value;

    if (!apiKey || !apiSecret) {
        showToast('❌ API Key ve Secret giriniz!', 'error');
        return;
    }

    if (apiKey.length < 10 || apiSecret.length < 10) {
        showToast('❌ API Key/Secret en az 10 karakter olmalı!', 'error');
        return;
    }

    try {
        const result = await api.saveApiKeys({ api_key: apiKey, api_secret: apiSecret });

        if (result.status === 'success') {
            showToast('✅ API anahtarları şifrelenerek kaydedildi', 'success');
            console.log('🔐 [SECURITY] API keys saved');
        } else {
            showToast('❌ ' + result.message, 'error');
        }
    } catch (error) {
        showToast('❌ Kaydetme hatası: ' + error.message, 'error');
    }
}

/**
 * Test API connection
 */
async function testApiConnection() {
    const apiKey = document.getElementById('api-key-input').value;
    const apiSecret = document.getElementById('api-secret-input').value;

    if (!apiKey || !apiSecret) {
        showToast('❌ API Key ve Secret giriniz!', 'error');
        return;
    }

    try {
        showToast('🧪 API bağlantısı test ediliyor...', 'info');

        const result = await api.testApiConnection({ api_key: apiKey, api_secret: apiSecret });

        if (result.valid) {
            showToast(`✅ API bağlantısı başarılı! USDT: ${result.usdt_balance}`, 'success');
        } else {
            showToast('❌ ' + result.message, 'error');
        }
    } catch (error) {
        showToast('❌ Test hatası: ' + error.message, 'error');
    }
}

/**
 * Load symbols for bot launcher
 */
async function loadSymbolsForBot() {
    try {
        const data = await api.getSymbolsWithData();
        const symbols = data.symbols || [];

        const symbolSelects = document.querySelectorAll('.symbol-select');
        symbolSelects.forEach(select => {
            if (select.id !== 'market-symbol') { // Market selection list is different
                // symbols is an array of strings (e.g., ["BTC/USDT", "ETH/USDT"])
                select.innerHTML = '<option value="">Sembol Seçin...</option>' +
                    symbols.map(s => `<option value="${s}">${s}</option>`).join('');
            }
        });

        console.log(`📊 [SYMBOLS] ${symbols.length} sembol yüklendi`);
    } catch (error) {
        console.error('❌ [SYMBOLS] Load error:', error);
    }
}

/**
 * Load strategies for bot launcher
 */
async function loadStrategiesForBot() {
    try {
        const data = await api.getStrategies();
        const strategies = data.strategies || [];

        const strategySelects = document.querySelectorAll('.strategy-select');
        strategySelects.forEach(select => {
            select.innerHTML = '<option value="">Strateji Seçin...</option>' +
                strategies.map(s => `<option value="${s.id || s.strategy_id}">${s.name || s.strategy_id}</option>`).join('');
        });

        console.log(`📚 [STRATEGIES] ${strategies.length} strateji yüklendi`);
    } catch (error) {
        console.error('❌ [STRATEGIES] Load error:', error);
    }
}

/**
 * Load timeframes for bot launcher
 */
async function loadTimeframesForBot() {
    const timeframes = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d'];

    const timeframeSelects = document.querySelectorAll('.timeframe-select');
    timeframeSelects.forEach(select => {
        select.innerHTML = '<option value="">Timeframe Seçin...</option>' +
            timeframes.map(tf => `<option value="${tf}">${tf}</option>`).join('');
    });

    console.log(`⏱️ [TIMEFRAMES] ${timeframes.length} timeframe yüklendi`);
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

/**
 * Setup global event listeners
 */
function setupEventListeners() {
    // Window resize
    window.addEventListener('resize', () => {
        console.debug('📐 [RESIZE] Window resized');
    });

    // Before unload
    window.addEventListener('beforeunload', () => {
        stopAutoRefresh();
        botManager.destroy();
        chartRenderer.destroy();
    });
}

// ============================================================================
// AUTO REFRESH
// ============================================================================

/**
 * Start auto-refresh
 */
function startAutoRefresh() {
    app.refreshInterval = setInterval(async () => {
        if (app.initialized) {
            await loadDashboard();
            await botManager.loadBots();
            await loadActiveTasks();
        }
    }, 5000); // 5 seconds

    console.log('🔄 [REFRESH] Auto-refresh started (5s)');
}

/**
 * Stop auto-refresh
 */
function stopAutoRefresh() {
    if (app.refreshInterval) {
        clearInterval(app.refreshInterval);
        app.refreshInterval = null;
        console.log('⏹️ [REFRESH] Auto-refresh stopped');
    }
}

// ============================================================================
// GLOBAL FUNCTIONS (for HTML onclick handlers)
// ============================================================================

// Export functions to window for legacy HTML onclick handlers
window.switchTab = switchTab;
window.botManager = botManager;
window.chartRenderer = chartRenderer;
window.store = store;
window.api = api;
window.loadDashboard = loadDashboard;
window.loadActiveTasks = loadActiveTasks;

// ============================================================================
// START APPLICATION
// ============================================================================

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// ============================================================================
// FINAL LOG
// ============================================================================

console.log('🎉 [MİMARİ] Faz 3 Tamamlandı: Frontend ES6 Modüllerine Parçalandı');
