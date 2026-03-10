/**
 * State Store
 * 
 * Merkezi durum yönetimi (Redux-like pattern).
 * Tüm global state burada tutulur ve listener'lar ile güncellenir.
 */

class Store {
    constructor(initialState = {}) {
        this.state = {
            // System
            status: {
                environment: 'development',
                exchange: 'binance',
                trackingSymbols: [],
            },
            
            // Markets & Data
            markets: {
                all: [],
                tracked: [],
                selected: null,
            },
            
            // Bots
            bots: {
                active: [],
                loading: false,
                error: null,
            },
            
            // Strategies
            strategies: {
                list: [],
                selected: {},
            },
            
            // Trades & Positions
            trades: {
                history: [],
                positions: [],
            },
            
            // ML
            ml: {
                training: {
                    isTraining: false,
                    progress: 0,
                    message: '',
                },
                history: [],
                analysis: null,
            },
            
            // Downloads
            downloads: {
                active: {},
                status: {},
            },

            // Data Symbols (symbols with downloaded candles)
            dataSymbols: [],

            // Dashboard
            dashboard: {
                metrics: null,
                decisions: {},
                portfolio: {},
            },
        };

        this.listeners = new Set();
        this.initialState = { ...initialState };
    }

    /**
     * Get current state
     */
    getState() {
        return this.state;
    }

    /**
     * Get specific slice of state
     */
    getSlice(key) {
        return this.state[key];
    }

    /**
     * Update state and notify listeners
     */
    setState(slice, newState, notify = true) {
        if (!this.state.hasOwnProperty(slice)) {
            console.error(`Invalid state slice: ${slice}`);
            return;
        }

        this.state[slice] = {
            ...this.state[slice],
            ...newState,
        };

        if (notify) {
            this.notifyListeners();
        }
    }

    /**
     * Update nested state
     */
    setNestedState(slice, path, value, notify = true) {
        if (!this.state.hasOwnProperty(slice)) {
            console.error(`Invalid state slice: ${slice}`);
            return;
        }

        const keys = path.split('.');
        const obj = { ...this.state[slice] };
        let current = obj;

        for (let i = 0; i < keys.length - 1; i++) {
            current[keys[i]] = { ...current[keys[i]] };
            current = current[keys[i]];
        }

        current[keys[keys.length - 1]] = value;
        this.state[slice] = obj;

        if (notify) {
            this.notifyListeners();
        }
    }

    /**
     * Subscribe to state changes
     */
    subscribe(listener) {
        this.listeners.add(listener);
        
        // Return unsubscribe function
        return () => {
            this.listeners.delete(listener);
        };
    }

    /**
     * Notify all listeners
     */
    notifyListeners() {
        this.listeners.forEach(listener => {
            try {
                listener(this.state);
            } catch (error) {
                console.error('Store listener error:', error);
            }
        });
    }

    /**
     * Reset state to initial
     */
    reset() {
        this.state = { ...this.initialState };
        this.notifyListeners();
    }

    /**
     * Batch update (multiple changes, single notification)
     */
    batchUpdate(updates) {
        updates.forEach(({ slice, newState }) => {
            if (this.state.hasOwnProperty(slice)) {
                this.state[slice] = {
                    ...this.state[slice],
                    ...newState,
                };
            }
        });
        this.notifyListeners();
    }
}

// ============================================================================
// SELECTORS (State'den veri çekme helper'ları)
// ============================================================================

const selectors = {
    // Bots
    getActiveBots: (state) => state.bots.active,
    getBotById: (state, botId) => state.bots.active.find(b => b.bot_id === botId),
    getBotsBySymbol: (state, symbol) => state.bots.active.filter(b => b.symbol === symbol),
    isBotLoading: (state) => state.bots.loading,
    getBotError: (state) => state.bots.error,

    // Markets
    getAllMarkets: (state) => state.markets.all,
    getTrackedSymbols: (state) => state.markets.tracked,
    getSelectedMarket: (state) => state.markets.selected,

    // Strategies
    getStrategies: (state) => state.strategies.list,
    getStrategyById: (state, id) => state.strategies.list.find(s => s.id === id),

    // Trades
    getTradeHistory: (state) => state.trades.history,
    getPositions: (state) => state.trades.positions,

    // ML
    isMLTraining: (state) => state.ml.training.isTraining,
    getMLProgress: (state) => state.ml.training.progress,
    getMLHistory: (state) => state.ml.history,

    // Downloads
    getActiveDownloads: (state) => state.downloads.active,
    getDownloadStatus: (state, symbol) => state.downloads.status[symbol],

    // Dashboard
    getDashboardMetrics: (state) => state.dashboard.metrics,
    getLatestDecisions: (state) => state.dashboard.decisions,
    getPortfolio: (state) => state.dashboard.portfolio,
};

// ============================================================================
// ACTIONS (State güncelleme helper'ları)
// ============================================================================

const actions = {
    // Bots
    setBots: (bots) => ({ slice: 'bots', newState: { active: bots, loading: false } }),
    setBotsLoading: (loading) => ({ slice: 'bots', newState: { loading } }),
    setBotsError: (error) => ({ slice: 'bots', newState: { error } }),

    // Markets
    setMarkets: (all) => ({ slice: 'markets', newState: { all } }),
    setTrackedSymbols: (tracked) => ({ slice: 'markets', newState: { tracked } }),
    setSelectedMarket: (selected) => ({ slice: 'markets', newState: { selected } }),

    // Strategies
    setStrategies: (list) => ({ slice: 'strategies', newState: { list } }),

    // Trades
    setTradeHistory: (history) => ({ slice: 'trades', newState: { history } }),
    setPositions: (positions) => ({ slice: 'trades', newState: { positions } }),

    // ML
    setMLTraining: (isTraining, progress = 0, message = '') => ({
        slice: 'ml',
        newState: { training: { isTraining, progress, message } }
    }),
    setMLHistory: (history) => ({ slice: 'ml', newState: { history } }),

    // Downloads
    setActiveDownloads: (active) => ({ slice: 'downloads', newState: { active } }),
    setDownloadStatus: (symbol, status) => ({
        slice: 'downloads',
        newState: { status: { ...store.state.downloads.status, [symbol]: status } }
    }),

    // Dashboard
    setDashboardMetrics: (metrics) => ({ slice: 'dashboard', newState: { metrics } }),
    setLatestDecisions: (decisions) => ({ slice: 'dashboard', newState: { decisions } }),
    setPortfolio: (portfolio) => ({ slice: 'dashboard', newState: { portfolio } }),
};

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

const store = new Store();

// Export for ES6 modules
export { Store, store, selectors, actions };
