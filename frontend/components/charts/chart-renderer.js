/**
 * Chart Renderer
 *
 * Lightweight Charts ve Plotly.js görselleştirme bileşenleri.
 */

import { store, selectors } from '../../state/store.js';

// ============================================================================
// LIGHTWEIGHT CHARTS (TradingView)
// ============================================================================

class ChartRenderer {
    constructor(containerId) {
        this.containerId = containerId;
        this.chart = null;
        this.candleSeries = null;
        this.resizeObserver = null;
        this.tooltip = null;
    }

    /**
     * Initialize chart
     */
    init(options = {}) {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error(`Chart container #${this.containerId} not found`);
            return null;
        }

        const defaultOptions = {
            width: container.clientWidth,
            height: 450,
            layout: {
                background: { type: 'solid', color: 'transparent' }, // v4 syntax
                backgroundColor: 'transparent', // v3 backup
                textColor: '#8b949e',
            },
            grid: {
                vertLines: { color: 'rgba(255,255,255,0.05)' },
                horzLines: { color: 'rgba(255,255,255,0.05)' },
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
                vertLine: { labelVisible: true },
                horzLine: { labelVisible: true },
            },
            timeScale: {
                borderColor: 'rgba(255,255,255,0.1)',
                timeVisible: true,
                secondsVisible: false,
                rightOffset: 5,
                barSpacing: 6,
            },
            localization: { locale: 'tr-TR' },
            ...options,
        };

        this.chart = LightweightCharts.createChart(container, defaultOptions);

        // Auto-resize
        this.setupResizeObserver();

        // Tooltip
        this.setupTooltip();

        return this.chart;
    }

    /**
     * Setup auto-resize
     */
    setupResizeObserver() {
        const container = document.getElementById(this.containerId);
        if (!container || !this.chart) return;

        this.resizeObserver = new ResizeObserver(entries => {
            if (entries.length === 0 || entries[0].target !== container) return;
            const newRect = entries[0].contentRect;
            this.chart.applyOptions({
                width: newRect.width,
                height: newRect.height,
            });
        });

        this.resizeObserver.observe(container);
    }

    /**
     * Setup tooltip
     */
    setupTooltip() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        this.tooltip = document.createElement('div');
        this.tooltip.id = 'chart-tooltip';
        this.tooltip.style.cssText = `
            position: absolute;
            display: none;
            padding: 8px 12px;
            background: rgba(22, 27, 34, 0.95);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 6px;
            font-size: 12px;
            color: #a0a5ba;
            pointer-events: none;
            z-index: 1000;
        `;
        container.appendChild(this.tooltip);
    }

    /**
     * Set candlestick data
     */
    setCandlestickData(candles, options = {}) {
        if (!this.chart) {
            this.init(options);
        }

        // Convert to TV format (backend sends 'time', not 'timestamp')
        const tvCandles = candles.map(c => ({
            time: this.parseTime(c.time || c.timestamp),
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
        }));

        const candleSeriesOptions = {
            upColor: '#2ea043',
            downColor: '#f85149',
            borderVisible: false,
            wickUpColor: '#2ea043',
            wickDownColor: '#f85149',
            ...options,
        };

        this.candleSeries = this.chart.addCandlestickSeries(candleSeriesOptions);
        this.candleSeries.setData(tvCandles);
        
        // [FIT] Veriyi görünür yap
        setTimeout(() => {
            if (this.chart) this.chart.timeScale().fitContent();
        }, 100);

        return this.candleSeries;
    }

    /**
     * Add markers (signals, trades)
     * Markers zamana göre sıralanır ve validasyon yapılır
     */
    addMarkers(markers) {
        if (!this.candleSeries) {
            console.error('[ChartRenderer] candleSeries yok, markers eklenemedi');
            return;
        }

        if (!markers || markers.length === 0) {
            console.log('[ChartRenderer] Markers boş, eklenmedi');
            return;
        }

        // Markers'ları filtrele ve parse et
        const validMarkers = markers
            .filter(m => {
                if (m.time === undefined || m.time === null) {
                    console.warn('[ChartRenderer] Marker time eksik:', m);
                    return false;
                }
                const parsedTime = this.parseTime(m.time);
                if (isNaN(parsedTime) || parsedTime <= 0) {
                    console.warn('[ChartRenderer] Marker time geçersiz (0 veya NaN):', m);
                    return false;
                }
                return true;
            })
            .map(m => ({
                ...m,
                time: this.parseTime(m.time),
            }))
            .sort((a, b) => a.time - b.time);  // Zamana göre sırala (KRİTİK!)

        console.log(`[ChartRenderer] ${validMarkers.length} marker eklendi`);
        
        try {
            this.candleSeries.setMarkers(validMarkers);
        } catch (error) {
            console.error('[ChartRenderer] Markers eklenirken hata:', error);
            console.error('[ChartRenderer] Problemli markers:', validMarkers);
        }
    }

    /**
     * Parse timestamp to TV time
     * Backend saniye cinsinden gönderir, bu yüzden bölme işlemi YOK
     */
    parseTime(timestamp) {
        if (typeof timestamp === 'number') {
            // Backend saniye cinsinden gönderir (örn: 1773142200)
            // Lightweight Charts saniye kabul eder, DÖNÜŞÜM YOK
            return timestamp;
        }
        if (typeof timestamp === 'string') {
            // ISO string ise çevir
            return Math.floor(new Date(timestamp).getTime() / 1000);
        }
        return timestamp;
    }

    /**
     * Update tooltip content
     */
    updateTooltip(x, y, content) {
        if (!this.tooltip) return;

        this.tooltip.style.display = 'block';
        this.tooltip.style.left = `${x + 15}px`;
        this.tooltip.style.top = `${y}px`;
        this.tooltip.innerHTML = content;
    }

    /**
     * Hide tooltip
     */
    hideTooltip() {
        if (this.tooltip) {
            this.tooltip.style.display = 'none';
        }
    }

    /**
     * Destroy chart
     */
    destroy() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        if (this.chart) {
            this.chart.remove();
            this.chart = null;
        }
        if (this.tooltip && this.tooltip.parentNode) {
            this.tooltip.parentNode.removeChild(this.tooltip);
        }
    }
}

// ============================================================================
// PLOTLY CHARTS (Portfolio, Feature Importance)
// ============================================================================

class PlotlyRenderer {
    /**
     * Render portfolio equity curve
     */
    static renderEquityCurve(containerId, data, layout = {}) {
        const trace = {
            x: data.labels || [],
            y: data.values || [],
            type: 'scatter',
            mode: 'lines+markers',
            line: {
                color: '#bc8cff',
                width: 3,
                shape: 'spline',
            },
            fill: 'tozeroy',
            fillcolor: 'rgba(188, 140, 255, 0.1)',
            name: 'Kasa Büyümesi',
        };

        const defaultLayout = {
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            font: { color: '#8b949e', family: 'Inter' },
            margin: { t: 10, b: 40, l: 40, r: 10 },
            xaxis: {
                showgrid: true,
                gridcolor: 'rgba(255,255,255,0.05)',
            },
            yaxis: {
                showgrid: true,
                gridcolor: 'rgba(255,255,255,0.05)',
                tickprefix: '$',
            },
            ...layout,
        };

        Plotly.newPlot(containerId, [trace], defaultLayout, {
            responsive: true,
            displayModeBar: false,
        });
    }

    /**
     * Render allocation pie chart
     */
    static renderAllocationChart(containerId, portfolio) {
        const data = [{
            values: [
                portfolio.free_margin || 0,
                portfolio.used_margin || 0,
                portfolio.unrealized_pnl || 0,
            ],
            labels: ['Free Margin', 'Used Margin', 'Unrealized PnL'],
            type: 'pie',
            hole: 0.4,
            marker: {
                colors: ['#2ea043', '#bc8cff', '#f39c12'],
            },
            textinfo: 'label+percent',
            textposition: 'outside',
        }];

        const layout = {
            paper_bgcolor: 'transparent',
            font: { color: '#8b949e', family: 'Inter' },
            margin: { t: 0, b: 0, l: 0, r: 0 },
            showlegend: true,
            legend: {
                orientation: 'h',
                y: -0.1,
            },
        };

        Plotly.newPlot(containerId, data, layout, {
            responsive: true,
            displayModeBar: false,
        });
    }

    /**
     * Render feature importance (horizontal bar)
     */
    static renderFeatureImportance(containerId, importance) {
        const keys = Object.keys(importance).sort((a, b) => importance[a] - importance[b]);
        const values = keys.map(k => importance[k]);

        const trace = {
            x: values,
            y: keys.map(k => k.length > 20 ? k.substring(0, 20) + '...' : k),
            type: 'bar',
            orientation: 'h',
            marker: {
                color: '#bc8cff',
            },
        };

        const layout = {
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            font: { color: '#8b949e', family: 'Inter' },
            margin: { t: 10, b: 10, l: 150, r: 10 },
            xaxis: {
                showgrid: true,
                gridcolor: 'rgba(255,255,255,0.05)',
                title: 'Importance',
            },
            yaxis: {
                showgrid: false,
                automargin: true,
            },
        };

        Plotly.newPlot(containerId, [trace], layout, {
            responsive: true,
            displayModeBar: false,
        });
    }

    /**
     * Destroy Plotly chart
     */
    static destroy(containerId) {
        Plotly.purge(containerId);
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { ChartRenderer, PlotlyRenderer };
