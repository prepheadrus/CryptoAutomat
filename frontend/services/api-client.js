/**
 * API Client
 * 
 * Merkezi API iletişim katmanı.
 * Tüm fetch() çağrıları ve hata yönetimi burada yapılır.
 */

class ApiClient {
    constructor(baseURL = '') {
        this.baseURL = baseURL;
        this.defaultHeaders = {
            'Content-Type': 'application/json',
        };
    }

    /**
     * Generic fetch wrapper with error handling
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            ...options,
            headers: {
                ...this.defaultHeaders,
                ...(options.headers || {}),
            },
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new ApiError(
                    errorData.message || `HTTP ${response.status}: ${response.statusText}`,
                    response.status,
                    errorData
                );
            }

            return await response.json();
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            
            // Network error
            throw new ApiError(
                'Network error. Please check your connection.',
                0,
                { originalError: error.message }
            );
        }
    }

    /**
     * GET request
     */
    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return this.request(url, { method: 'GET' });
    }

    /**
     * POST request
     */
    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    /**
     * DELETE request
     */
    async delete(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'DELETE',
            body: JSON.stringify(data),
        });
    }

    // ========================================================================
    // STATUS & SYSTEM
    // ========================================================================

    getStatus() {
        return this.get('/api/v1/status');
    }

    getDashboardMetrics() {
        return this.get('/api/v1/dashboard-metrics');
    }

    // ========================================================================
    // BOT MANAGEMENT
    // ========================================================================

    getBots() {
        return this.get('/api/v1/bot/list');  // Düzeltildi: /api/v1/bot/list
    }

    getBotStatus(botId) {
        return this.get('/api/v1/bot/status', { bot_id: botId });
    }

    startBot(botData) {
        return this.post('/api/v1/bot/start', botData);
    }

    stopBot(botId) {
        return this.post('/api/v1/bot/stop', { bot_id: botId, action: 'stop' });
    }

    resumeBot(botId) {
        return this.post('/api/v1/bot/resume', { bot_id: botId, action: 'resume' });
    }

    removeBot(botId) {
        return this.post('/api/v1/bot/remove', { bot_id: botId });
    }

    // ========================================================================
    // STRATEGY
    // ========================================================================

    getStrategies() {
        return this.get('/api/v1/strategies');
    }

    selectStrategy(symbol, strategyId, timeframe = '1m', marketType = 'swap', marginType = 'isolated') {
        return this.post('/api/v1/strategy/select', null, {
            params: { symbol, strategy_id: strategyId, timeframe, market_type: marketType, margin_type: marginType }
        });
    }

    /**
     * Strateji performans raporunu al
     * @returns {Promise} Rapor verisi
     */
    getStrategyReport() {
        return this.get('/api/v1/strategy-report');
    }

    // ========================================================================
    // MARKET & DATA
    // ========================================================================

    getExchangeMarkets() {
        return this.get('/api/v1/exchange/markets');
    }

    getTrackedSymbols() {
        return this.get('/api/v1/config/symbols');
    }

    updateTrackedSymbols(symbols) {
        return this.post('/api/v1/config/symbols', { symbols });
    }

    getSymbolsWithData() {
        return this.get('/api/v1/data/symbols-with-data');
    }

    getDataSymbols() {
        // Alias for getSymbolsWithData (consistent naming)
        return this.get('/api/v1/data/symbols-with-data');
    }

    getStrategies() {
        return this.get('/api/v1/strategies');
    }

    getDataInventory() {
        return this.get('/api/v1/data/inventory');
    }

    getDataStats() {
        return this.get('/api/v1/data/stats');
    }

    // ========================================================================
    // DATA DOWNLOAD
    // ========================================================================

    getHistoryStatus(symbol, timeframe = '1m') {
        return this.get('/api/v1/data/history-status', { symbol, timeframe });
    }

    startDownload(symbol, timeframe = '1m', startDate = '2024-01-01', marketType = 'future') {
        return this.post('/api/v1/data/download-history', {
            symbol,
            timeframe,
            start_date: startDate,
            market_type: marketType,
        });
    }

    stopDownload(symbol) {
        return this.post('/api/v1/data/stop-download', { symbol });
    }

    resumeDownload(symbol, timeframe, startDate, marketType) {
        return this.post('/api/v1/data/resume-download', {
            symbol,
            timeframe,
            start_date: startDate,
            market_type: marketType,
        });
    }

    getActiveDownloads() {
        return this.get('/api/v1/data/active-downloads');
    }

    getAllDownloadTasks() {
        return this.get('/api/v1/data/all-download-tasks');
    }

    deleteTask(symbol, timeframe = '1m') {
        return this.post('/api/v1/data/delete-task', { symbol, timeframe });
    }

    deleteDownloadTask(symbol, marketType = 'future') {
        return this.post('/api/v1/data/delete-download-task', { 
            symbol, 
            market_type: marketType 
        });
    }

    togglePause(symbol, action = 'pause') {
        return this.post('/api/v1/data/toggle-pause', { symbol, action });
    }

    // ========================================================================
    // TRADES & POSITIONS
    // ========================================================================

    getTradeHistory(params = {}) {
        return this.get('/api/v1/trades/history', params);
    }

    clearTradeHistory() {
        return this.delete('/api/v1/trades/clear');
    }

    getTradeStats() {
        return this.get('/api/v1/trades/stats');
    }

    getPositions() {
        return this.get('/api/v1/dashboard-metrics'); // Positions included in metrics
    }

    closePosition(symbol) {
        return this.post('/api/v1/position/close', { symbol });
    }

    // ========================================================================
    // ML
    // ========================================================================

    trainModel(symbol, timeframe = '1h', limit = 1000, modelType = 'xgboost', tp = 2.0, sl = 2.0) {
        return this.post('/api/v1/ml/train', {
            symbol,
            timeframe,
            limit,
            model_type: modelType,
            tp,  // Take profit multiplier
            sl,  // Stop loss multiplier
        });
    }

    getMLStatus() {
        return this.get('/api/v1/ml/status');
    }

    getMLTrainingHistory(limit = 50) {
        return this.get('/api/v1/ml/training-history', { limit });
    }

    deleteMLTrainingHistory() {
        return this.delete('/api/v1/ml/training-history');
    }

    checkModel(symbol, timeframe = '1h') {
        return this.get('/api/v1/ml/check-model', { symbol, timeframe });
    }

    runVisualAnalysis(symbol, strategyId, timeframe = '1h', limit = 300) {
        return this.get('/api/v1/ml/visual-analysis', {
            symbol,
            strategy_id: strategyId,
            timeframe,
            limit,
        });
    }
}

/**
 * Custom API Error class
 */
class ApiError extends Error {
    constructor(message, status, data) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
    }
}

// Singleton instance
const api = new ApiClient();

// Export for ES6 modules
export { ApiClient, ApiError, api };
