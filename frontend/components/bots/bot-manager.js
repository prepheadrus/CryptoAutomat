/**
 * Bot Manager Component
 * 
 * Bot lifecycle management (start, stop, resume, remove).
 * Tüm bot DOM manipülasyonları bu modülde izole edilmiştir.
 * 
 * Usage:
 *   import botManager from '../components/bots/bot-manager.js';
 *   
 *   // Initialize
 *   botManager.init();
 *   
 *   // Start bot
 *   await botManager.startBot({ symbol: 'BTC/USDT', strategy: 'trend_master' });
 */

import api from '../../services/api-client.js';
import store from '../../state/store.js';

class BotManager {
    constructor() {
        this.bots = [];
        this.selectedBot = null;
        
        console.log('🤖 [BOT] Manager initialized');
    }
    
    /**
     * Initialize bot manager
     */
    init() {
        this.loadBots();
        this.setupEventListeners();

        // Subscribe to store changes
        store.subscribe((state) => {
            if (state.bots) {
                this.bots = state.bots.list || [];
                console.log('[BOT] Store bots updated:', this.bots);
                console.log('[BOT] Bot count:', this.bots.length);
                if (this.bots.length > 0) {
                    console.log('[BOT] First bot:', this.bots[0]);
                }
                this.render();
            }
        });
    }
    
    /**
     * Load bots from API
     */
    async loadBots() {
        try {
            console.log('🔄 [BOT] Loading bots from API...');
            const data = await api.getBots();
            console.log('[BOT] API response:', data);

            store.setState('bots', {
                list: data.bots || [],
                loading: false
            });
            console.log(`[BOT] Loaded ${data.bots?.length || 0} bots`);
        } catch (error) {
            console.error('❌ [BOT] Load error:', error);
            store.setState('bots', { list: [], loading: false });
        }
    }
    
    /**
     * Start bot
     * @param {Object} botData - Bot configuration
     */
    async startBot(botData) {
        try {
            const result = await api.startBot(botData);
            
            if (result.status === 'success') {
                console.log(`✅ [BOT] Started: ${result.bot_id}`);
                await this.loadBots(); // Refresh list
                return result;
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('❌ [BOT] Start error:', error);
            throw error;
        }
    }
    
    /**
     * Stop bot
     * @param {string} botId - Bot ID
     */
    async stopBot(botId) {
        try {
            const result = await api.stopBot(botId);
            
            if (result.status === 'success') {
                console.log(`🛑 [BOT] Stopped: ${botId}`);
                await this.loadBots();
                return result;
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('❌ [BOT] Stop error:', error);
            throw error;
        }
    }
    
    /**
     * Resume bot
     * @param {string} botId - Bot ID
     */
    async resumeBot(botId) {
        try {
            const result = await api.resumeBot(botId);
            
            if (result.status === 'success') {
                console.log(`▶️ [BOT] Resumed: ${botId}`);
                await this.loadBots();
                return result;
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('❌ [BOT] Resume error:', error);
            throw error;
        }
    }
    
    /**
     * Remove bot
     * @param {string} botId - Bot ID
     */
    async removeBot(botId) {
        try {
            const result = await api.removeBot(botId);
            
            if (result.status === 'success') {
                console.log(`🗑️ [BOT] Removed: ${botId}`);
                await this.loadBots();
                return result;
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('❌ [BOT] Remove error:', error);
            throw error;
        }
    }
    
    /**
     * Select bot
     * @param {string} botId - Bot ID
     */
    selectBot(botId) {
        this.selectedBot = botId;
        store.setState('bots', { selected: botId });
        this.render();
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Auto-refresh bots every 5 seconds
        setInterval(() => {
            this.loadBots();
        }, 5000);
    }
    
    /**
     * Render bot list
     */
    render() {
        const container = document.getElementById('active-bots-container');
        console.log('[BOT] render() called, container:', container);
        if (!container) {
            console.error('[BOT] Container not found!');
            return;
        }

        console.log('[BOT] Rendering', this.bots.length, 'bots');

        if (this.bots.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                    📭 Aktif bot yok. Yukarıdan yeni bot başlatabilirsiniz.
                </div>
            `;
            console.log('[BOT] No bots to render');
            return;
        }

        container.innerHTML = this.bots.map(bot => {
            console.log('[BOT] Rendering bot:', bot);
            const statusLabel = bot.status === 'running' ? '🟢 Çalışıyor' :
                               bot.status === 'stopped' ? '🔴 Durduruldu' :
                               bot.status === 'paused' ? '🟡 Duraklatıldı' :
                               `⚪ ${bot.status}`;

            return `
            <div class="bot-card" data-bot-id="${bot.bot_id}" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 15px; margin-bottom: 12px;">
                <div class="bot-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <span class="bot-symbol" style="font-weight: 700; font-size: 1.1rem; color: var(--neon-blue);">${bot.symbol}</span>
                    <span class="bot-status" style="padding: 4px 12px; border-radius: 4px; background: ${bot.status === 'running' ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 69, 0, 0.2)'}; color: ${bot.status === 'running' ? '#00fa9a' : '#ff4500'}; font-weight: 600; font-size: 0.85rem;">${statusLabel}</span>
                </div>
                <div class="bot-body">
                    <div class="bot-info" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-bottom: 12px; font-size: 0.85rem;">
                        <div><span style="color: var(--text-muted);">Strateji:</span> <span style="color: var(--text-main);">${bot.strategy_id || 'N/A'}</span></div>
                        <div><span style="color: var(--text-muted);">Timeframe:</span> <span style="color: var(--text-main);">${bot.timeframe || 'N/A'}</span></div>
                        <div><span style="color: var(--text-muted);">Market:</span> <span style="color: var(--text-main);">${bot.market_type || 'N/A'}</span></div>
                        <div><span style="color: var(--text-muted);">Margin:</span> <span style="color: var(--text-main);">${bot.margin_type || 'N/A'}</span></div>
                    </div>
                    <div class="bot-actions" style="display: flex; gap: 8px; flex-wrap: wrap;">
                        ${bot.status === 'running' ? `
                            <button onclick="botManager.stopBot('${bot.bot_id}')" class="btn btn-danger" style="padding: 6px 12px; border-radius: 4px; border: none; background: linear-gradient(135deg, #dc2626, #991b1b); color: white; cursor: pointer; font-size: 0.85rem;">
                                ⏹️ Durdur
                            </button>
                        ` : `
                            <button onclick="botManager.resumeBot('${bot.bot_id}')" class="btn btn-primary" style="padding: 6px 12px; border-radius: 4px; border: none; background: linear-gradient(135deg, var(--neon-blue), #6366f1); color: white; cursor: pointer; font-size: 0.85rem;">
                                ▶️ Devam
                            </button>
                        `}
                        <button onclick="botManager.removeBot('${bot.bot_id}')" class="btn btn-delete" style="padding: 6px 12px; border-radius: 4px; border: none; background: linear-gradient(135deg, #6b7280, #4b5563); color: white; cursor: pointer; font-size: 0.85rem;">
                            🗑️ Sil
                        </button>
                    </div>
                </div>
            </div>
        `}).join('');
        console.log('[BOT] Render complete');
    }
    
    /**
     * Destroy bot manager
     */
    destroy() {
        this.bots = [];
        this.selectedBot = null;
        console.log('🗑️ [BOT] Manager destroyed');
    }
}

// Singleton instance
const botManager = new BotManager();

// Export singleton
export default botManager;

// Also export for window access (debugging)
if (typeof window !== 'undefined') {
    window.botManager = botManager;
}
