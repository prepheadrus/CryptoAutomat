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

    // Setup global functions (for HTML onclick handlers) - CRITICAL: MOVE TO TOP
    setupGlobalFunctions();

    try {
        // Tab navigation
        setupTabs();

        // Initialize components
        botManager.init();

        // Initial data load
        await loadInitialData();

        // Start auto-refresh
        startAutoRefresh();

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
        // Load system status (environment)
        await updateSystemStatus();

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

        // Load settings (Risk, Advanced, Bot Config)
        await loadAllSettings();

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

    console.log(`[DEBUG] setupTabs: ${buttons.length} menü butonu, ${tabs.length} tab bulundu`);

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (!btn.hasAttribute('data-target')) return;

            console.log(`[DEBUG] Tab tıklandı: ${btn.getAttribute('data-target')}`);

            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const targetId = btn.getAttribute('data-target');
            tabs.forEach(tab => { tab.style.display = 'none'; });
            
            const targetTab = document.getElementById(targetId);
            if (targetTab) {
                targetTab.style.display = 'block';
                console.log(`[DEBUG] Tab açıldı: ${targetId}`);
            } else {
                console.error(`[ERROR] Tab bulunamadı: ${targetId}`);
            }

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
                loadBotFormOptions();  // Bot form dropdown'larını yükle
                loadAllSettings();  // Tüm ayarları yükle (Risk, Advanced, Bot)
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

        // Sistem durumunu güncelle (Environment: Production/Development)
        updateSystemStatus();

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
        console.error('❌ History loading error:', error);
    }
}

/**
 * Update system status (Environment, Exchange, etc.)
 */
async function updateSystemStatus() {
    try {
        const data = await api.getStatus();
        console.log('[DEBUG] System status response:', data);

        if (data) {
            // Update environment status in sidebar
            const envStatusEl = document.getElementById('env-status');
            if (envStatusEl) {
                const env = data.environment || 'DEVELOPMENT';
                envStatusEl.textContent = env.toUpperCase();
                
                // Color coding
                if (env.toLowerCase() === 'production') {
                    envStatusEl.style.color = 'var(--neon-red)';
                    envStatusEl.classList.add('danger-text');
                } else {
                    envStatusEl.style.color = 'var(--neon-green)';
                    envStatusEl.classList.add('success-text');
                }
            }

            // Update exchange name if selector present
            const exchangeEl = document.getElementById('exchange-val');
            if (exchangeEl && data.exchange) {
                exchangeEl.textContent = data.exchange.toUpperCase();
            }
        }
    } catch (error) {
        console.error('❌ System status update error:', error);
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

/**
 * ML sembol dropdown'ını doldur
 */
function populateMLSymbolSelect(symbols) {
    try {
        const mlSymbolSelect = document.getElementById('ml-train-symbol');
        if (mlSymbolSelect) {
            // Önce temizle
            mlSymbolSelect.innerHTML = '';
            
            if (symbols && symbols.length > 0) {
                // Her sembol için option ekle
                symbols.forEach(symbol => {
                    const symbolName = symbol.symbol || symbol;
                    const option = document.createElement('option');
                    // Backend için format: BTC/USDT veya BTCUSDT
                    option.value = symbolName;
                    option.textContent = symbolName;
                    mlSymbolSelect.appendChild(option);
                });
                console.log(`[INFO] ML dropdown'a ${symbols.length} sembol eklendi`);
            } else {
                // Sembol yoksa uyarı göster
                mlSymbolSelect.innerHTML = '<option value="">⚠️ Veri Laboratuvarından veri indirin</option>';
                console.warn('⚠️ Veritabanında veri yok');
            }
        }
    } catch (error) {
        console.error('❌ populateMLSymbolSelect hatası:', error);
    }
}

async function loadMLTrainingHistory() {
    try {
        const data = await api.getMLTrainingHistory(50);
        store.setState('ml', { history: data.history || [] });
        renderTrainingHistory(data.history || []);
    } catch (error) {
        console.error('ML history error:', error);
        const container = document.getElementById('training-history-table');
        if (container) {
            container.innerHTML = '<p style="text-align:center; padding:40px; color:var(--text-muted);">❌ Eğitim geçmişi yüklenemedi</p>';
        }
    }
}

/**
 * Eğitim geçmişini render et
 */
function renderTrainingHistory(history) {
    const container = document.getElementById('training-history-table');
    if (!container) {
        console.error('❌ training-history-table elementi bulunamadı!');
        return;
    }

    if (!history || history.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:40px; color:var(--text-muted);">📭 Henüz eğitilmiş model yok. İlk modelinizi eğitin!</p>';
        return;
    }

    container.innerHTML = `
        <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
            <thead>
                <tr style="background:rgba(88, 166, 255, 0.1); border-bottom:2px solid var(--neon-blue);">
                    <th style="padding:12px; text-align:left; color:var(--neon-blue);">📅 Tarih</th>
                    <th style="padding:12px; text-align:left; color:var(--neon-blue);">🪙 Sembol</th>
                    <th style="padding:12px; text-align:left; color:var(--neon-blue);">⏱️ TF</th>
                    <th style="padding:12px; text-align:left; color:var(--neon-blue);">📊 Dataset</th>
                    <th style="padding:12px; text-align:left; color:var(--neon-blue);">🎯 XGB</th>
                    <th style="padding:12px; text-align:left; color:var(--neon-blue);">🌲 RF</th>
                    <th style="padding:12px; text-align:left; color:var(--neon-blue);">🔗 Ensemble</th>
                    <th style="padding:12px; text-align:left; color:var(--neon-blue);">💾 Model</th>
                </tr>
            </thead>
            <tbody>
                ${history.map(item => {
                    const metrics = item.metrics || {};
                    const xgbAcc = metrics.xgb_accuracy || metrics.accuracy || 0;
                    const rfAcc = metrics.rf_accuracy || metrics.accuracy || 0;
                    const ensAcc = metrics.ensemble_accuracy || metrics.accuracy || 0;
                    
                    const getAccColor = (acc) => {
                        if (acc >= 0.5) return 'var(--neon-green)';
                        if (acc >= 0.3) return '#ffc107';
                        return 'var(--neon-red)';
                    };
                    
                    const formatDate = (dateStr) => {
                        if (!dateStr) return 'Invalid Date';
                        try {
                            const date = new Date(dateStr);
                            if (isNaN(date.getTime())) return 'Invalid Date';
                            return date.toLocaleString('tr-TR', { 
                                day: '2-digit', 
                                month: '2-digit', 
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            });
                        } catch (e) {
                            return 'Invalid Date';
                        }
                    };
                    
                    const date = formatDate(item.completed_at || item.started_at);
                    const duration = item.duration_seconds ? `${Math.round(item.duration_seconds)}s` : '-';
                    
                    return `
                        <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                            <td style="padding:12px; color:var(--text-main); white-space:nowrap;">${date}</td>
                            <td style="padding:12px; color:var(--neon-blue); font-weight:600;">${item.symbol}</td>
                            <td style="padding:12px; color:var(--text-main);">${item.timeframe}</td>
                            <td style="padding:12px; color:var(--text-main);">${item.dataset_size || 'undefined'} örnek</td>
                            <td style="padding:12px;">
                                <span style="color:${getAccColor(xgbAcc)}; font-weight:700;" title="XGBoost Accuracy">🎯 %${(xgbAcc * 100).toFixed(1)}</span>
                            </td>
                            <td style="padding:12px;">
                                <span style="color:${getAccColor(rfAcc)}; font-weight:700;" title="Random Forest Accuracy">🌲 %${(rfAcc * 100).toFixed(1)}</span>
                            </td>
                            <td style="padding:12px;">
                                <span style="color:${getAccColor(ensAcc)}; font-weight:700;" title="Ensemble Accuracy">🔗 %${(ensAcc * 100).toFixed(1)}</span>
                            </td>
                            <td style="padding:12px; color:var(--text-muted); font-size:0.75rem;">
                                ${item.model_path ? '✅ Kaydedildi' : '❌ Kaydedilmedi'}
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

/**
 * Eğitim geçmişini temizle
 */
async function clearTrainingHistory() {
    if (!confirm('Tüm eğitim geçmişini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz!')) {
        return;
    }

    try {
        const result = await api.deleteMLTrainingHistory();
        if (result.status === 'success') {
            showToast('✅ Eğitim geçmişi temizlendi', 'success');
            loadMLTrainingHistory();
        } else {
            showToast('❌ Temizleme hatası: ' + result.message, 'error');
        }
    } catch (error) {
        showToast('❌ Temizleme hatası: ' + error.message, 'error');
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

        // ML analysis sembol dropdown'ı doldur
        const mlSymbolSelect = document.getElementById('ml-analysis-symbol');
        if (mlSymbolSelect && symbols && symbols.length > 0) {
            mlSymbolSelect.innerHTML = '<option value="">Sembol seçin</option>';
            symbols.forEach(symbol => {
                const option = document.createElement('option');
                option.value = symbol.symbol || symbol;
                option.textContent = symbol.symbol || symbol;
                mlSymbolSelect.appendChild(option);
            });
            console.log(`[INFO] ✅ ML analysis dropdown'a ${symbols.length} sembol eklendi`);
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

            // Store'a kaydet
            store.setState('settings', {
                ...store.getState('settings'),
                risk: result.data
            });

            console.log('[INFO] Risk ayarları yüklendi:', result.data);
        }
    } catch (error) {
        console.error('❌ loadRiskSettings hatası:', error);
    }
}

/**
 * Gelişmiş Ayarları Yükle (WFO, ML, HTF)
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

            // Store'a kaydet
            store.setState('settings', {
                ...store.getState('settings'),
                advanced: {wfo, ml, htf}
            });

            console.log('[INFO] Gelişmiş ayarlar yüklendi:', result.data);
        }
    } catch (error) {
        console.error('❌ loadAdvancedSettings hatası:', error);
    }
}

/**
 * Bot Config Yükle
 */
async function loadBotConfig() {
    try {
        const response = await fetch('/api/v1/config/bot');
        const result = await response.json();

        if (result.status === 'success' && result.data) {
            const {exchange, environment, log_level} = result.data;

            if (exchange) {
                document.getElementById('bot-config-exchange').value = exchange;
            }
            if (environment) {
                document.getElementById('bot-config-environment').value = environment;
            }
            if (log_level) {
                document.getElementById('bot-config-loglevel').value = log_level;
            }

            // Store'a kaydet
            store.setState('settings', {
                ...store.getState('settings'),
                bot: result.data
            });

            console.log('[INFO] Bot config yüklendi:', result.data);
        }
    } catch (error) {
        console.error('❌ loadBotConfig hatası:', error);
    }
}

/**
 * Tüm Ayarları Yükle (Settings sayfası açıldığında)
 */
async function loadAllSettings() {
    console.log('[INFO] 🔄 Tüm sistem ayarları yükleniyor...');
    
    await Promise.all([
        loadRiskSettings(),
        loadAdvancedSettings(),
        loadBotConfig()
    ]);
    
    console.log('[INFO] ✅ Tüm ayarlar yüklendi');
}

/**
 * Bot Config Kaydet
 */
async function saveBotConfig() {
    try {
        const exchange = document.getElementById('bot-config-exchange').value;
        const environment = document.getElementById('bot-config-environment').value;
        const logLevel = document.getElementById('bot-config-loglevel').value;

        showToast('🤖 Bot yapılandırması kaydediliyor...', 'info');

        // Backend API çağrısı
        const response = await fetch('/api/v1/config/bot', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                exchange,
                environment,
                log_level: logLevel
            })
        });

        const result = await response.json();

        if (result.status === 'success') {
            showToast('✅ ' + result.message, 'success');
            
            // Store'a kaydet
            store.setState('settings', {
                ...store.getState('settings'),
                bot: {exchange, environment, log_level: logLevel}
            });
        } else {
            showToast('❌ ' + result.message, 'error');
        }
    } catch (error) {
        console.error('❌ saveBotConfig hatası:', error);
        showToast('❌ Bot yapılandırması kaydedilemedi: ' + error.message, 'error');
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
        if (!portfolio) return;

        // 1. Ana Portföy Kartları (Tab 1)
        const mainElements = {
            'balance-val': portfolio.balance,
            'free-margin-val': portfolio.free_margin,
            'used-margin-val': portfolio.used_margin,
            'total-pnl-val': portfolio.total_pnl,
        };

        // 2. Performans KPI Kartları (Tab 3 - Aktif Emirler)
        const perfElements = {
            'perf-balance': portfolio.balance,
            'perf-equity': portfolio.equity || portfolio.balance,
            'perf-winrate': portfolio.win_rate * 100,
            'perf-count': portfolio.total_trades,
            'perf-total-trades': portfolio.total_trades, 
            'perf-total-pnl': portfolio.total_pnl,
            'perf-total-fees': portfolio.total_commission || 0
        };

        // Ana kartları güncelle
        Object.entries(mainElements).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el && value !== undefined) {
                el.textContent = `$${value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                if (id === 'total-pnl-val') {
                    el.className = value >= 0 ? 'success-text' : 'danger-text';
                    el.textContent = (value >= 0 ? '+' : '') + el.textContent;
                }
            }
        });

        // KPI kartlarını güncelle
        Object.entries(perfElements).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el && value !== undefined) {
                if (id === 'perf-winrate') {
                    el.textContent = `${value.toFixed(1)}%`;
                } else if (id === 'perf-count' || id === 'perf-total-trades') {
                    el.textContent = value;
                } else {
                    el.textContent = `$${value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                    if (id === 'perf-total-pnl') {
                        el.style.color = value >= 0 ? 'var(--neon-green)' : 'var(--neon-red)';
                    }
                }
            }
        });

        // Tab 3'teki Sermaye Kullanımı kartlarını da güncelle
        const usageElements = {
            'usage-used-margin': portfolio.used_margin,
            'usage-free-margin': portfolio.free_margin,
            'usage-notional': portfolio.total_notional || 0
        };

        Object.entries(usageElements).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el && value !== undefined) {
                el.textContent = `$${value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
            }
        });

        // Gerçek İşlem Kaldıracı (Trading Leverage): Toplam Pozisyon / Kullanılan Marjin
        const leverageEl = document.getElementById('usage-leverage');
        if (leverageEl && portfolio.total_notional > 0 && portfolio.used_margin > 0) {
            // Bir tüccarın görmek istediği işlem kaldıracı (Örn: 10.0x, 1.0x)
            const exposureLeverage = portfolio.total_notional / portfolio.used_margin;
            leverageEl.textContent = `${exposureLeverage.toFixed(1)}x`;
        } else if (leverageEl) {
            leverageEl.textContent = `0.0x`;
        }

    } catch (error) {
        console.error('❌ updatePortfolioCards hatası:', error);
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
            const signalColors = { 2: 'var(--neon-green)', 0: 'var(--neon-red)', 1: 'var(--text-muted)' };
            const signalTexts = { 2: '🟢 AL (LONG)', 0: '🔴 SAT (SHORT)', 1: '⚪ BEKLE' };

            const mlColor = dec.ml_confirmed ? 'var(--neon-blue)' : 'var(--neon-red)';
            const timeStr = dec.time ? new Date(dec.time).toLocaleTimeString('tr-TR') : '--:--';

            return `
                <div class="decision-card-multi ${dec.ml_confirmed ? '' : 'filter-rejected'}">
                    <div class="decision-header">
                        <strong class="neon-text">${symbol.replace('/USDT', '')}</strong>
                        <span style="color: ${signalColors[dec.signal_val] || '#8b949e'}; font-weight: bold;">
                            ${signalTexts[dec.signal_val] || '⚪ BEKLE'}
                        </span>
                    </div>
                    <div class="decision-body" style="font-size: 0.8rem; line-height: 1.4;">
                        <div style="display:flex; justify-content:space-between;">
                            <span>🧠 ML Tavsiye:</span>
                            <span style="color:${mlColor}; font-weight:600;">${dec.ml_rec || 'HOLD'} (%${(dec.ml_confidence * 100).toFixed(0)})</span>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span>📊 HTF Trend:</span>
                            <span style="color:var(--neon-purple);">${dec.htf_trend || 'NEUTRAL'}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-top:4px; opacity:0.7; font-size:0.7rem;">
                            <span>💰 Fiyat: $${dec.price?.toFixed(2) || 0}</span>
                            <span>🕒 ${timeStr}</span>
                        </div>
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
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:40px; color: var(--text-muted);">Açık pozisyon yok</td></tr>';
            return;
        }

        tbody.innerHTML = positions.map(pos => {
            const pnlColor = (pos.unrealized_usd || 0) >= 0 ? 'success-text' : 'danger-text';
            const directionClass = pos.direction === 'LONG' ? 'badge-success' : 'badge-danger';
            const notional = (pos.size || 0) * (pos.current_price || pos.entry_price || 0);
            
            return `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="font-size: 0.65rem; color: var(--text-muted); font-family: monospace;">
                        ${pos.bot_id ? pos.bot_id.split('_')[1] || pos.bot_id.substring(0,8) : 'N/A'}
                    </td>
                    <td>
                        <div style="display:flex; flex-direction:column;">
                            <span class="badge ${directionClass}" style="width:fit-content; font-size:0.6rem; padding: 2px 6px; margin-bottom:2px;">
                                ${pos.direction || 'UNKNOWN'}
                            </span>
                            <span style="font-weight:bold; color:var(--text-bright);">${pos.symbol || 'Unknown'}</span>
                        </div>
                    </td>
                    <td>
                        <div style="display:flex; flex-direction:column;">
                            <span style="color:var(--text-bright); font-weight:500;">${(pos.size || 0).toFixed(4)}</span>
                            <span style="font-size:0.7rem; color:var(--text-muted);">${Math.round(pos.leverage || 1)}x</span>
                        </div>
                    </td>
                    <td>
                        <div style="display:flex; flex-direction:column;">
                            <span style="color:var(--text-bright);">$${(pos.entry_price || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                            <span style="font-size:0.7rem; color:var(--text-muted); font-weight:bold;">$${notional.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                        </div>
                    </td>
                    <td>
                        <div style="display:flex; flex-direction:column;">
                            <span style="color:var(--text-bright);">$${(pos.current_price || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                            <span class="${pnlColor}" style="font-weight:bold;">
                                ${(pos.unrealized_usd || 0) >= 0 ? '+' : ''}$${(pos.unrealized_usd || 0).toFixed(2)}
                            </span>
                        </div>
                    </td>
                    <td class="${pnlColor}" style="font-weight:bold; font-size: inherit;">
                        ${(pos.pnl_percent || 0) >= 0 ? '+' : ''}${(pos.pnl_percent || 0).toFixed(2)}%
                    </td>
                    <td>
                        <div style="font-size: 0.7rem; display:flex; flex-direction:column; gap:2px;">
                            <span style="color: var(--neon-red);">SL: ${pos.stop_loss ? pos.stop_loss.toLocaleString() : '-'}</span>
                            <span style="color: var(--neon-green);">TP: ${pos.take_profit ? pos.take_profit.toLocaleString() : '-'}</span>
                            <span style="color: ${getColorForLiq(pos.liquidation_price, pos.current_price || pos.entry_price, pos.direction)}; font-weight:bold;">
                                Liq: ${pos.liquidation_price && pos.liquidation_price > 0 ? pos.liquidation_price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}
                            </span>
                        </div>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-danger btn-close-pos" 
                                onclick="closePosition('${pos.symbol || ''}')"
                                style="font-size: 0.65rem; padding: 4px 8px; border-radius: 4px;">
                            POZ. KAPAT
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
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
            container.innerHTML = '<p style="text-align:center; padding:40px; color:var(--text-muted); font-size:1.1rem;">📭 Strateji bulunamadı</p>';
            return;
        }

        // Get active bot strategies to highlight active ones
        const bots = store.getState('bots')?.list || [];
        const activeStrategyIds = bots.filter(b => b.status === 'running').map(b => b.strategy_id);

        container.innerHTML = strategies.map(s => {
            if (!s) return '';
            
            const isBuiltin = s.type === 'builtin';
            const badgeText = isBuiltin ? '📦 Built-in' : '🎨 Custom';
            const badgeClass = isBuiltin ? 'builtin' : 'custom';
            const isActive = activeStrategyIds.includes(s.id);
            
            return `
                <div class="strategy-card">
                    <div class="strategy-card-header">
                        <h3 class="strategy-card-title">${s.name || 'Bilinmeyen'}</h3>
                        <span class="strategy-badge ${badgeClass}">${badgeText}</span>
                    </div>
                    <p class="strategy-card-description">${s.description || 'Açıklama yok'}</p>
                    <div class="strategy-card-footer">
                        <button class="strategy-select-btn ${isActive ? 'active' : ''}" 
                                onclick="onStrategySelect('${s.id}', '${s.name.replace(/'/g, "\\'")}')">
                            ${isActive ? '✅ Aktif' : '🚀 Seç / Aktif Et'}
                        </button>
                    </div>
                </div>
            `;
        }).filter(Boolean).join('');
    } catch (error) {
        console.error('❌ renderStrategyLibrary hatası:', error);
        console.error('Stack trace:', error.stack);
    }
}

/**
 * Strateji seçim butonu tıklandığında çağrılır
 * @param {string} strategyId - Strateji ID
 * @param {string} strategyName - Strateji adı
 */
function onStrategySelect(strategyId, strategyName) {
    console.log(`[INFO] 🎯 Strateji seçildi: ${strategyName} (${strategyId})`);
    
    // Modal veya prompt ile onay al
    const confirmed = confirm(`"${strategyName}" stratejisini aktif etmek istediğiniz sembolü seçin.\n\nTamam'a basarak devam edin.`);
    
    if (confirmed) {
        // Bot oluşturma modal'ını aç veya doğrudan bot başlatma akışına yönlendir
        // Şimdilik basitçe bot formuna scroll yap ve stratejiyi seç
        const strategySelect = document.getElementById('bot-strategy');
        if (strategySelect) {
            strategySelect.value = strategyId;
            strategySelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
        
        // Bot sekmesine git (tab-settings içerisindedir)
        const botTab = document.querySelector('[data-target="tab-settings"]');
        if (botTab) {
            botTab.click();
        }
        
        showToast(`✅ "${strategyName}" seçildi. Lütfen sembol seçin ve botu başlatın.`, 'success');
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
            const symbols = Object.keys(downloads);

            console.log(`[INFO] ${symbols.length} aktif/tamamlanmış indirme bulundu`);
            countDisplay.textContent = `${activeCount} Aktif / ${totalCount} Toplam`;

            if (symbols.length === 0) {
                list.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:40px;">📭 Aktif veya tamamlanmış indirme yok</p>';
            } else {
                // Modern task cards with new CSS classes
                list.innerHTML = Object.entries(downloads).map(([symbolKey, task]) => {
                    const progress = task.progress || 100;
                    const status = task.status || 'completed';
                    const speed = task.speed || 0;
                    
                    // Sembol ve market type ayır
                    let symbolName = symbolKey;
                    let marketType = task.market_type || 'future';

                    if (symbolKey.includes('_future') || symbolKey.includes('_spot')) {
                        const parts = symbolKey.split('_');
                        marketType = parts[parts.length - 1];
                        symbolName = parts.slice(0, -1).join('_');
                    }

                    // Status class ve text
                    const statusClass = status === 'running' ? 'running' :
                                       status === 'completed' ? 'completed' :
                                       status === 'paused' ? 'paused' : 'stopped';
                    
                    const statusDisplay = status === 'running' ? '🔄 İndiriliyor' :
                                         status === 'completed' ? '✅ Tamamlandı' :
                                         status === 'paused' ? '⏸️ Duraklatıldı' : '⏹️ Durduruldu';

                    // Tarih bilgileri
                    let startDate = task.start_date || '...';
                    let lastCandleDate = '-';

                    if (task.target_start_ms && !startDate) {
                        startDate = new Date(task.target_start_ms).toLocaleDateString('tr-TR');
                    }

                    if (task.current_ts) {
                        lastCandleDate = new Date(task.current_ts).toLocaleString('tr-TR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                    }

                    // Silme butonu - STOPPED, COMPLETED, PAUSED için
                    const isInvalidSymbol = symbolKey.includes('-- SEÇİNİZ --') ||
                                           symbolKey.includes('SEÇİNİZ') ||
                                           symbolKey === '_future' ||
                                           symbolKey === '_spot';
                    
                    const showDeleteButton = (status !== 'running' || isInvalidSymbol);
                    
                    const deleteButton = showDeleteButton ? `
                        <button class="task-btn task-btn-delete" onclick="deleteDownloadTask('${symbolKey}', '${marketType}')" title="Görevi Sil">
                            🗑️
                        </button>
                    ` : '';

                    const pauseButton = (status === 'running' || status === 'paused') ? `
                        <button class="task-btn" onclick="togglePause('${symbolKey}', '${status === 'paused' ? 'resume' : 'pause'}')" title="${status === 'paused' ? 'Devam Et' : 'Duraklat'}">
                            ${status === 'paused' ? '▶️' : '⏸️'}
                        </button>
                    ` : '';

                    return `
                        <div class="task-item ${statusClass}">
                            <div class="task-header">
                                <span class="task-symbol">${symbolName}</span>
                                <span class="task-status ${statusClass}">${statusDisplay}</span>
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
                            
                            <div class="task-actions">
                                ${pauseButton}
                                ${deleteButton}
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

    // YENİ: Bot config
    window.saveBotConfig = saveBotConfig;
    window.loadAllSettings = loadAllSettings;

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
    const marginType = document.getElementById('bot-margin-type')?.value || 'isolated';

    console.log('[INFO] Bot başlatılıyor:', {symbol, strategy, timeframe, market, marginType});

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
            market_type: market,
            margin_type: marginType
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

/**
 * İndirme görevini duraklat/devam ettir
 */
async function togglePause(symbol, action = 'pause') {
    try {
        const result = await api.togglePause(symbol, action);

        if (result.status === 'success') {
            showToast(`✅ ${result.message}`, 'success');
            await updateActiveTasks();
        } else {
            showToast(`❌ Hata: ${result.message}`, 'error');
        }
    } catch (error) {
        showToast('❌ Duraklatma hatası: ' + error.message, 'error');
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
    const symbol = document.getElementById('ml-train-symbol')?.value;
    const timeframe = document.getElementById('ml-train-timeframe')?.value || '1h';
    const limit = parseInt(document.getElementById('ml-train-limit')?.value) || 5000;
    const tp = parseFloat(document.getElementById('ml-train-tp')?.value) || 2.0;
    const sl = parseFloat(document.getElementById('ml-train-sl')?.value) || 2.0;

    console.log('[ML Training] Form values:', { symbol, timeframe, limit, tp, sl });

    if (!symbol || symbol === '') {
        showToast('❌ Lütfen sembol seçin', 'error');
        return;
    }

    // Mevcut veri sayısını kontrol et
    try {
        const dataCountResponse = await fetch(`/api/v1/data/data-count?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`);
        const dataCountData = await dataCountResponse.json();
        const availableCount = dataCountData.count || 0;
        
        if (availableCount < 100) {
            showToast(`❌ Yetersiz veri: ${availableCount} mum (min 100 gerekli)`, 'error');
            return;
        }
        
        if (limit > availableCount) {
            showToast(`⚠️ DB'de sadece ${availableCount.toLocaleString()} mum var. Limit ${availableCount.toLocaleString()} olarak ayarlanıyor.`, 'warning');
        }
        
        // Limit'i DB'deki veriye göre ayarla (kullanıcı az girdiyse onu kullan)
        const actualLimit = Math.min(limit, availableCount);
        
        console.log('[ML Training] Starting training:', { symbol, timeframe, limit: actualLimit, tp, sl, available: availableCount, userRequested: limit });

        store.setState('ml', { training: { isTraining: true, progress: 5, message: 'Başlatılıyor...', current_step: 'DB bağlantısı' } });

        // Backend'e TP ve SL değerlerini gönder
        const result = await api.trainModel(symbol, timeframe, actualLimit, 'xgboost', tp, sl);
        console.log('[ML Training] Response:', result);
        showToast(result.message || '🚀 ML eğitimi başlatıldı', 'success');

        // Poll training status
        pollTrainingStatus();
    } catch (error) {
        store.setState('ml', { training: { isTraining: false } });
        console.error('[ML Training] Error:', error);
        
        // 422 Validation Error detayını göster
        let errorMessage = error.message;
        if (error.response) {
            error.response.json().then(data => {
                console.error('[ML Training] Validation error details:', data);
                if (data.detail) {
                    errorMessage = data.detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join(', ');
                }
            }).catch(() => {});
        }
        
        showToast('❌ Eğitim hatası: ' + errorMessage, 'error');
    }
}

/**
 * Mum sayısı validasyonu - dinamik
 */
function validateMumCount() {
    const symbol = document.getElementById('ml-train-symbol')?.value;
    const timeframe = document.getElementById('ml-train-timeframe')?.value;
    const limitInput = document.getElementById('ml-train-limit');
    const warningSpan = document.getElementById('ml-limit-warning');
    const rangeSpan = document.getElementById('ml-db-range');
    const dbCountSpan = document.getElementById('ml-db-count');
    
    if (!symbol || !timeframe || !limitInput) return;
    
    const limit = parseInt(limitInput.value) || 0;
    
    // Mevcut veri sayısını al
    fetch(`/api/v1/data/data-count?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`)
        .then(r => r.json())
        .then(data => {
            const availableCount = data.count || 0;
            
            if (availableCount > 0) {
                // Tarih aralığını göster
                if (data.min_date && data.max_date) {
                    rangeSpan.textContent = `${data.min_date} → ${data.max_date}`;
                }
                
                // Limit kontrolü
                if (limit > availableCount) {
                    // Kullanıcı DB'den fazla girdi → UYARI
                    warningSpan.style.display = 'block';
                    warningSpan.textContent = `⚠️ DB'de sadece ${availableCount.toLocaleString()} mum var!`;
                    warningSpan.style.color = 'var(--neon-red)';
                    limitInput.style.borderColor = 'var(--neon-red)';
                    dbCountSpan.textContent = `DB: ${availableCount.toLocaleString()} mum`;
                    dbCountSpan.style.color = 'var(--neon-blue)';
                } else if (limit < 100) {
                    // Çok az → UYARI
                    warningSpan.style.display = 'block';
                    warningSpan.textContent = '⚠️ Min 100 mum gerekli!';
                    warningSpan.style.color = 'var(--neon-red)';
                    limitInput.style.borderColor = 'var(--neon-red)';
                    dbCountSpan.textContent = `DB: ${availableCount.toLocaleString()} mum`;
                    dbCountSpan.style.color = 'var(--neon-blue)';
                } else {
                    // Normal → Yüzde göster
                    warningSpan.style.display = 'none';
                    limitInput.style.borderColor = 'rgba(255,255,255,0.1)';
                    
                    const percentage = ((limit / availableCount) * 100).toFixed(1);
                    dbCountSpan.textContent = `DB: ${availableCount.toLocaleString()} mum → Kullanılan: ${limit.toLocaleString()} (${percentage}%)`;
                    dbCountSpan.style.color = percentage >= 50 ? 'var(--neon-green)' : 'var(--neon-blue)';
                }
            } else {
                // Veri yok → HATA
                dbCountSpan.textContent = '❌ Veri yok';
                dbCountSpan.style.color = 'var(--neon-red)';
                rangeSpan.textContent = '';
                warningSpan.style.display = 'block';
                warningSpan.textContent = '⚠️ Bu sembol için veri yok! Önce veri indirin.';
                warningSpan.style.color = 'var(--neon-red)';
                limitInput.style.borderColor = 'var(--neon-red)';
            }
        })
        .catch(err => {
            console.error('Data count fetch error:', err);
            dbCountSpan.textContent = '❌ Hata';
            dbCountSpan.style.color = 'var(--neon-red)';
        });
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

    console.log('[ML Visual Analysis] Starting:', { symbol, strategy, timeframe });

    if (!symbol || !strategy) {
        showToast('❌ Sembol ve strateji seçin', 'error');
        return;
    }

    try {
        // Loading state göster
        const chartContainer = document.getElementById('ml-analysis-chart');
        const featureContainer = document.getElementById('feature-importance-chart');
        
        if (chartContainer) {
            chartContainer.innerHTML = '<div style="position:absolute; top:0; left:0; width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.3);"><div class="loading-spinner"></div><p style="color:white; margin-left:15px;">📊 Analiz ediliyor...</p></div>';
        }

        const limit = parseInt(document.getElementById('ml-train-limit')?.value) || 1000;
        console.log('[ML Visual Analysis] Requesting data range:', limit);
        
        const data = await api.runVisualAnalysis(symbol, strategy, timeframe, limit);

        console.log('[ML Visual Analysis] Response:', data);
        console.log('[ML Visual Analysis] Candles:', data.candles?.length, 'mum');
        console.log('[ML Visual Analysis] Markers:', data.markers?.length, 'adet');
        console.log('[ML Visual Analysis] Feature Importance:', data.feature_importance?.length, 'özellik');

        if (data.status === 'error') {
            showToast('❌ ' + data.message, 'error');
            if (chartContainer) chartContainer.innerHTML = '';
            return;
        }

        // 3. Render chart
        if (data.status === 'success' && data.candles && data.candles.length > 0) {
            const chartContainer = document.getElementById('ml-analysis-chart');
            if (chartContainer) {
                try {
                    // [PROTECTION] Zaman Sıralama Kalkanı: LWC kronolojik veri bekler (Eski -> Yeni)
                    data.candles.sort((a, b) => a.time - b.time);
                    
                    if (data.markers && data.markers.length > 0) {
                        data.markers.sort((a, b) => a.time - b.time);
                    }

                    // [PROTECTION] Görünürlük ve Yükseklik Kontrolü
                    chartContainer.innerHTML = '';
                    chartContainer.style.height = '450px'; // Kesin yükseklik garantisi
                    
                    const chart = new ChartRenderer('ml-analysis-chart');
                    chart.init();
                    chart.setCandlestickData(data.candles);

                    console.log('[ML Visual Analysis] Chart initialized with sorted data:', data.candles.length);
                    
                    if (data.markers && data.markers.length > 0) {
                        console.log('[ML Visual Analysis] Adding sorted markers:', data.markers.length);
                        chart.addMarkers(data.markers);
                    }

                    console.log('[ML Visual Analysis] Chart rendered successfully:', data.candles.length, 'candles');
                } catch (renderError) {
                    console.error('[ML Visual Analysis] Chart Render Error:', renderError);
                    chartContainer.innerHTML = `<p style="color:var(--neon-red); padding:20px; text-align:center;">⚠️ Grafik çizim hatası: ${renderError.message}</p>`;
                }
            }
        } else if (data.status === 'success') {
            showToast('⚠️ Gösterilecek mum verisi bulunamadı', 'warning');
            const chartContainer = document.getElementById('ml-analysis-chart');
            if (chartContainer) chartContainer.innerHTML = '<p style="text-align:center; padding-top:180px; color:var(--text-muted);">Veri yok</p>';
        }

        // Render feature importance
        if (data.feature_importance && data.feature_importance.length > 0) {
            renderFeatureImportance(data.feature_importance);
        } else {
            if (featureContainer) {
                featureContainer.innerHTML = '<p style="text-align:center; padding:40px; color:var(--text-muted);">📊 Model bulunamadı. Önce model eğitin.</p>';
            }
        }

        showToast('✅ Analiz tamamlandı', 'success');
    } catch (error) {
        console.error('[ML Visual Analysis] Error:', error);
        showToast('❌ Analiz hatası: ' + error.message, 'error');
        const chartContainer = document.getElementById('ml-analysis-chart');
        if (chartContainer) chartContainer.innerHTML = '';
    }
}

/**
 * Feature importance render et
 */
function renderFeatureImportance(featureImportance) {
    const container = document.getElementById('feature-importance-chart');
    if (!container) {
        console.error('❌ feature-importance-chart elementi bulunamadı!');
        return;
    }

    if (!featureImportance || featureImportance.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:40px; color:var(--text-muted);">📊 Feature importance verisi yok</p>';
        return;
    }

    // Bar chart HTML
    const maxVal = Math.max(...featureImportance.map(f => f.importance || f.value || 0));
    
    container.innerHTML = `
        <div style="padding:20px;">
            <h4 style="color:var(--neon-blue); margin-bottom:15px;">🧬 Model Ağırlık Analizi</h4>
            <div style="display:flex; flex-direction:column; gap:10px;">
                ${featureImportance.map((feature, idx) => {
                    const importance = feature.importance || feature.value || 0;
                    const percentage = maxVal > 0 ? (importance / maxVal * 100) : 0;
                    const color = percentage >= 80 ? 'var(--neon-blue)' : percentage >= 50 ? 'var(--neon-purple)' : 'var(--text-muted)';
                    
                    return `
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div style="width:150px; font-size:0.85rem; color:var(--text-main); text-align:right; font-weight:600;">
                                ${feature.feature || feature.name || `Feature ${idx}`}
                            </div>
                            <div style="flex:1; background:rgba(255,255,255,0.05); border-radius:4px; height:20px; overflow:hidden;">
                                <div style="width:${percentage}%; background:${color}; height:100%; border-radius:4px; transition: width 0.3s;"></div>
                            </div>
                            <div style="width:60px; font-size:0.75rem; color:var(--text-muted); text-align:right;">
                                ${(importance * 100).toFixed(1)}%
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            <p style="font-size:0.75rem; color:var(--text-muted); margin-top:15px; text-align:center;">
                💡 Modelin karar verirken en çok hangi indikatörleri dikkate aldığını (yüzdelik etki) gösterir.
            </p>
        </div>
    `;
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

// Make showToast available globally for onclick handlers
window.showToast = showToast;

// ============================================================================
// STRATEGY PERFORMANCE REPORT (Modernized)
// ============================================================================

async function loadStrategyReport() {
    try {
        console.log('[INFO] 📈 Strateji performans raporu yükleniyor...');
        const container = document.getElementById('strategy-report-container');
        if (!container) { console.error('❌ Container bulunamadı!'); return; }
        container.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p class="loading-text">📊 Rapor hazırlanıyor...</p><p class="loading-subtext">Tüm işlemler analiz ediliyor</p></div>';
        const response = await fetch('/api/v1/strategy-report');
        const data = await response.json();
        console.log('[DEBUG] Strategy report response:', data);
        if (data.status === 'success' && data.report && data.report.length > 0) { renderStrategyReport(data.report); }
        else if (data.status === 'success' && (!data.report || data.report.length === 0)) { container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><h3 class="empty-title">Henüz işlem geçmişi yok</h3><p class="empty-text">Botları başlatıp işlem yaptıkça raporlar burada görünecek.</p><p class="empty-hint">💡 İpucu: Performans raporları sadece kapanan işlemleri baz alır.</p></div>'; }
        else { container.innerHTML = '<div class="error-state"><div class="error-icon">❌</div><h3 class="error-title">Rapor yüklenemedi</h3><p class="error-message">' + (data.message || 'Bilinmeyen hata') + '</p></div>'; }
    } catch (error) { console.error('❌ Rapor yükleme hatası:', error); showToast('❌ Rapor yüklenemedi: ' + error.message, 'error'); }
}

function renderStrategyReport(report) {
    try {
        const container = document.getElementById('strategy-report-container');
        if (!container) { console.error('❌ Container bulunamadı!'); return; }
        console.log('[DEBUG] renderStrategyReport - report:', report?.length);
        container.innerHTML = '<div class="reports-grid">' + report.map(strat => {
            const winRateClass = strat.win_rate >= 60 ? 'win-rate-excellent' : strat.win_rate >= 50 ? 'win-rate-good' : strat.win_rate >= 40 ? 'win-rate-average' : 'win-rate-poor';
            const winRateColor = strat.win_rate >= 60 ? 'var(--neon-green)' : strat.win_rate >= 50 ? 'var(--neon-blue)' : strat.win_rate >= 40 ? '#ffc107' : 'var(--neon-red)';
            const pnlColor = strat.total_pnl >= 0 ? 'var(--neon-green)' : 'var(--neon-red)';
            const recommendationIcon = strat.win_rate >= 60 && strat.total_pnl > 0 ? '✅' : strat.win_rate >= 50 ? '⚠️' : '❌';
            const escapeHtml = (text) => { if (!text) return ''; const div = document.createElement('div'); div.textContent = text; return div.innerHTML; };
            return '<div class="report-card glass-panel"><div class="report-card-header"><h3 class="report-card-title">' + escapeHtml(strat.strategy) + '</h3><span class="report-badge ' + winRateClass + '" style="background: ' + winRateColor + ';">📊 %' + strat.win_rate + ' Win Rate</span></div><div class="report-metrics"><div class="report-metric"><div class="report-metric-label">Toplam İşlem</div><div class="report-metric-value">' + strat.total_trades + '</div></div><div class="report-metric"><div class="report-metric-label">Net P&L</div><div class="report-metric-value" style="color: ' + pnlColor + ';">$' + strat.total_pnl.toFixed(2) + '</div></div></div>' + (strat.symbols && strat.symbols.length > 0 ? '<div class="report-section"><h4 class="report-section-title">🎯 Sembol Performansı</h4><div class="symbols-list">' + strat.symbols.map(sym => '<div class="symbol-item"><span class="symbol-name">' + escapeHtml(sym.name) + '</span><div class="symbol-stats"><span class="symbol-trades">' + sym.trades + ' işlem</span><span class="symbol-win-rate" style="color: ' + (sym.win_rate >= 60 ? 'var(--neon-green)' : sym.win_rate >= 40 ? '#ffc107' : 'var(--neon-red)') + ';">%' + sym.win_rate + '</span><span class="symbol-pnl" style="color: ' + (sym.pnl >= 0 ? 'var(--neon-green)' : 'var(--neon-red)') + ';">$' + sym.pnl.toFixed(2) + '</span></div></div>').join('') + '</div></div>' : '<div class="report-section"><p class="no-data">Sembol verisi yok</p></div>') + '<div class="report-recommendation"><div class="recommendation-icon">' + recommendationIcon + '</div><div class="recommendation-content"><div class="recommendation-label">Analiz Önerisi</div><p class="recommendation-text">' + escapeHtml(strat.recommendation) + '</p></div></div></div>';
        }).join('') + '</div>';
        console.log('[INFO] ✅ Strateji raporu render edildi');
    } catch (error) { console.error('❌ renderStrategyReport hatası:', error); showToast('❌ Rapor render hatası: ' + error.message, 'error'); }
}

// Make loadStrategyReport available globally
window.loadStrategyReport = loadStrategyReport;
window.renderTrainingHistory = renderTrainingHistory;
window.clearTrainingHistory = clearTrainingHistory;
window.loadMLTrainingHistory = loadMLTrainingHistory;
window.runMLVisualAnalysis = runMLVisualAnalysis;

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

function getColorForLiq(liq, current, direction) {
    if (!liq || liq <= 0) return 'var(--text-muted)';
    const dist = direction === 'LONG' ? (current - liq) / current : (liq - current) / current;
    if (dist <= 0.02) return 'var(--neon-red)';
    if (dist <= 0.05) return '#ffaa00';
    return 'var(--text-muted)';
}


// Export for debugging
export { initApp, store, api, botManager };
