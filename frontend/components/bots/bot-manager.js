/**
 * Bot Manager Component
 * Manages active bots display and actions
 */

import { api } from '../../services/api-client.js';
import { store } from '../../state/store.js';
import { selectors } from '../../state/store.js';

// ============================================================================
// SMART PARAMETER FORMATTER (Zero-Touch Architecture)
// ============================================================================

/**
 * Backend parametre key'lerini okunaklı UI etiketlerine dönüştürür.
 * Zero-Touch: Yeni parametreler için kod değişikliği gerekmez.
 *
 * @param {string} key - Backend parametre key (örn: "atr_multiplier")
 * @returns {string} - UI label (örn: "ATR Mult")
 */
function formatParamKey(key) {
    if (!key) return '';

    // 1. Alt çizgileri boşluğa çevir
    let label = key.replace(/_/g, ' ');

    // 2. Kısaltmalar (büyük/küçük harf duyarsız)
    const abbreviations = {
        'multiplier': 'Mult',
        'period': 'Per',
        'fast': 'F',
        'slow': 'S',
        'signal': 'Sig',
        'oversold': 'O.S',
        'overbought': 'O.B',
        'upper': 'Up',
        'lower': 'Lo',
        'atr': 'ATR',
        'rsi': 'RSI',
        'macd': 'MACD',
        'stoch': 'Stoch',
        'ema': 'EMA',
        'sma': 'SMA',
        'bb': 'BB',
        'adx': 'ADX',
        'cci': 'CCI',
        'williams': 'Will',
        'obv': 'OBV',
        'volume': 'Vol',
        'tp': 'TP',
        'sl': 'SL'
    };

    // 3. Her kelimeyi işle
    label = label.split(' ').map(word => {
        const lower = word.toLowerCase();
        // Kısaltma varsa kullan, yoksa ilk harfi büyüt
        if (abbreviations[lower]) {
            return abbreviations[lower];
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');

    return label;
}

/**
 * Parametre değerini formatla (sayısal hassasiyet)
 *
 * @param {any} value - Parametre değeri
 * @returns {string} - Formatlanmış değer
 */
function formatParamValue(value) {
    if (typeof value === 'number') {
        // Tam sayı ise ondalık gösterme
        if (Number.isInteger(value)) {
            return value.toString();
        }
        // Ondalık sayılar için maksimum 2 basamak
        return value.toFixed(2).replace(/\.?0+$/, '');
    }
    return String(value);
}

export const botManager = {
    containerId: 'active-bots-container',
    statusContainerId: 'system-status-summary',

    init() {
        this.loadBots();
    },

    async loadBots() {
        try {
            console.log('[BotManager] loadBots başlatılıyor...');
            store.setState('bots', { loading: true });

            const data = await api.getBots();
            console.log('[BotManager] API response:', data);
            const bots = data.bots || [];
            console.log('[BotManager] Bots count:', bots.length);

            store.setState('bots', {
                active: bots,
                loading: false,
            });

            console.log('[BotManager] render() çağrılıyor...');
            this.render();
        } catch (error) {
            console.error('Bot yükleme hatası:', error);
            store.setState('bots', {
                loading: false,
                error: error.message,
            });
        }
    },

    render() {
        console.log('[BotManager] render() çalışıyor...');
        const state = store.getState();
        const bots = selectors.getActiveBots(state);
        console.log('[BotManager] Aktif botlar:', bots);
        const strategies = selectors.getStrategies(state);

        // Active bots container (Settings Tab)
        const container = document.getElementById(this.containerId);
        if (container) {
            container.innerHTML = this.renderBotCards(bots, strategies);
        }

        // Status summary (Dashboard / Active Orders Tab)
        const statusContainer = document.getElementById(this.statusContainerId);
        if (statusContainer) {
            statusContainer.innerHTML = this.renderStatusCards(bots, state.dashboard.decisions);
        }
    },

    /**
     * Render bot cards (settings tab) - TABLE FORMAT
     */
    renderBotCards(bots, strategies) {
        if (!bots || bots.length === 0) {
            return `
                <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                    <p style="font-size: 1.1rem;">📭 Henüz aktif bot yok</p>
                    <p style="font-size: 0.9rem; margin-top: 10px;">
                        Yukarıdaki formdan yeni bir bot başlatabilirsiniz.
                    </p>
                </div>
            `;
        }

        // Modern table format
        return `
            <div class="bots-table-container">
                <table class="bots-table">
                    <thead>
                        <tr>
                            <th style="width: 120px;">🪙 Sembol</th>
                            <th style="width: 180px;">📚 Strateji</th>
                            <th style="width: 80px;">⏱️ TF</th>
                            <th style="width: 80px;">🏛️ Market</th>
                            <th style="width: 100px;">📊 Durum</th>
                            <th style="width: 100px; text-align: right;">🎯 İşlem</th>
                            <th style="width: 120px; text-align: right;">💰 PnL ($)</th>
                            <th style="width: 120px; text-align: right;">📈 PnL (%)</th>
                            <th style="width: 150px;">🕒 Süre</th>
                            <th style="width: 180px; text-align: center;">⚙️ İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${bots.map(bot => {
                            const botId = bot.bot_id || `${bot.symbol}_${bot.strategy_id}_${bot.timeframe}`;
                            const isRunning = bot.status === 'running';
                            const pnlUsd = bot.pnl || 0;
                            const pnlPercent = bot.pnl_percent || 0;
                            const uptime = this.formatUptime(bot.started_at);
                            const tradeCount = bot.trades || 0;
                            const winRate = tradeCount > 0 ? (bot.wins / tradeCount * 100).toFixed(0) : 0;
                            
                            return `
                                <tr class="bot-row ${isRunning ? 'running' : 'stopped'}" data-bot-id="${botId}">
                                    <td>
                                        <div class="bot-symbol-cell">
                                            <span class="symbol-icon">₿</span>
                                            <span class="symbol-text">${bot.symbol.replace('/USDT', '')}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span class="strategy-badge">${bot.strategy_id || 'unknown'}</span>
                                    </td>
                                    <td><span class="timeframe-tag">${bot.timeframe || '1m'}</span></td>
                                    <td><span class="market-tag">${bot.market_type || 'swap'}</span></td>
                                    <td>
                                        <span class="status-badge ${isRunning ? 'status-running' : 'status-stopped'}">
                                            ${isRunning ? '🟢 Aktif' : '🔴 Durduruldu'}
                                        </span>
                                    </td>
                                    <td style="text-align: right;">
                                        <div style="font-size: 0.85rem; font-weight: 600;">${tradeCount}</div>
                                        <div style="font-size: 0.7rem; color: var(--text-muted);">%${winRate} WR</div>
                                    </td>
                                    <td style="text-align: right;">
                                        <span class="pnl-value ${pnlUsd >= 0 ? 'positive' : 'negative'}">
                                            $${pnlUsd.toFixed(2)}
                                        </span>
                                    </td>
                                    <td style="text-align: right;">
                                        <span class="pnl-percent ${pnlPercent >= 0 ? 'positive' : 'negative'}">
                                            ${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%
                                        </span>
                                    </td>
                                    <td><span class="uptime-text">${uptime}</span></td>
                                    <td style="text-align: center;">
                                        <div class="bot-actions">
                                            <button class="btn-icon btn-view"
                                                    onclick="window.openStrategyDrawer({ botId: '${botId}', strategyName: '${bot.strategy_name || bot.strategy_id || 'Unknown'}', symbol: '${bot.symbol || ''}' })"
                                                    title="Grafiği Gör">
                                                📊
                                            </button>
                                            ${isRunning ? `
                                                <button class="btn-icon btn-stop" onclick="botManager.stopBot('${botId}')" title="Durdur">
                                                    ⏹️
                                                </button>
                                            ` : `
                                                <button class="btn-icon btn-play" onclick="botManager.resumeBot('${botId}')" title="Devam Et">
                                                    ▶️
                                                </button>
                                            `}
                                            <button class="btn-icon btn-delete" onclick="botManager.removeBot('${botId}')" title="Kaldır">
                                                🗑️
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    /**
     * Format uptime string
     */
    formatUptime(startedAt) {
        if (!startedAt) return '-';
        
        const start = new Date(startedAt);
        const now = new Date();
        const diffMs = now - start;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffDays > 0) {
            return `${diffDays}g ${diffHours % 24}s`;
        } else if (diffHours > 0) {
            return `${diffHours}s ${diffMins % 60}d`;
        } else {
            return `${diffMins}d`;
        }
    },

    /**
     * Render status cards (dashboard / active orders tab)
     */
    renderStatusCards(bots, decisions) {
        if (!bots || bots.length === 0) {
            return `
                <div style="grid-column: span 100%; text-align: center; padding: 40px; color: var(--text-muted);">
                    📭 Henüz aktif strateji yok
                </div>
            `;
        }

        return bots.map(bot => {
            const botId = bot.bot_id || `${bot.symbol}_${bot.strategy_id}_${bot.timeframe}`;
            const sym = bot.symbol;
            const strategyId = bot.strategy_id || 'unknown';
            const timeframe = bot.timeframe || '1m';
            const tradeCount = bot.trades || 0;
            const winRate = tradeCount > 0 ? (bot.wins / tradeCount * 100).toFixed(0) : 0;

            // ============================================
            // WFO AKTİF PARAMETRELER (Zero-Touch Architecture)
            // ============================================
            const activeParams = bot.active_params || {};
            const lastWfoUpdate = bot.last_wfo_optimization;
            const maxBadges = 6; // Maksimum rozet sayısı (UI taşkın koruması)

            // Dinamik rozet oluştur (Object.entries ile)
            const paramEntries = Object.entries(activeParams);
            const totalParams = paramEntries.length;
            const displayParams = paramEntries.slice(0, maxBadges);

            // Rozetleri oluştur
            const wfoBadges = displayParams.map(([key, value]) => {
                const label = formatParamKey(key);
                const formattedValue = formatParamValue(value);
                return `<span class="wfo-param-badge" title="${key}: ${value}">${label}: ${formattedValue}</span>`;
            });

            // "+X daha" özeti ekle (eğer 6'dan fazla parametre varsa)
            if (totalParams > maxBadges) {
                const remaining = totalParams - maxBadges;
                wfoBadges.push(`<span class="wfo-param-badge wfo-more">+${remaining} daha</span>`);
            }

            const wfoBadgesHtml = wfoBadges.length > 0
                ? wfoBadges.join('')
                : '<span style="font-size:0.7rem; color:var(--text-muted);">⏳ WFO bekleniyor...</span>';

            const decision = decisions ? decisions[sym] : null;

            // ============================================
            // DİNAMİK SİNYAL (Nefes Efekti + Otomatik HOLD)
            // ============================================
            // Pozisyon var mı kontrol et (latest_decisions'dan)
            const hasOpenPosition = decision?.has_position || false;

            // Sinyal değerini al (0=SAT, 1=HOLD, 2=LONG)
            const signalVal = decision?.signal_val !== undefined ? decision.signal_val : 1;

            // Pozisyon yoksa otomatik HOLD'a dön
            // Mantık: Pozisyon kapandıysa, sistem beklemede → HOLD göster
            const displaySignal = hasOpenPosition ? signalVal : 1;  // 1 = HOLD

            // Sinyal metni ve stil
            const signalText = displaySignal === 2 ? '🟢 AL'
                : displaySignal === 0 ? '🔴 SAT'
                : '⚪ HOLD';

            // CSS class (nefes animasyonu için)
            const signalClass = displaySignal === 2 ? 'status-signal signal-long position-open'
                : displaySignal === 0 ? 'status-signal signal-short position-open'
                : 'status-signal signal-hold';

            // Arka plan rengi (fallback için)
            const signalColor = displaySignal === 2 ? '#2ea043'
                : displaySignal === 0 ? '#f85149'
                : '#8b949e';

            const mlConf = decision && decision.ml_confidence
                ? (() => {
                    // ML confidence 0-1 arası mı yoksa 0-100 arası mı kontrol et
                    const confValue = decision.ml_confidence > 1
                        ? decision.ml_confidence  // Zaten 0-100 aralığında (örn: 50)
                        : decision.ml_confidence * 100;  // 0-1 aralığında (örn: 0.5)
                    return `<span style="font-size:0.7rem; opacity:0.8; margin-left:4px;">(%${confValue.toFixed(0)})</span>`;
                })()
                : '';

            return `
                <div class="system-status-card" data-bot-id="${botId}">
                    <div class="status-card-header-compact">
                        <span class="status-symbol">${sym.replace('/USDT', '')} <small style="opacity:0.6;">${timeframe}</small></span>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <button class="btn-icon-mini"
                                    onclick="window.openStrategyDrawer({ botId: '${botId}', strategyName: '${bot.strategy_name || strategyId || 'Unknown'}', symbol: '${sym || ''}' })"
                                    style="background: rgba(88, 166, 255, 0.1); border: 1px solid rgba(88, 166, 255, 0.2); border-radius: 4px; padding: 2px 4px; cursor: pointer; font-size: 0.8rem;"
                                    title="İşlemleri Gör">
                                📊
                            </button>
                            <span class="${signalClass}" style="background:${signalColor}; color:white;" title="${hasOpenPosition ? '✅ Pozisyon AÇIK' : '⏳ Pozisyon KAPALI (Beklemede)'}">
                                ${signalText} ${mlConf}
                            </span>
                        </div>
                    </div>
                    <div class="status-card-body-compact">
                        <div class="status-row-compact">
                            <span class="status-label">Bot / Strt:</span>
                            <span class="status-value">${strategyId}</span>
                        </div>
                        <div class="status-row-compact">
                            <span class="status-label">PnL / WR:</span>
                            <span class="status-value">
                                <span class="${bot.pnl >= 0 ? 'success-text' : 'danger-text'}">$${(bot.pnl || 0).toFixed(2)}</span>
                                <span style="color:var(--text-muted); font-size:0.75rem; margin-left:5px;">(%${winRate} WR)</span>
                            </span>
                        </div>
                        <div class="status-row-compact">
                            <span class="status-label">İşlem / Trend:</span>
                            <span class="status-value">
                                ${tradeCount} <span style="color:var(--neon-purple); font-size:0.75rem;">| ${decision?.htf_trend || 'NEUTRAL'}</span>
                            </span>
                        </div>
                        ${wfoBadges.length > 0 ? `
                        <div class="status-row-compact" style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.1);">
                            <span class="status-label" style="color:var(--neon-blue);">🧬 WFO Parametreler:</span>
                            <div class="wfo-params-container">
                                ${wfoBadgesHtml}
                            </div>
                            ${lastWfoUpdate ? `<div style="font-size:0.65rem; color:var(--text-muted); margin-top:4px;">🕐 Son güncelleme: ${new Date(lastWfoUpdate).toLocaleString('tr-TR')}</div>` : ''}
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    },

    async startBot(botData) {
        try {
            const result = await api.startBot(botData);

            if (result.success || result.status === 'success') {
                window.showToast('✅ ' + (result.message || 'Bot başlatıldı'), 'success');
                this.loadBots();
                return { success: true };
            } else {
                window.showToast('❌ ' + (result.message || 'Bilinmeyen hata'), 'error');
                return { success: false, message: result.message };
            }
        } catch (error) {
            console.error('Bot başlatma hatası:', error);
            window.showToast('❌ Bot başlatılamadı: ' + error.message, 'error');
            return { success: false, message: error.message };
        }
    },

    async stopBot(botId) {
        try {
            const confirmed = confirm('Bu botu durdurmak istediğinizden emin misiniz?');
            if (!confirmed) return;

            const result = await api.stopBot(botId);

            if (result.success || result.status === 'success') {
                window.showToast('✅ Bot durduruldu', 'success');
                this.loadBots();
            } else {
                window.showToast('❌ ' + (result.message || 'Hata oluştu'), 'error');
            }
        } catch (error) {
            console.error('Bot durdurma hatası:', error);
            window.showToast('❌ Bot durdurulamadı: ' + error.message, 'error');
        }
    },

    async resumeBot(botId) {
        try {
            const result = await api.resumeBot(botId);

            if (result.success || result.status === 'success') {
                window.showToast('✅ Bot devam ediyor', 'success');
                this.loadBots();
            } else {
                window.showToast('❌ ' + (result.message || 'Hata oluştu'), 'error');
            }
        } catch (error) {
            console.error('Bot devam ettirme hatası:', error);
            window.showToast('❌ Bot devam ettirilemedi: ' + error.message, 'error');
        }
    },

    async removeBot(botId) {
        try {
            const confirmed = confirm('Bu botu kaldırmak istediğinizden emin misiniz? Bu işlem geri alınamaz!');
            if (!confirmed) return;

            const result = await api.removeBot(botId);

            if (result.success || result.status === 'success') {
                window.showToast('✅ Bot kaldırıldı', 'success');
                this.loadBots();
            } else {
                window.showToast('❌ ' + (result.message || 'Hata oluştu'), 'error');
            }
        } catch (error) {
            console.error('Bot kaldırma hatası:', error);
            window.showToast('❌ Bot kaldırılamadı: ' + error.message, 'error');
        }
    },
    
    destroy() {
        console.log('[BotManager] Cleanup...');
    }
};
