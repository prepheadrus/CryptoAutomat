/**
 * CryptoAlgoBot Frontend App
 * 
 * Modern ES6 Module Architecture
 * Orkestra Şefi - Modülleri yönetir, event listener'ları başlatır
 */

// ============================================================================
// IMPORTS
// ============================================================================

import { api } from './services/api-client.js';
import { store, selectors, actions } from './state/store.js';
import { botManager } from './components/bots/bot-manager.js';
import { ChartRenderer, PlotlyRenderer } from './components/charts/chart-renderer.js';

// ============================================================================
// GLOBAL STATE
// ============================================================================

let refreshIntervals = {
    bots: null,
    data: null,
    dashboard: null,
};

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Ana uygulama başlatma
 */
async function initApp() {
    console.log('🚀 CryptoAlgoBot başlatılıyor...');

    try {
        // Tab navigation
        setupTabs();

        // Initialize components
        botManager.init();

        // Initial data load
        await loadInitialData();

        // Start auto-refresh
        startAutoRefresh();

        // Setup global functions (for HTML onclick handlers)
        setupGlobalFunctions();

        // ❌ Store subscription KALDIRILDI (dropdown çakışma önleme)
        // loadDropdownData() artık her şeyi yapıyor, store subscription gereksiz
        /*
        store.subscribe((state) => {
            if (state.strategies.list && state.dataSymbols !== undefined) {
                populateBotFormDropdowns();
            }
        });
        */

        console.log('✅ Uygulama başarıyla başlatıldı');
    } catch (error) {
        console.error('❌ Uygulama başlatma hatası:', error);
    }
}

/**
 * Initial data load
 */
async function loadInitialData() {
    try {
        // Load markets (for reference)
        await loadMarkets();

        // Load dashboard metrics
        await loadDashboardMetrics();

        // Load strategies
        await loadStrategies();

        // Load symbols with data (for bot form dropdown)
        await loadDataSymbols();

        // Load dropdown data (Sembol + Strateji) - CALIŞAN FONKSİYON
        await loadDropdownData();
        
        console.log('[INFO] Initial data load completed');
    } catch (error) {
        console.error('Initial data load error:', error);
    }
}

// ============================================================================
// TAB NAVIGATION
// ============================================================================

function setupTabs() {
    const buttons = document.querySelectorAll('.menu-item');
    const tabs = document.querySelectorAll('.tab-content');

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (!btn.hasAttribute('data-target')) return;

            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const targetId = btn.getAttribute('data-target');
            tabs.forEach(tab => { tab.style.display = 'none'; });
            document.getElementById(targetId).style.display = 'block';

            // Tab-specific actions
            handleTabSwitch(targetId);
        });
    });
}

function handleTabSwitch(tabId) {
    switch (tabId) {
        case 'tab-history':
            loadTradeHistory();
            break;
        case 'tab-ml':
            loadMLSymbols();
            loadMLTrainingHistory();
            break;
        case 'tab-settings':
            setTimeout(() => {
                botManager.loadBots();
                loadBotFormOptions();
                loadRiskSettings();  // Risk ayarlarını yükle
                loadAdvancedSettings();  // Gelişmiş ayarları yükle (WFO, ML, HTF)
                loadDropdownData();  // Dropdown'lara veri yükle (Sembol + Strateji)
            }, 300);  // 300ms delay (daha hızlı)
            break;
        case 'tab-strategies':
            loadStrategies();
            break;
        case 'tab-data':
            // Veri Laboratuvarı sekmesi - sembolleri ve görevleri yükle
            console.log('[INFO] Veri Laboratuvarı sekmesi açıldı, veriler yükleniyor...');
            loadDataSymbols();  // Veritabanındaki verileri çek
            updateActiveTasks();  // Aktif indirme görevlerini çek
            loadDataStats();  // Veritabanı envanteri ve istatistiklerini yükle
            loadMarkets();
            break;
    }
}

// ============================================================================
// DATA LOADING
// ============================================================================

async function loadMarkets() {
    try {
        console.log('[INFO] Marketler yükleniyor...');

        const [marketsRes, trackedRes] = await Promise.all([
            api.getExchangeMarkets(),
            api.getTrackedSymbols(),
        ]);

        console.log('[DEBUG] Markets response:', marketsRes);
        console.log('[DEBUG] Tracked response:', trackedRes);

        // Response yapısını düzelt
        const markets = marketsRes.markets || marketsRes.data || marketsRes || [];
        const tracked = trackedRes.symbols || trackedRes.data || trackedRes || [];

        console.log(`[INFO] ${markets.length} market yüklendi, ${tracked.length} sembol izleniyor`);

        store.setState('markets', {
            all: markets,
            tracked: tracked,
        });

        renderMarketList();
    } catch (error) {
        console.error('❌ Market yükleme hatası:', error);
        console.error('Stack trace:', error.stack);
    }
}

async function loadDashboardMetrics() {
    try {
        console.log('[INFO] Dashboard metrikleri yükleniyor...');

        const metrics = await api.getDashboardMetrics();

        console.log('[DEBUG] Metrics response:', metrics);

        // Portfolio bilgisi varsa exchange ve borsa bilgisini güncelle
        if (metrics && metrics.portfolio) {
            // Borsa bilgisini güncelle
            const exchangeEl = document.getElementById('exchange-val');
            if (exchangeEl) {
                exchangeEl.textContent = 'BINANCE';
                console.log('[INFO] Borsa bilgisi güncellendi: BINANCE');
            }
        }

        store.batchUpdate([
            actions.setDashboardMetrics(metrics),
            actions.setLatestDecisions(metrics?.latest_decisions || {}),
            actions.setPortfolio(metrics?.portfolio || {}),
        ]);

        renderDashboard(metrics);
    } catch (error) {
        console.error('❌ Dashboard metrics error:', error);
        console.error('Stack trace:', error.stack);
    }
}

async function loadStrategies() {
    try {
        console.log('[DEBUG] loadStrategies - API çağrısı yapılıyor...');

        const data = await api.getStrategies();

        console.log('[DEBUG] loadStrategies - API response:', data);

        // Backend response format: {status: 'success', strategies: [...]}
        const strategies = data.strategies || data.data || [];

        console.log(`[INFO] ${strategies.length} strateji yüklendi`);

        store.setState('strategies', { list: strategies });
        renderStrategyLibrary(strategies);
    } catch (error) {
        console.error('❌ Strateji yükleme hatası:', error);
        console.error('Stack trace:', error.stack);
    }
}

async function loadTradeHistory() {
    try {
        const data = await api.getTradeHistory();
        store.setState('trades', { history: data.trades || [] });
        renderTradeHistory(data.trades || []);
    } catch (error) {
        console.error('Trade history error:', error);
    }
}

async function loadMLSymbols() {
    try {
        const data = await api.getSymbolsWithData();
        populateMLSymbolSelect(data.symbols || []);
    } catch (error) {
        console.error('ML symbols error:', error);
    }
}

async function loadMLTrainingHistory() {
    try {
        const data = await api.getMLTrainingHistory(50);
        store.setState('ml', { history: data.history || [] });
    } catch (error) {
        console.error('ML history error:', error);
    }
}

async function loadDataSymbols() {
    try {
        console.log('[DEBUG] loadDataSymbols - API çağrısı yapılıyor...');

        const data = await api.getSymbolsWithData();

        console.log('[DEBUG] loadDataSymbols - API response:', data);

        // Backend response format: {status: 'success', symbols: [...]}
        const symbols = data.symbols || data.data || [];

        console.log(`[INFO] ${symbols.length} sembol yüklendi`);

        store.setState('dataSymbols', symbols);

        // Not: Dropdown güncelleme loadDropdownData tarafından yapılıyor
        // populateBotFormDropdowns(symbols); // ❌ Kaldırıldı (çakışma önleme)
        
    } catch (error) {
        console.error('❌ Data symbols error:', error);
        console.error('Stack trace:', error.stack);
        store.setState('dataSymbols', []);
    }
}

/**
 * Dropdown'lara veri yükle (Sembol + Strateji)
 */
async function loadDropdownData() {
    try {
        console.log('[INFO] 🔄 Dropdown verileri yükleniyor...');

        // Sembol listesini çek
        const symbolsData = await api.getDataSymbols();
        const symbols = symbolsData.symbols || symbolsData.data || [];

        console.log(`[INFO] ✅ ${symbols.length} sembol bulundu`);

        // Sembol dropdown'ı doldur
        const symbolSelect = document.getElementById('bot-symbol');
        if (symbolSelect) {
            // ÖNCE TEMİZLE (çakışma önleme)
            symbolSelect.innerHTML = '';

            if (symbols && symbols.length > 0) {
                // İlk option: Default seçim
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = 'Sembol seçin';
                symbolSelect.appendChild(defaultOption);

                // Sembolleri ekle
                symbols.forEach(symbol => {
                    const option = document.createElement('option');
                    option.value = symbol.symbol || symbol;
                    option.textContent = symbol.symbol || symbol;
                    symbolSelect.appendChild(option);
                });
                console.log(`[INFO] ✅ Sembol dropdown'a ${symbols.length} sembol eklendi`);
            } else {
                // Veri yoksa uyarı göster
                const warningOption = document.createElement('option');
                warningOption.value = '';
                warningOption.textContent = '⚠️ Veri Laboratuvarından veri indirin';
                symbolSelect.appendChild(warningOption);
                console.warn('⚠️ Veritabanında veri yok');
            }
        }

        // Strateji listesini çek
        const strategiesData = await api.getStrategies();
        const strategies = strategiesData.strategies || strategiesData.data || [];

        console.log(`[INFO] ✅ ${strategies.length} strateji bulundu`);

        // Strateji dropdown'ı doldur
        const strategySelect = document.getElementById('bot-strategy');
        if (strategySelect) {
            // ÖNCE TEMİZLE (çakışma önleme)
            strategySelect.innerHTML = '';

            if (strategies && strategies.length > 0) {
                // İlk option: Default seçim
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = 'Strateji seçin';
                strategySelect.appendChild(defaultOption);

                // Stratejileri ekle
                strategies.forEach(strategy => {
                    const option = document.createElement('option');
                    option.value = strategy.id || strategy.strategy_id;
                    option.textContent = strategy.name || strategy.strategy_name;
                    strategySelect.appendChild(option);
                });
                console.log(`[INFO] ✅ Strateji dropdown'a ${strategies.length} strateji eklendi`);
            } else {
                // Strateji yoksa uyarı göster
                const warningOption = document.createElement('option');
                warningOption.value = '';
                warningOption.textContent = '⚠️ Strateji bulunamadı';
                strategySelect.appendChild(warningOption);
                console.warn('⚠️ Strateji yok');
            }
        }

        console.log('[INFO] ✅ Dropdown verileri yüklendi');
    } catch (error) {
        console.error('❌ loadDropdownData hatası:', error);
        console.error('Stack trace:', error.stack);

        // Hata durumunda default mesajlar
        const symbolSelect = document.getElementById('bot-symbol');
        if (symbolSelect) {
            symbolSelect.innerHTML = '<option value="">❌ Yüklenemedi</option>';
        }

        const strategySelect = document.getElementById('bot-strategy');
        if (strategySelect) {
            strategySelect.innerHTML = '<option value="">❌ Yüklenemedi</option>';
        }
    }
}

/**
 * Sistem Ayarları sekmesindeki sembol dropdown'ını doldur
 */
function populateSettingsSymbolDropdown(symbols) {
    try {
        const settingsSymbolSelect = document.getElementById('settings-symbol');
        if (settingsSymbolSelect) {
            if (symbols && symbols.length > 0) {
                settingsSymbolSelect.innerHTML = '<option value="">Sembol seçin</option>';
                symbols.forEach(symbol => {
                    const option = document.createElement('option');
                    option.value = symbol.symbol || symbol;
                    option.textContent = symbol.symbol || symbol;
                    settingsSymbolSelect.appendChild(option);
                });
                console.log(`[INFO] Settings dropdown'a ${symbols.length} sembol eklendi`);
            } else {
                settingsSymbolSelect.innerHTML = '<option value="">⚠️ Veri Laboratuvarından veri indirin</option>';
                console.warn('⚠️ Veritabanında veri yok');
            }
        }
    } catch (error) {
        console.error('❌ populateSettingsSymbolDropdown hatası:', error);
    }
}

/**
 * Risk Ayarlarını Kaydet
 */
async function saveRiskSettings() {
    try {
        const maxRisk = parseFloat(document.getElementById('risk-max-risk').value);
        const maxLeverage = parseInt(document.getElementById('risk-max-leverage').value);
        const maxPositions = parseInt(document.getElementById('risk-max-positions').value);
        const maxLosses = parseInt(document.getElementById('risk-max-losses').value);

        // Frontend validasyonu
        if (maxRisk < 0.1 || maxRisk > 5.0) {
            showToast('⚠️ Maksimum risk %0.1 ile %5.0 arasında olmalı', 'error');
            document.getElementById('risk-max-risk').focus();
            return;
        }

        if (maxLeverage < 1 || maxLeverage > 50) {
            showToast('⚠️ Maksimum kaldıraç 1x ile 50x arasında olmalı', 'error');
            document.getElementById('risk-max-leverage').focus();
            return;
        }

        if (maxPositions < 1 || maxPositions > 20) {
            showToast('⚠️ Maksimum pozisyon 1 ile 20 arasında olmalı', 'error');
            document.getElementById('risk-max-positions').focus();
            return;
        }

        if (maxLosses < 1 || maxLosses > 10) {
            showToast('⚠️ Maksimum ardışık kayıp 1 ile 10 arasında olmalı', 'error');
            document.getElementById('risk-max-losses').focus();
            return;
        }

        showToast('📊 Risk ayarları kaydediliyor...', 'info');

        // Backend API çağrısı (JSON body)
        const response = await fetch('/api/v1/config/risk', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                max_risk_per_trade_percent: maxRisk,
                max_leverage: maxLeverage,
                max_open_positions: maxPositions,
                max_consecutive_losses: maxLosses
            })
        });

        const result = await response.json();

        // 422 Validation Error kontrolü (Pydantic)
        if (response.status === 422) {
            console.error('❌ 422 Validation Error:', result);
            console.error('❌ Error details:', result.detail);
            if (result.detail && Array.isArray(result.detail)) {
                const errors = result.detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join(', ');
                showToast('❌ Validasyon hatası: ' + errors, 'error');
            } else {
                showToast('❌ 422 Validasyon hatası: ' + JSON.stringify(result.detail), 'error');
            }
            return;
        }

        if (result.status === 'success') {
            showToast('✅ ' + result.message, 'success');
            console.log('[INFO] Risk ayarları güncellendi:', result.data);
        } else {
            showToast('❌ ' + result.message, 'error');
        }
    } catch (error) {
        console.error('❌ saveRiskSettings hatası:', error);
        showToast('❌ Risk ayarları kaydedilemedi: ' + error.message, 'error');
    }
}

/**
 * Risk Ayarlarını Yükle (Sayfa açılışında)
 */
async function loadRiskSettings() {
    try {
        const response = await fetch('/api/v1/config/risk');
        const result = await response.json();

        if (result.status === 'success' && result.data) {
            // Form değerlerini ayarla
            document.getElementById('risk-max-risk').value = result.data.max_risk_per_trade_percent || 0.2;
            document.getElementById('risk-max-leverage').value = result.data.max_leverage || 10;
            document.getElementById('risk-max-positions').value = result.data.max_open_positions || 5;
            document.getElementById('risk-max-losses').value = result.data.max_consecutive_losses || 5;

            console.log('[INFO] Risk ayarları yüklendi:', result.data);
        }
    } catch (error) {
        console.error('❌ loadRiskSettings hatası:', error);
    }
}

/**
 * Gelişmiş Ayarları Kaydet (WFO, ML, HTF)
 */
async function saveAdvancedSettings() {
    try {
        // Form değerlerini al
        const wfoData = {
            enabled: document.getElementById('wfo-enabled').checked,
            train_days: parseInt(document.getElementById('wfo-train-days').value),
            test_days: parseInt(document.getElementById('wfo-test-days').value),
            reoptimize_interval: parseInt(document.getElementById('wfo-interval').value)
        };

        const mlData = {
            enabled: document.getElementById('ml-enabled').checked,
            confidence_threshold: parseFloat(document.getElementById('ml-threshold').value)
        };

        const htfData = {
            enabled: document.getElementById('htf-enabled').checked,
            trend_method: document.getElementById('htf-method').value
        };

        // Frontend validasyonu
        if (wfoData.train_days < 7 || wfoData.train_days > 90) {
            showToast('⚠️ WFO Eğitim günleri 7-90 arasında olmalı', 'error');
            return;
        }

        if (wfoData.test_days < 1 || wfoData.test_days > 30) {
            showToast('⚠️ WFO Test günleri 1-30 arasında olmalı', 'error');
            return;
        }

        if (mlData.confidence_threshold < 0.50 || mlData.confidence_threshold > 0.95) {
            showToast('⚠️ ML Confidence threshold 0.50-0.95 arasında olmalı', 'error');
            return;
        }

        showToast('🔧 Gelişmiş ayarlar kaydediliyor...', 'info');

        // Backend API çağrısı (JSON body)
        const response = await fetch('/api/v1/config/advanced', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                wfo: wfoData,
                ml: mlData,
                htf: htfData
            })
        });

        const result = await response.json();

        if (result.status === 'success') {
            showToast('✅ ' + result.message, 'success');
            console.log('[INFO] Gelişmiş ayarlar güncellendi:', result.data);
        } else {
            showToast('❌ ' + result.message, 'error');
        }
    } catch (error) {
        console.error('❌ saveAdvancedSettings hatası:', error);
        showToast('❌ Gelişmiş ayarlar kaydedilemedi: ' + error.message, 'error');
    }
}

/**
 * Gelişmiş Ayarları Yükle (Sayfa açılışında)
 */
async function loadAdvancedSettings() {
    try {
        const response = await fetch('/api/v1/config/advanced');
        const result = await response.json();

        if (result.status === 'success' && result.data) {
            const {wfo, ml, htf} = result.data;

            // WFO ayarları
            if (wfo) {
                document.getElementById('wfo-enabled').checked = wfo.enabled !== false;
                document.getElementById('wfo-train-days').value = wfo.train_days || 30;
                document.getElementById('wfo-test-days').value = wfo.test_days || 7;
                document.getElementById('wfo-interval').value = wfo.reoptimize_interval || 168;
            }

            // ML ayarları
            if (ml) {
                document.getElementById('ml-enabled').checked = ml.enabled !== false;
                document.getElementById('ml-threshold').value = ml.confidence_threshold || 0.65;
            }

            // HTF ayarları
            if (htf) {
                document.getElementById('htf-enabled').checked = htf.enabled !== false;
                document.getElementById('htf-method').value = htf.trend_method || 'ema_stack';
            }

            console.log('[INFO] Gelişmiş ayarlar yüklendi:', result.data);
        }
    } catch (error) {
        console.error('❌ loadAdvancedSettings hatası:', error);
    }
}

/**
 * API Anahtarlarını Test Et
 */
async function testApiKeys() {
    try {
        const apiKey = document.getElementById('api-key').value.trim();
        const apiSecret = document.getElementById('api-secret').value.trim();

        if (!apiKey || !apiSecret) {
            showToast('⚠️ Lütfen API Key ve Secret girin', 'warning');
            return;
        }

        showToast('🧪 API anahtarları test ediliyor...', 'info');

        // Backend API çağrısı (JSON body)
        const response = await fetch('/api/v1/config/test-api-keys', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({api_key: apiKey, api_secret: apiSecret})
        });

        const result = await response.json();

        // 422 Validation Error kontrolü
        if (response.status === 422) {
            console.error('❌ 422 Validation Error:', result);
            console.error('❌ Error details:', result.detail);
            if (result.detail && Array.isArray(result.detail)) {
                const errors = result.detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join(', ');
                showToast('❌ Validasyon hatası: ' + errors, 'error');
            } else {
                showToast('❌ 422 Validasyon hatası: ' + JSON.stringify(result.detail), 'error');
            }
            return;
        }

        if (result.valid) {
            showToast('✅ ' + result.message, 'success');
            console.log('[INFO] API Key test edildi:', apiKey.substring(0, 8) + '...');
        } else {
            showToast('❌ ' + result.message, 'error');
        }
    } catch (error) {
        console.error('❌ testApiKeys hatası:', error);
        showToast('❌ API testi başarısız: ' + error.message, 'error');
    }
}

/**
 * API Anahtarlarını Kaydet
 */
async function saveApiKeys() {
    try {
        const apiKey = document.getElementById('api-key').value.trim();
        const apiSecret = document.getElementById('api-secret').value.trim();

        if (!apiKey || !apiSecret) {
            showToast('⚠️ Lütfen API Key ve Secret girin', 'warning');
            return;
        }

        if (apiKey.length < 10 || apiSecret.length < 10) {
            showToast('⚠️ API Key/Secret çok kısa (min 10 karakter)', 'warning');
            return;
        }

        showToast('🔐 API anahtarları şifreleniyor...', 'info');

        // Backend API çağrısı (JSON body)
        const response = await fetch('/api/v1/config/api-keys', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({api_key: apiKey, api_secret: apiSecret})
        });

        const result = await response.json();

        // 422 Validation Error kontrolü
        if (response.status === 422) {
            console.error('❌ 422 Validation Error:', result);
            console.error('❌ Error details:', result.detail);
            if (result.detail && Array.isArray(result.detail)) {
                const errors = result.detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join(', ');
                showToast('❌ Validasyon hatası: ' + errors, 'error');
            } else {
                showToast('❌ 422 Validasyon hatası: ' + JSON.stringify(result.detail), 'error');
            }
            return;
        }

        if (result.status === 'success') {
            showToast('✅ ' + result.message, 'success');
            console.log('[INFO] API Key kaydedildi:', apiKey.substring(0, 8) + '...');

            // Inputları temizle (güvenlik)
            document.getElementById('api-key').value = '';
            document.getElementById('api-secret').value = '';
        } else {
            showToast('❌ ' + result.message, 'error');
        }
    } catch (error) {
        console.error('❌ saveApiKeys hatası:', error);
        showToast('❌ API anahtarları kaydedilemedi: ' + error.message, 'error');
    }
}

async function loadDataStats() {
    try {
        console.log('[INFO] Veritabanı envanteri ve istatistikleri yükleniyor...');

        // Envanter verisini çek (market type bilgisi var)
        const data = await api.getDataInventory();

        console.log('[DEBUG] Inventory response:', data);

        // Backend response format: {status: 'success', total_candles: N, inventory: [...]}
        const totalCandles = data.total_candles || 0;
        const inventory = data.inventory || [];

        // Özet bilgi - En üste
        const statsSummaryEl = document.getElementById('data-stats-summary');
        if (statsSummaryEl) {
            const millions = (totalCandles / 1000000).toFixed(2);
            const thousands = (totalCandles / 1000).toFixed(0);
            
            // Büyük sayılar için farklı gösterim
            let totalDisplay;
            if (totalCandles >= 1000000) {
                totalDisplay = `<span style="font-size:1.3rem; font-weight:700; color:var(--neon-blue);">📊 Toplam: ${millions} Milyon</span>`;
            } else if (totalCandles >= 1000) {
                totalDisplay = `<span style="font-size:1.3rem; font-weight:700; color:var(--neon-blue);">📊 Toplam: ${thousands} Bin</span>`;
            } else {
                totalDisplay = `<span style="font-size:1.3rem; font-weight:700; color:var(--neon-blue);">📊 Toplam: ${totalCandles.toLocaleString('tr-TR')}</span>`;
            }
            
            statsSummaryEl.innerHTML = `
                ${totalDisplay}
                <div style="display:flex; gap:20px; margin-top:8px;">
                    <span style="font-size:0.85rem; color:var(--text-muted);">
                        📦 ${inventory.length} farklı sembol/timeframe kombinasyonu
                    </span>
                </div>
            `;
        }

        // Verileri grupla (sembol + market type bazında)
        const grouped = {};
        
        inventory.forEach(item => {
            // Sembol adını ve market type'ı çıkar
            let symbolName = item.symbol;
            let marketType = 'spot'; // Varsayılan
            
            if (item.symbol.includes('_future') || item.symbol.includes(':USDT')) {
                marketType = 'future';
                symbolName = item.symbol.replace('_future', '').replace(':USDT', '');
            } else if (item.symbol.includes('_spot')) {
                marketType = 'spot';
                symbolName = item.symbol.replace('_spot', '');
            }
            
            const key = `${symbolName}_${marketType}`;
            if (!grouped[key]) {
                grouped[key] = {
                    symbol: symbolName,
                    marketType: marketType,
                    timeframes: [],
                    totalCandles: 0,
                    minDate: item.min_date,
                    maxDate: item.max_date,
                    minTimestamp: item.min_timestamp,
                    maxTimestamp: item.max_timestamp
                };
            }
            
            grouped[key].timeframes.push({
                tf: item.timeframe,
                count: item.count
            });
            grouped[key].totalCandles += item.count;
        });

        // Tablo oluştur
        const statsTableEl = document.getElementById('data-stats-table');
        if (statsTableEl && Object.keys(grouped).length > 0) {
            // Grupları sırala (toplam mum sayısına göre)
            const sorted = Object.values(grouped).sort((a, b) => b.totalCandles - a.totalCandles);
            
            const rows = sorted.map(group => {
                const countFormatted = group.totalCandles.toLocaleString('tr-TR');
                // Büyük sayılar için K/M/B kısaltması
                let countShort = countFormatted;
                let countColor = 'var(--neon-green)';
                if (group.totalCandles >= 1000000) {
                    countShort = `${(group.totalCandles / 1000000).toFixed(2)}M`;
                    countColor = '#00ff88'; // Parlak yeşil
                } else if (group.totalCandles >= 100000) {
                    countShort = `${(group.totalCandles / 1000).toFixed(0)}K`;
                    countColor = 'var(--neon-green)';
                }
                
                // Market type badge
                const marketTypeDisplay = group.marketType === 'future' ? '💹 Vadeli' : '💰 Spot';
                const badgeBg = group.marketType === 'future' ? 'rgba(88, 166, 255, 0.2)' : 'rgba(46, 220, 135, 0.2)';
                const badgeColor = group.marketType === 'future' ? 'var(--neon-blue)' : 'var(--neon-green)';
                
                // Timeframe özeti
                const tfSummary = group.timeframes.map(tf => tf.tf).join(', ');
                
                // Tarih formatlaması - daha belirgin
                const startDate = group.minDate !== 'N/A' ? group.minDate : '—';
                const endDate = group.maxDate !== 'N/A' ? group.maxDate : '—';
                
                return `
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.05); transition: background 0.2s;"
                        onmouseover="this.style.background='rgba(255,255,255,0.03)'" 
                        onmouseout="this.style.background='transparent'">
                        <td style="padding:12px 10px;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span style="font-weight:700; font-size:0.95rem; color:var(--text-main);">${group.symbol}</span>
                                <span style="font-size:0.7rem; padding:2px 8px; border-radius:4px; 
                                            background:${badgeBg}; color:${badgeColor}; font-weight:600;">
                                    ${marketTypeDisplay}
                                </span>
                            </div>
                            <div style="font-size:0.7rem; color:var(--text-muted); margin-top:4px;">
                                ⏱️ ${tfSummary}
                            </div>
                        </td>
                        <td style="padding:12px 10px;">
                            <span style="font-size:0.85rem; color:#ffa500; font-weight:600;">📅 ${startDate}</span>
                        </td>
                        <td style="padding:12px 10px;">
                            <span style="font-size:0.85rem; color:#ff6b6b; font-weight:600;">📅 ${endDate}</span>
                        </td>
                        <td style="padding:12px 10px; text-align:right;">
                            <span style="font-size:1rem; font-weight:700; color:${countColor};">${countShort}</span>
                            <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">
                                ${countFormatted} mum
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
            
            statsTableEl.innerHTML = `
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
                        ${rows}
                    </tbody>
                </table>
            `;
        } else if (statsTableEl) {
            statsTableEl.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px; font-size:0.9rem;">📭 Veritabanında henüz veri yok</p>';
        }

        console.log(`[INFO] Envanter yüklendi: ${totalCandles.toLocaleString()} mum, ${Object.keys(grouped).length} sembol`);
    } catch (error) {
        console.error('❌ Envanter yükleme hatası:', error);
        console.error('Stack trace:', error.stack);
        const statsTableEl = document.getElementById('data-stats-table');
        if (statsTableEl) {
            statsTableEl.innerHTML = '<p style="text-align:center; color:var(--danger-text);">❌ Envanter yüklenemedi: ' + error.message + '</p>';
        }
    }
}

function loadBotFormOptions() {
    // Load data symbols (for bot form dropdown)
    loadDataSymbols();

    // Load strategies
    loadStrategies();

    // Load dropdown data (Sembol + Strateji) - YENİ FONKSİYON
    loadDropdownData();
}

// ============================================================================
// RENDERING
// ============================================================================

function renderMarketList() {
    try {
        const state = store.getState();
        const container = document.getElementById('market-selection-list');
        const searchInput = document.getElementById('market-search');
        const filterSelect = document.getElementById('market-type-filter');

        console.log('[DEBUG] renderMarketList - state.markets.all:', state.markets.all?.length);

        if (!container) {
            console.error('❌ market-selection-list elementi bulunamadı!');
            return;
        }

        const searchTerm = searchInput?.value.toLowerCase() || '';
        const typeFilter = filterSelect?.value || 'all';

        const filtered = (state.markets.all || []).filter(m => {
            const matchesSearch = m.symbol?.toLowerCase().includes(searchTerm);
            const matchesType = typeFilter === 'all' || m.type === typeFilter;
            return matchesSearch && matchesType;
        });

        console.log(`[INFO] ${filtered.length} market filtrelendi`);

        if (filtered.length === 0) {
            container.innerHTML = '<p style="grid-column:span 4; text-align:center; padding:20px; color:var(--text-muted);">Eşleşen market bulunamadı.</p>';
            return;
        }

        container.innerHTML = filtered.map(m => {
            const isTracked = (state.markets.tracked || []).includes(m.symbol);
            return `
                <div class="market-item ${isTracked ? 'selected' : ''}"
                     onclick="selectMarket('${m.symbol}', '${m.type}')">
                    <input type="checkbox" ${isTracked ? 'checked' : ''}
                           onchange="event.stopPropagation(); toggleMarketSymbol('${m.symbol}', this.checked)">
                    <div style="flex:1;">
                        <div style="font-weight:bold; font-size:0.9rem;">${m.symbol}</div>
                        <div style="font-size:0.7rem; color:var(--text-muted);">${m.type?.toUpperCase() || 'UNKNOWN'}</div>
                    </div>
                </div>
            `;
        }).join('');

        // Setup search listener once
        if (searchInput && !searchInput.hasListener) {
            searchInput.addEventListener('input', renderMarketList);
            searchInput.hasListener = true;
        }
    } catch (error) {
        console.error('❌ renderMarketList hatası:', error);
        console.error('Stack trace:', error.stack);
    }
}

function renderDashboard(metrics) {
    try {
        console.log('[DEBUG] renderDashboard - metrics:', metrics);

        if (!metrics) {
            console.warn('⚠️ Metrics verisi boş');
            return;
        }

        // Update portfolio cards
        updatePortfolioCards(metrics.portfolio);

        // Update decision grid
        updateDecisionGrid(metrics.latest_decisions);

        // Update positions table
        updatePositionsTable(metrics.positions);
    } catch (error) {
        console.error('❌ renderDashboard hatası:', error);
        console.error('Stack trace:', error.stack);
    }
}

function updatePortfolioCards(portfolio) {
    try {
        console.log('[DEBUG] updatePortfolioCards - portfolio:', portfolio);

        if (!portfolio) {
            console.warn('⚠️ Portfolio verisi boş');
            return;
        }

        const elements = {
            'balance-val': portfolio.balance,
            'free-margin-val': portfolio.free_margin,
            'used-margin-val': portfolio.used_margin,
            'total-pnl-val': portfolio.total_pnl,
        };

        Object.entries(elements).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) {
                if (value !== undefined && value !== null) {
                    el.textContent = `$${value.toFixed(2)}`;
                    el.classList.toggle('success-text', value >= 0);
                    el.classList.toggle('danger-text', value < 0);
                    console.log(`[INFO] ${id} güncellendi: $${value.toFixed(2)}`);
                } else {
                    console.warn(`⚠️ ${id} için değer yok`);
                }
            } else {
                console.error(`❌ Element bulunamadı: ${id}`);
            }
        });
    } catch (error) {
        console.error('❌ updatePortfolioCards hatası:', error);
        console.error('Stack trace:', error.stack);
    }
}

function updateDecisionGrid(decisions) {
    try {
        const container = document.getElementById('decision-grid');
        if (!container) {
            console.error('❌ decision-grid elementi bulunamadı!');
            return;
        }

        if (!decisions || Object.keys(decisions).length === 0) {
            container.innerHTML = '<p style="grid-column:span 4; text-align:center; padding:20px;">Henüz karar yok</p>';
            return;
        }

        container.innerHTML = Object.entries(decisions).map(([symbol, dec]) => {
            const signalColors = { 2: '#2ea043', 0: '#f85149', 1: '#8b949e' };
            const signalTexts = { 2: '🟢 AL', 0: '🔴 SAT', 1: '⚪ BEKLE' };

            return `
                <div class="decision-card-multi">
                    <div class="decision-header">
                        <strong>${symbol}</strong>
                        <span style="color: ${signalColors[dec.signal_val] || '#8b949e'}">
                            ${signalTexts[dec.signal_val] || '⚪ BEKLE'}
                        </span>
                    </div>
                    <div class="decision-body">
                        <div>🤖 ${dec.bot_name || 'Unknown'}</div>
                        <div>📊 RSI: ${dec.rsi || 0}</div>
                        <div>📈 ML: ${dec.ml_recommendation || 'HOLD'} (${dec.ml_confidence || 0}%)</div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('❌ updateDecisionGrid hatası:', error);
        console.error('Stack trace:', error.stack);
    }
}

function updatePositionsTable(positions) {
    try {
        const tbody = document.getElementById('positions-body');
        if (!tbody) {
            console.error('❌ positions-body elementi bulunamadı!');
            return;
        }

        if (!positions || positions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;">Açık pozisyon yok</td></tr>';
            return;
        }

        tbody.innerHTML = positions.map(pos => `
            <tr>
                <td>${pos.symbol || 'Unknown'}</td>
                <td><span class="badge ${pos.direction === 'LONG' ? 'success' : 'danger'}">${pos.direction || 'UNKNOWN'}</span></td>
                <td>$${(pos.entry_price || 0).toFixed(2)}</td>
                <td>$${(pos.current_price || 0).toFixed(2)}</td>
                <td class="${(pos.unrealized_usd || 0) >= 0 ? 'success-text' : 'danger-text'}">
                    $${(pos.unrealized_usd || 0).toFixed(2)}
                </td>
                <td>${pos.leverage || 1}x</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="closePosition('${pos.symbol || ''}')">
                        Kapat
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('❌ updatePositionsTable hatası:', error);
        console.error('Stack trace:', error.stack);
    }
}

function renderStrategyLibrary(strategies) {
    try {
        const container = document.getElementById('strategy-library-container');
        if (!container) {
            console.error('❌ strategy-library-container elementi bulunamadı!');
            return;
        }

        console.log('[DEBUG] renderStrategyLibrary - strategies:', strategies?.length);

        if (!strategies || strategies.length === 0) {
            container.innerHTML = '<p style="text-align:center; padding:20px; color:var(--text-muted);">📭 Strateji bulunamadı</p>';
            return;
        }

        container.innerHTML = strategies.map(s => {
            if (!s) return '';
            return `
                <div class="strategy-card">
                    <h4>${s.name || 'Bilinmeyen'}</h4>
                    <p>${s.description || ''}</p>
                    <div class="strategy-type">${s.type === 'builtin' ? '📦 Built-in' : '🔧 Custom'}</div>
                </div>
            `;
        }).filter(Boolean).join('');
    } catch (error) {
        console.error('❌ renderStrategyLibrary hatası:', error);
        console.error('Stack trace:', error.stack);
    }
}

function renderTradeHistory(trades) {
    try {
        const tbody = document.getElementById('history-body');
        if (!tbody) {
            console.error('❌ history-body elementi bulunamadı!');
            return;
        }

        if (!trades || trades.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;">İşlem geçmişi yok</td></tr>';
            return;
        }

        tbody.innerHTML = trades.slice(0, 50).map(trade => `
            <tr>
                <td>${new Date(trade.closed_at).toLocaleDateString()}</td>
                <td>${trade.symbol || 'Unknown'}</td>
                <td><span class="badge ${trade.direction === 'LONG' ? 'success' : 'danger'}">${trade.direction || 'UNKNOWN'}</span></td>
                <td class="${(trade.pnl_usd || 0) >= 0 ? 'success-text' : 'danger-text'}">$${(trade.pnl_usd || 0).toFixed(2)}</td>
                <td>${(trade.pnl_percent || 0).toFixed(2)}%</td>
                <td>${trade.reason || 'Manual'}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('❌ renderTradeHistory hatası:', error);
        console.error('Stack trace:', error.stack);
    }
}

// ============================================================================
// AUTO REFRESH
// ============================================================================

function startAutoRefresh() {
    // Dashboard metrics - every 3 seconds
    refreshIntervals.dashboard = setInterval(loadDashboardMetrics, 3000);

    // Bots - every 5 seconds
    refreshIntervals.bots = setInterval(() => botManager.loadBots(), 5000);

    // Active downloads - every 2 seconds
    refreshIntervals.data = setInterval(updateActiveTasks, 2000);

    // Data symbols (for dropdown) - every 5 seconds
    // YORUMA ALINDI: Veri Laboratuvarı sayfasında sembol seçimi otomatik yenilenmesin
    // refreshIntervals.dataSymbols = setInterval(loadDataSymbols, 5000);

    console.log('[INFO] Auto-refresh başlatıldı');
}

function stopAutoRefresh() {
    Object.values(refreshIntervals).forEach(interval => {
        if (interval) clearInterval(interval);
    });
    console.log('[INFO] Auto-refresh durduruldu');
}

async function updateActiveTasks() {
    try {
        console.log('[DEBUG] updateActiveTasks - API çağrısı yapılıyor...');

        // Tüm indirmeleri çek (aktif + tamamlanan)
        // getAllDownloadTasks endpoint'i kullanılıyor
        const data = await api.getAllDownloadTasks();

        console.log('[DEBUG] updateActiveTasks - API response:', data);

        // Backend response format: {status: 'success', downloads: {...}, active_count: N, total_count: N}
        const downloads = data.downloads || data.data || {};
        const activeCount = data.active_count || Object.keys(downloads).length;
        const totalCount = data.total_count || activeCount;

        store.setState('downloads', { active: downloads, total: totalCount });

        const list = document.getElementById('active-tasks-list');
        const countDisplay = document.getElementById('active-tasks-count');

        if (list && countDisplay) {
            // Object.keys ile downloads'ı iterate et
            const symbols = Object.keys(downloads);

            console.log(`[INFO] ${symbols.length} aktif/tamamlanmış indirme bulundu`);
            countDisplay.textContent = `${activeCount} Aktif / ${totalCount} Toplam Görev`;

            if (symbols.length === 0) {
                list.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px;">📭 Aktif veya tamamlanmış indirme yok</p>';
            } else {
                // Object.entries ile hem key hem value al
                list.innerHTML = Object.entries(downloads).map(([symbolKey, task]) => {
                    const progress = task.progress || 100; // Tamamlananlar için %100
                    const status = task.status || 'completed';
                    const statusClass = status === 'running' ? 'status-running' :
                                       status === 'completed' ? 'status-completed' :
                                       status === 'paused' ? 'status-paused' : 'status-stopped';

                    // Sembol ve market type'ı ayır
                    let symbolName = symbolKey;
                    let marketType = task.market_type || 'future';
                    
                    // symbol_key formatından temizle (BTC/USDT_future → BTC/USDT + future)
                    if (symbolKey.includes('_future') || symbolKey.includes('_spot')) {
                        const parts = symbolKey.split('_');
                        marketType = parts[parts.length - 1]; // future veya spot
                        symbolName = parts.slice(0, -1).join('_'); // Geri kalan sembol
                    }
                    
                    // Market type'ı okunabilir yap
                    const marketTypeDisplay = marketType === 'future' ? '💹 Vadeli' : 
                                             marketType === 'spot' ? '💰 Spot' : marketType;
                    
                    // Status'u Türkçeleştir ve emoji ekle
                    const statusDisplay = status === 'running' ? '🔄 İndiriliyor' :
                                         status === 'completed' ? '✅ Tamamlandı' :
                                         status === 'paused' ? '⏸️ Duraklatıldı' : '⏹️ Durduruldu';

                    // Başlangıç tarihini hesapla
                    let startDate = task.start_date || '...';
                    let lastCandleDate = 'Hesaplanıyor...';
                    
                    if (task.target_start_ms && !startDate) {
                        startDate = new Date(task.target_start_ms).toLocaleDateString('tr-TR');
                    }
                    
                    // SON MUM TARİHİNİ HESAPLA
                    if (task.current_ts) {
                        lastCandleDate = new Date(task.current_ts).toLocaleString('tr-TR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                    } else if (task.progress >= 100 || status === 'completed') {
                        lastCandleDate = '✅ Tamamlandı';
                    }

                    // İlerleme durumu
                    const progressText = status === 'running' ? `%${Math.round(progress)} tamamlandı` : 'Tamamlandı';
                    const progressColor = status === 'running' ? 'var(--neon-blue)' :
                                         status === 'completed' ? 'var(--neon-green)' :
                                         status === 'paused' ? 'var(--neon-yellow)' : 'var(--neon-red)';
                    
                    // Silme butonu - sadece completed/stopped/paused için
                    let showDeleteButton = status !== 'running';
                    
                    // ÖZEL: Geçersiz sembolleri her zaman silinebilir göster
                    const isInvalidSymbol = symbolKey.includes('-- SEÇİNİZ --') || 
                                           symbolKey.includes('SEÇİNİZ') ||
                                           symbolKey === '_future' ||
                                           symbolKey === '_spot';
                    if (isInvalidSymbol) {
                        showDeleteButton = true; // Her zaman silinebilir
                        console.warn(`⚠️ Geçersiz sembol tespit edildi: ${symbolKey}`);
                    }
                    
                    // task.market_type yoksa, symbol'den çıkar (BTC/USDT:USDT_future gibi)
                    if (!task.market_type) {
                        // symbol_market_type formatından çıkar
                        const parts = symbolKey.split('_');
                        marketType = parts.length > 1 ? parts[parts.length - 1] : 'future';
                    }
                    const deleteButton = showDeleteButton ? `
                        <button onclick="deleteDownloadTask('${symbolKey}', '${marketType}')" 
                                style="background:rgba(255,25,25,0.2); color:#ff4d4d; border:1px solid #ff4d4d33; 
                                       padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.65rem;"
                                title="Görevi sil">
                            🗑️ Sil
                        </button>
                    ` : '';

                    return `
                        <div class="task-item" style="padding:12px; margin:8px 0; background:rgba(255,255,255,0.02); border-radius:8px; border-left:3px solid ${progressColor};">
                            <div style="display:grid; grid-template-columns: 1fr auto; gap:10px; align-items:center; margin-bottom:8px;">
                                <div>
                                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                                        <span style="font-weight:700; font-size:0.95rem; color:var(--text-main);">${symbolName}</span>
                                        <span class="task-status ${statusClass}" style="font-size:0.7rem; padding:2px 6px; border-radius:4px;">${marketTypeDisplay}</span>
                                    </div>
                                    <div style="font-size:0.7rem; color:var(--text-muted); display:flex; gap:12px; margin-top:4px;">
                                        <span>📅 Başlangıç: ${startDate}</span>
                                        <span style="color:var(--neon-blue);">→ Son Mum: ${lastCandleDate}</span>
                                    </div>
                                </div>
                                <div style="text-align:right;">
                                    <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:4px;">${statusDisplay}</div>
                                    ${deleteButton}
                                </div>
                            </div>
                            <div class="task-progress" style="margin:8px 0;">
                                <div style="height:6px; background:rgba(255,255,255,0.1); border-radius:3px; overflow:hidden;">
                                    <div class="progress-bar" style="width: ${progress}%; height:100%; background:${progressColor}; transition: width 0.3s;"></div>
                                </div>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--text-muted);">
                                <span>
                                    ${status === 'completed' ? '✅ Tamamlandı' : `📊 İlerleme: %${Math.round(progress)}`}
                                </span>
                                ${status !== 'completed' && task.speed ? `
                                    <span style="font-size:0.7rem; color:var(--neon-blue);">
                                        ⚡ ${Math.round(task.speed)} mum/sn
                                    </span>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }
    } catch (error) {
        console.error('❌ Active tasks update error:', error);
        console.error('Stack trace:', error.stack);
        const list = document.getElementById('active-tasks-list');
        if (list) {
            list.innerHTML = '<p style="text-align:center; color:var(--danger-text);">❌ Görevler yüklenemedi</p>';
        }
    }
}

// ============================================================================
// GLOBAL FUNCTIONS (for HTML onclick)
// ============================================================================

function setupGlobalFunctions() {
    // Make functions available globally for onclick handlers
    window.selectMarket = selectMarket;
    window.toggleMarketSymbol = toggleMarketSymbol;
    window.saveMarketSelection = saveMarketSelection;
    window.startDownload = startDownload;
    window.stopDownload = stopDownload;
    window.deleteDownloadTask = deleteDownloadTask;  // YENİ: Görev silme
    window.closePosition = closePosition;
    window.startMLTraining = startMLTraining;
    window.runMLVisualAnalysis = runMLVisualAnalysis;

    // YENİ: Risk ve API yönetimi
    window.saveRiskSettings = saveRiskSettings;
    window.testApiKeys = testApiKeys;
    window.saveApiKeys = saveApiKeys;

    // YENİ: Gelişmiş ayarlar (WFO, ML, HTF)
    window.saveAdvancedSettings = saveAdvancedSettings;
    window.loadAdvancedSettings = loadAdvancedSettings;

    // Data symbols refresh (for manual refresh button)
    window.loadDataSymbols = loadDataSymbols;
    window.loadDropdownData = loadDropdownData;  // Dropdown'lara veri yükle
    window.handleBotSubmit = handleBotSubmit;  // Bot form submit handler

    // Bot manager functions are already exposed
    window.botManager = botManager;
}

/**
 * Bot form submit handler
 */
async function handleBotSubmit(event) {
    event.preventDefault();

    // Form değerlerini al
    const symbol = document.getElementById('bot-symbol').value;
    const strategy = document.getElementById('bot-strategy').value;
    const timeframe = document.getElementById('bot-timeframe').value;
    const market = document.getElementById('bot-market').value;

    console.log('[INFO] Bot başlatılıyor:', {symbol, strategy, timeframe, market});

    // VALIDASYON: Sembol ve strateji seçilmiş mi?
    if (!symbol || symbol === '') {
        showToast('⚠️ Lütfen geçerli bir sembol seçin', 'error');
        document.getElementById('bot-symbol').focus();
        return;
    }

    if (!strategy || strategy === '') {
        showToast('⚠️ Lütfen geçerli bir strateji seçin', 'error');
        document.getElementById('bot-strategy').focus();
        return;
    }

    // Bot başlat
    try {
        const result = await botManager.startBot({
            symbol: symbol,
            strategy_id: strategy,
            timeframe: timeframe,
            market_type: market
            // margin_type kaldırıldı
        });

        if (result.success) {
            showToast('✅ ' + result.message, 'success');
            // Formu temizle
            document.getElementById('bot-start-form').reset();
            // Bot listesini yenile
            botManager.loadBots();
        } else {
            showToast('❌ ' + result.message, 'error');
        }
    } catch (error) {
        console.error('Bot başlatma hatası:', error);
        showToast('❌ Bot başlatılamadı: ' + error.message, 'error');
    }
}

function selectMarket(symbol, type) {
    const display = document.getElementById('selected-symbol-val');
    if (display) {
        // ÖNLEME: Geçersiz sembolleri engelle
        if (!symbol || symbol === '-- SEÇİNİZ --' || symbol === 'SEÇİNİZ' || symbol.trim() === '') {
            showToast('⚠️ Lütfen geçerli bir sembol seçin', 'warning');
            return;
        }
        
        display.innerText = symbol;
        display.dataset.type = type;
        display.style.color = 'var(--neon-green)';
        checkHistoryStatus();
    }
}

function toggleMarketSymbol(symbol, checked) {
    const state = store.getState();
    const tracked = [...state.markets.tracked];
    
    if (checked) {
        if (!tracked.includes(symbol)) tracked.push(symbol);
    } else {
        const index = tracked.indexOf(symbol);
        if (index > -1) tracked.splice(index, 1);
    }
    
    store.setState('markets', { tracked });
}

async function saveMarketSelection() {
    const state = store.getState();
    try {
        await api.updateTrackedSymbols(state.markets.tracked);
        showToast('✅ Market seçimi kaydedildi', 'success');
        loadStrategies();
        loadDashboardMetrics();
    } catch (error) {
        showToast('❌ Kaydetme hatası: ' + error.message, 'error');
    }
}

async function checkHistoryStatus() {
    const symbol = document.getElementById('selected-symbol-val')?.innerText;
    const timeframe = document.getElementById('download-timeframe')?.value || '1m';

    if (!symbol || symbol === '-- SEÇİNİZ --') {
        const view = document.getElementById('history-status-view');
        if (view) {
            view.innerHTML = '<p>⚠️ Lütfen bir sembol seçin</p>';
        }
        return;
    }

    try {
        const data = await api.getHistoryStatus(symbol, timeframe);
        const view = document.getElementById('history-status-view');

        if (view) {
            if (data.status === 'success' && data.start_date && data.end_date) {
                view.innerHTML = `
                    <p>📊 <strong>Veri Bulundu:</strong></p>
                    <p style="margin-top:5px;">
                        <strong>Başlangıç:</strong> ${data.start_date}<br>
                        <strong>Bitiş:</strong> ${data.end_date}
                    </p>
                `;
            } else {
                view.innerHTML = '<p>⚠️ Veritabanında bu sembol için veri yok. Lütfen aşağıdan indirin.</p>';
            }
        }
    } catch (error) {
        // Sessizce geç - gereksiz hata loglarını önle
        console.debug('History status check (no data):', symbol);
    }
}

async function startDownload() {
    const symbol = document.getElementById('selected-symbol-val')?.innerText;
    const timeframe = document.getElementById('download-timeframe')?.value || '1m';
    const startDate = document.getElementById('download-start-date')?.value || '2024-01-01';
    
    if (!symbol) {
        showToast('❌ Lütfen bir sembol seçin', 'error');
        return;
    }
    
    try {
        const result = await api.startDownload(symbol, timeframe, startDate);
        showToast(result.message, result.status === 'started' ? 'success' : 'info');
    } catch (error) {
        showToast('❌ İndirme hatası: ' + error.message, 'error');
    }
}

async function stopDownload() {
    const symbol = document.getElementById('selected-symbol-val')?.innerText;

    if (!symbol) return;

    try {
        const result = await api.stopDownload(symbol);
        showToast(result.message, result.status === 'success' ? 'success' : 'error');
    } catch (error) {
        showToast('❌ Durdurma hatası: ' + error.message, 'error');
    }
}

async function deleteDownloadTask(symbol, marketType = 'future') {
    if (!confirm(`${symbol} (${marketType}) için indirme görevi silinecek. Emin misiniz?`)) {
        return;
    }

    try {
        const result = await api.deleteDownloadTask(symbol, marketType);
        
        if (result.status === 'success') {
            showToast(`✅ ${result.message}`, 'success');
            // Listeyi hemen güncelle
            await updateActiveTasks();
        } else {
            showToast(`❌ Silme hatası: ${result.message}`, 'error');
        }
    } catch (error) {
        showToast('❌ Silme hatası: ' + error.message, 'error');
    }
}

async function closePosition(symbol) {
    if (!confirm(`${symbol} pozisyonu kapatılsın mı?`)) return;
    
    try {
        await api.closePosition(symbol);
        showToast('✅ Pozisyon kapatıldı', 'success');
        loadDashboardMetrics();
    } catch (error) {
        showToast('❌ Kapatma hatası: ' + error.message, 'error');
    }
}

async function startMLTraining() {
    const symbol = document.getElementById('ml-training-symbol')?.value;
    const timeframe = document.getElementById('ml-training-timeframe')?.value || '1h';
    const limit = parseInt(document.getElementById('ml-training-limit')?.value) || 1000;
    
    if (!symbol) {
        showToast('❌ Sembol seçin', 'error');
        return;
    }
    
    try {
        store.setState('ml', { training: { isTraining: true, progress: 0, message: 'Başlatılıyor...' } });
        
        const result = await api.trainModel(symbol, timeframe, limit);
        showToast(result.message, 'success');
        
        // Poll training status
        pollTrainingStatus();
    } catch (error) {
        store.setState('ml', { training: { isTraining: false } });
        showToast('❌ Eğitim hatası: ' + error.message, 'error');
    }
}

async function pollTrainingStatus() {
    const poll = async () => {
        const state = store.getState();
        if (!state.ml.training.isTraining) return;
        
        try {
            const status = await api.getMLStatus();
            store.setState('ml', {
                training: {
                    isTraining: status.is_training,
                    progress: status.progress,
                    message: status.message,
                }
            });
            
            if (!status.is_training) {
                showToast('✅ ML eğitimi tamamlandı', 'success');
                loadMLTrainingHistory();
            } else {
                setTimeout(poll, 2000);
            }
        } catch (error) {
            console.error('Training status poll error:', error);
        }
    };
    
    poll();
}

async function runMLVisualAnalysis() {
    const symbol = document.getElementById('ml-analysis-symbol')?.value;
    const strategy = document.getElementById('ml-analysis-strategy')?.value;
    const timeframe = document.getElementById('ml-analysis-timeframe')?.value || '1h';
    
    if (!symbol || !strategy) {
        showToast('❌ Sembol ve strateji seçin', 'error');
        return;
    }
    
    try {
        const data = await api.runVisualAnalysis(symbol, strategy, timeframe);
        
        // Render chart
        const chart = new ChartRenderer('ml-analysis-chart');
        chart.init();
        chart.setCandlestickData(data.candles || []);
        
        if (data.markers && data.markers.length > 0) {
            chart.addMarkers(data.markers);
        }
        
        // Render feature importance
        if (data.feature_importance) {
            PlotlyRenderer.renderFeatureImportance('feature-importance-chart', data.feature_importance);
        }
        
        showToast('✅ Analiz tamamlandı', 'success');
    } catch (error) {
        showToast('❌ Analiz hatası: ' + error.message, 'error');
    }
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 24px;
        background: ${type === 'success' ? '#2ea043' : type === 'error' ? '#f85149' : '#0969da'};
        color: white;
        border-radius: 6px;
        font-weight: 600;
        z-index: 9999;
    `;
    
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ============================================================================
// APP LIFECYCLE
// ============================================================================

// Start app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopAutoRefresh();
    botManager.destroy();
});

// Export for debugging
export { initApp, store, api, botManager };
