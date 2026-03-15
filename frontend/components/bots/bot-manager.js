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
                this.render();
            }
        });
    }
    
    /**
     * Load bots from API
     */
    async loadBots() {
        try {
            const data = await api.getBots();
            store.setState('bots', {
                list: data.bots || [],
                loading: false
            });
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
        const container = document.getElementById('bot-list');
        if (!container) return;
        
        if (this.bots.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                    📭 Aktif bot yok
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.bots.map(bot => `
            <div class="bot-card" data-bot-id="${bot.bot_id}">
                <div class="bot-header">
                    <span class="bot-symbol">${bot.symbol}</span>
                    <span class="bot-status status-${bot.status}">${bot.status}</span>
                </div>
                <div class="bot-body">
                    <div class="bot-info">
                        <span>Strateji: ${bot.strategy_id}</span>
                        <span>Timeframe: ${bot.timeframe}</span>
                    </div>
                    <div class="bot-actions">
                        ${bot.status === 'running' ? `
                            <button onclick="botManager.stopBot('${bot.bot_id}')" class="btn btn-danger">
                                ⏹️ Durdur
                            </button>
                        ` : `
                            <button onclick="botManager.resumeBot('${bot.bot_id}')" class="btn btn-primary">
                                ▶️ Devam
                            </button>
                        `}
                        <button onclick="botManager.removeBot('${bot.bot_id}')" class="btn btn-delete">
                            🗑️ Sil
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
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
