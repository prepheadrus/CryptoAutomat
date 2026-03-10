/**
 * Bot Manager Component
 * 
 * Aktif bot listesi, bot kartları ve bot kontrol işlemleri.
 */

import { api } from '../../services/api-client.js';
import { store, selectors, actions } from '../../state/store.js';

class BotManager {
    constructor() {
        this.containerId = 'active-bots-container';
        this.statusContainerId = 'system-status-summary';
        this.refreshInterval = null;
    }

    /**
     * Initialize bot manager
     */
    init() {
        this.loadBots();
        this.startAutoRefresh();
    }

    /**
     * Load active bots
     */
    async loadBots() {
        try {
            store.setState('bots', { loading: true });

            const data = await api.getBots();
            const bots = data.bots || [];

            store.setState('bots', {
                active: bots,
                loading: false,
            });

            this.render();
        } catch (error) {
            console.error('Bot yükleme hatası:', error);
            store.setState('bots', {
                loading: false,
                error: error.message,
            });
        }
    }

    /**
     * Render bot list
     */
    render() {
        const state = store.getState();
        const bots = selectors.getActiveBots(state);
        const strategies = selectors.getStrategies(state);

        // Active bots container
        const container = document.getElementById(this.containerId);
        if (container) {
            container.innerHTML = this.renderBotCards(bots, strategies);
        }

        // Status summary (dashboard)
        const statusContainer = document.getElementById(this.statusContainerId);
        if (statusContainer) {
            statusContainer.innerHTML = this.renderStatusCards(bots, state.dashboard.decisions);
        }
    }

    /**
     * Render bot cards (settings tab)
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

        return bots.map(bot => {
            const botId = bot.bot_id || `${bot.symbol}_${bot.strategy_id}_${bot.timeframe}`;
            const isRunning = bot.status === 'running';

            return `
                <div class="bot-card" data-bot-id="${botId}">
                    <div class="bot-card-header">
                        <div class="bot-symbol">${bot.symbol.replace('/USDT', '')}</div>
                        <div class="bot-status ${isRunning ? 'running' : 'stopped'}">
                            ${isRunning ? '🟢 Çalışıyor' : '🔴 Durduruldu'}
                        </div>
                    </div>
                    <div class="bot-card-body">
                        <div class="bot-row">
                            <span class="bot-label">Strateji:</span>
                            <span class="bot-value">${bot.strategy_id || 'unknown'}</span>
                        </div>
                        <div class="bot-row">
                            <span class="bot-label">Timeframe:</span>
                            <span class="bot-value">${bot.timeframe || '1m'}</span>
                        </div>
                        <div class="bot-row">
                            <span class="bot-label">Market:</span>
                            <span class="bot-value">${bot.market_type || 'future'}</span>
                        </div>
                        <div class="bot-row">
                            <span class="bot-label">PnL:</span>
                            <span class="bot-value ${bot.pnl >= 0 ? 'success-text' : 'danger-text'}">
                                $${(bot.pnl || 0).toFixed(2)}
                            </span>
                        </div>
                    </div>
                    <div class="bot-card-actions">
                        ${isRunning ? `
                            <button class="btn btn-warning" onclick="botManager.stopBot('${botId}')">
                                ⏹️ Durdur
                            </button>
                        ` : `
                            <button class="btn btn-success" onclick="botManager.resumeBot('${botId}')">
                                ▶️ Devam Et
                            </button>
                        `}
                        <button class="btn btn-danger" onclick="botManager.removeBot('${botId}')">
                            🗑️ Kaldır
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Render status cards (dashboard)
     */
    renderStatusCards(bots, decisions) {
        if (!bots || bots.length === 0) {
            return `
                <div style="grid-column: span 4; text-align: center; padding: 40px; color: var(--text-muted);">
                    📭 Henüz aktif strateji yok
                </div>
            `;
        }

        return bots.map(bot => {
            const botId = bot.bot_id || `${bot.symbol}_${bot.strategy_id}_${bot.timeframe}`;
            const sym = bot.symbol;
            const strategyId = bot.strategy_id || 'unknown';
            const timeframe = bot.timeframe || '1m';

            // Find strategy name
            const strategyName = strategyId; // Could be enhanced with strategy lookup

            // Get latest decision
            const decision = decisions ? decisions[sym] : null;
            const signalText = decision && decision.signal_val !== undefined
                ? (decision.signal_val === 2 ? '🟢 AL' : decision.signal_val === 0 ? '🔴 SAT' : '⚪ BEKLE')
                : '⚪ BEKLE';
            const signalColor = decision && decision.signal_val !== undefined
                ? (decision.signal_val === 2 ? '#2ea043' : decision.signal_val === 0 ? '#f85149' : '#8b949e')
                : '#8b949e';

            return `
                <div class="system-status-card" data-bot-id="${botId}">
                    <div class="status-card-header-compact">
                        <span class="status-symbol">${sym.replace('/USDT', '')} (${timeframe})</span>
                        <span class="status-signal" style="color: ${signalColor}; font-weight: 700; font-size: 0.75rem;">
                            ${signalText}
                        </span>
                    </div>
                    <div class="status-card-body-compact">
                        <div class="status-row-compact">
                            <span class="status-label">🤖</span>
                            <span class="status-value" title="${strategyName}">
                                ${strategyName.split(' ')[0]}
                            </span>
                        </div>
                        <div class="status-row-compact">
                            <span class="status-label">⏱️</span>
                            <span class="status-value">${timeframe}</span>
                        </div>
                        <div class="status-row-compact">
                            <span class="status-label">💹</span>
                            <span class="status-value">${bot.market_type || 'future'}</span>
                        </div>
                        <div class="status-row-compact">
                            <span class="status-label">PnL:</span>
                            <span class="status-value ${(bot.pnl || 0) >= 0 ? 'success-text' : 'danger-text'}">
                                $${(bot.pnl || 0).toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Start bot
     */
    async startBot(botData) {
        try {
            const result = await api.startBot(botData);
            
            if (result.status === 'success') {
                this.loadBots(); // Refresh list
                return { success: true, message: result.message };
            }
            
            return { success: false, message: result.message };
        } catch (error) {
            console.error('Bot başlatma hatası:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Stop bot
     */
    async stopBot(botId) {
        if (!confirm(`Bot durdurulsun mu?\n\nBot ID: ${botId}`)) {
            return;
        }

        try {
            const result = await api.stopBot(botId);
            
            if (result.status === 'success') {
                this.loadBots();
                showToast('Bot durduruldu', 'success');
            } else {
                showToast('Bot durdurulamadı: ' + result.message, 'error');
            }
        } catch (error) {
            console.error('Bot durdurma hatası:', error);
            showToast('Bot durdurma hatası: ' + error.message, 'error');
        }
    }

    /**
     * Resume bot
     */
    async resumeBot(botId) {
        try {
            const result = await api.resumeBot(botId);
            
            if (result.status === 'success') {
                this.loadBots();
                showToast('Bot devam ettirildi', 'success');
            } else {
                showToast('Bot devam ettirilemedi: ' + result.message, 'error');
            }
        } catch (error) {
            console.error('Bot devam ettirme hatası:', error);
            showToast('Bot devam ettirme hatası: ' + error.message, 'error');
        }
    }

    /**
     * Remove bot
     */
    async removeBot(botId) {
        if (!confirm(`Bot listeden kaldırılsın mı?\n\nBot ID: ${botId}\n\nBu işlem geri alınamaz!`)) {
            return;
        }

        try {
            const result = await api.removeBot(botId);
            
            if (result.status === 'success') {
                this.loadBots();
                showToast('Bot kaldırıldı', 'success');
            } else {
                showToast('Bot kaldırılamadı: ' + result.message, 'error');
            }
        } catch (error) {
            console.error('Bot kaldırma hatası:', error);
            showToast('Bot kaldırma hatası: ' + error.message, 'error');
        }
    }

    /**
     * Start auto-refresh
     */
    startAutoRefresh() {
        // Refresh every 5 seconds
        this.refreshInterval = setInterval(() => {
            this.loadBots();
        }, 5000);
    }

    /**
     * Stop auto-refresh
     */
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    /**
     * Destroy
     */
    destroy() {
        this.stopAutoRefresh();
    }
}

// ============================================================================
// TOAST NOTIFICATION (Helper)
// ============================================================================

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
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================================================
// EXPORTS
// ============================================================================

const botManager = new BotManager();

export { BotManager, botManager, showToast };
