/**
 * Chart Renderer Component
 * 
 * TradingView Lightweight Charts wrapper.
 * Tüm grafik çizim işlemleri bu modülde izole edilmiştir.
 * 
 * Usage:
 *   import chartRenderer from '../components/charts/chart-renderer.js';
 *   
 *   // Initialize chart
 *   chartRenderer.init('chart-container');
 *   
 *   // Update data
 *   chartRenderer.updateCandles(candles);
 *   chartRenderer.updateMarkers(markers);
 */

class ChartRenderer {
    constructor() {
        this.chart = null;
        this.candleSeries = null;
        this.volumeSeries = null;
        this.containerId = null;
        
        console.log('📊 [CHART] Renderer initialized');
    }
    
    /**
     * Initialize chart
     * @param {string} containerId - DOM container ID
     * @param {Object} options - Chart options
     */
    init(containerId, options = {}) {
        this.containerId = containerId;
        
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`❌ [CHART] Container not found: ${containerId}`);
            return;
        }
        
        const defaultOptions = {
            width: container.clientWidth,
            height: 600,
            layout: {
                backgroundColor: '#0a0e1a',
                textColor: '#d1d4dc'
            },
            grid: {
                vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
                horzLines: { color: 'rgba(42, 46, 57, 0.5)' }
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal
            },
            timeScale: {
                borderColor: 'rgba(197, 203, 206, 0.8)',
                timeVisible: true,
                secondsVisible: false
            }
        };
        
        // Create chart
        this.chart = LightweightCharts.createChart(container, { ...defaultOptions, ...options });
        
        // Add candlestick series
        this.candleSeries = this.chart.addCandlestickSeries({
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderVisible: false,
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350'
        });
        
        // Add volume series
        this.volumeSeries = this.chart.addHistogramSeries({
            color: '#26a69a',
            priceFormat: { type: 'volume' },
            priceScaleId: '',
            scaleMargins: { top: 0.85, bottom: 0 }
        });
        
        // Handle resize
        window.addEventListener('resize', () => {
            this.chart.applyOptions({
                width: container.clientWidth
            });
        });
        
        console.log(`✅ [CHART] Initialized on #${containerId}`);
    }
    
    /**
     * Update candle data
     * @param {Array} candles - OHLCV candles (array of arrays or array of objects)
     */
    updateCandles(candles) {
        if (!this.candleSeries) {
            console.error('❌ [CHART] Chart not initialized');
            return;
        }
        
        const formattedCandles = (candles || []).map(c => {
            let t = Array.isArray(c) ? c[0] : (c.time ?? c.timestamp);
            if (typeof t === 'string') t = new Date(t).getTime();
            const timeSec = t > 1e10 ? Math.floor(t / 1000) : Math.floor(t);
            const open = Number(Array.isArray(c) ? c[1] : c.open);
            const high = Number(Array.isArray(c) ? c[2] : c.high);
            const low = Number(Array.isArray(c) ? c[3] : c.low);
            const close = Number(Array.isArray(c) ? c[4] : c.close);
            return { time: timeSec, open, high, low, close };
        }).filter(c => !isNaN(c.time) && !isNaN(c.close));

        formattedCandles.sort((a, b) => a.time - b.time);
        
        this.candleSeries.setData(formattedCandles);
        console.debug(`📊 [CHART] Updated ${formattedCandles.length} candles`);
    }
    
    /**
     * Update volume data
     * @param {Array} candles - OHLCV candles
     */
    updateVolume(candles) {
        if (!this.volumeSeries) {
            console.error('❌ [CHART] Volume series not initialized');
            return;
        }
        
        const volumeData = (candles || []).map(c => {
            let t = Array.isArray(c) ? c[0] : (c.time ?? c.timestamp);
            if (typeof t === 'string') t = new Date(t).getTime();
            const timeSec = t > 1e10 ? Math.floor(t / 1000) : Math.floor(t);
            const open = Number(Array.isArray(c) ? c[1] : c.open);
            const close = Number(Array.isArray(c) ? c[4] : c.close);
            const vol = Number(Array.isArray(c) ? c[5] : (c.volume ?? c.vol ?? 0));
            return {
                time: timeSec,
                value: vol,
                color: close >= open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)'
            };
        }).filter(v => !isNaN(v.time));

        volumeData.sort((a, b) => a.time - b.time);
        this.volumeSeries.setData(volumeData);
    }
    
    /**
     * Add markers (signals, trades)
     * @param {Array} markers - Markers array
     */
    updateMarkers(markers) {
        if (!this.candleSeries) {
            console.error('❌ [CHART] Chart not initialized');
            return;
        }
        
        const formattedMarkers = (markers || []).map(m => {
            let t = m.time;
            if (typeof t === 'string') t = new Date(t).getTime();
            const timeSec = t > 1e10 ? Math.floor(t / 1000) : Math.floor(t);
            return {
                time: timeSec,
                position: m.position || 'aboveBar',
                color: m.color || '#2196f3',
                shape: m.shape || 'circle',
                text: m.text || ''
            };
        }).filter(m => !isNaN(m.time));

        formattedMarkers.sort((a, b) => a.time - b.time);
        this.candleSeries.setMarkers(formattedMarkers);
        console.debug(`📍 [CHART] Updated ${formattedMarkers.length} markers`);
    }
    
    /**
     * Add trading line
     * @param {Array} lineData - Line points
     * @param {string} color - Line color
     */
    addLine(lineData, color = '#2196f3') {
        if (!this.chart) {
            console.error('❌ [CHART] Chart not initialized');
            return;
        }
        
        const lineSeries = this.chart.addLineSeries({
            color: color,
            lineWidth: 2
        });
        
        const formattedData = lineData.map(d => ({
            time: d.time / 1000,
            value: d.value
        }));
        
        lineSeries.setData(formattedData);
        return lineSeries;
    }
    
    /**
     * Fit content to visible range
     */
    fitContent() {
        if (this.chart) {
            this.chart.timeScale().fitContent();
        }
    }
    
    /**
     * Set visible range
     * @param {number} from - From time (seconds)
     * @param {number} to - To time (seconds)
     */
    setVisibleRange(from, to) {
        if (this.chart) {
            this.chart.timeScale().setVisibleRange({ from, to });
        }
    }
    
    /**
     * Destroy chart
     */
    destroy() {
        if (this.chart) {
            this.chart.remove();
            this.chart = null;
            this.candleSeries = null;
            this.volumeSeries = null;
            console.log('🗑️ [CHART] Destroyed');
        }
    }
}

// Singleton instance
const chartRenderer = new ChartRenderer();

// Export singleton
export default chartRenderer;

// Also export for window access (debugging)
if (typeof window !== 'undefined') {
    window.chartRenderer = chartRenderer;
}
