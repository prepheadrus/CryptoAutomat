// Menü / Sekme (Tab) Değiştirme Mantığı
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

            // Sekmelere özel işlemler
            if (targetId === 'tab-history') {
                fetchTradeHistory();
            }
            if (targetId === 'tab-ml') {
                fetchAnalysableSymbols();
                loadMLTrainingSymbols(); // ML Training için sembolleri yükle
                // Eğitim geçmişini yükle (sekme açıldıktan sonra)
                setTimeout(() => loadTrainingHistory(), 100);
            }
            if (targetId === 'tab-settings' || targetId === 'tab-strategies') {
                fetchStrategies();
            }
            if (targetId === 'tab-data') {
                fetchMarkets();
            }
            if (targetId === 'tab-strategy-builder') {
                // Strateji Oluşturucu sekmesi açıldığında
                loadStrategies(); // Kaydedilmiş stratejileri yükle
            }
        });
    });
}

// --- MARKET SEÇİMİ VE YÖNETİMİ ---
let allMarkets = [];
let trackedSymbols = [];

async function fetchMarkets() {
    try {
        const [mRes, sRes] = await Promise.all([
            fetch('/api/v1/exchange/markets'),
            fetch('/api/v1/config/symbols')
        ]);
        const mData = await mRes.json();
        const sData = await sRes.json();

        allMarkets = mData.markets;
        trackedSymbols = sData.symbols;

        renderMarketList();

        // Arama ve Filtreleme Listener'ları (Sadece 1 kere ekle)
        const searchInput = document.getElementById('market-search');
        const filterSelect = document.getElementById('market-type-filter');

        if (!searchInput.hasListener) {
            searchInput.addEventListener('input', renderMarketList);
            filterSelect.addEventListener('change', renderMarketList);
            searchInput.hasListener = true;
        }
    } catch (e) { console.error("Market Listesi Hatası:", e); }
}

function renderMarketList() {
    const container = document.getElementById('market-selection-list');
    const searchTerm = document.getElementById('market-search').value.toLowerCase();
    const typeFilter = document.getElementById('market-type-filter').value;

    container.innerHTML = '';

    const filtered = allMarkets.filter(m => {
        const matchesSearch = m.symbol.toLowerCase().includes(searchTerm);
        const matchesType = typeFilter === 'all' || m.type === typeFilter;
        return matchesSearch && matchesType;
    });

    if (filtered.length === 0) {
        container.innerHTML = '<p style="grid-column:span 4; text-align:center; padding:20px; color:var(--text-muted);">Eşleşen market bulunamadı.</p>';
        return;
    }

    filtered.forEach(m => {
        const isTracked = trackedSymbols.includes(m.symbol);
        const item = document.createElement('div');
        item.className = `market-item ${isTracked ? 'selected' : ''}`;
        item.style.cursor = 'pointer';
        item.style.padding = '8px 12px';
        item.style.borderRadius = '6px';
        item.style.marginBottom = '4px';
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.gap = '10px';
        item.style.background = isTracked ? 'rgba(88, 166, 255, 0.1)' : 'transparent';

        // Satırın kendisine tıklayınca DOWNLOAD için seçer
        item.onclick = (e) => {
            if (e.target.type !== 'checkbox') {
                selectForDownload(m.symbol, m.type);
            }
        };

        item.innerHTML = `
            <input type="checkbox" ${isTracked ? 'checked' : ''} onchange="toggleLocalSymbol('${m.symbol}', this)" style="cursor:pointer;">
            <div style="flex:1;">
                <div style="font-weight:bold; font-size:0.9rem;">${m.symbol}</div>
                <div style="font-size:0.7rem; color:var(--text-muted);">${m.type.toUpperCase()}</div>
            </div>
        `;
        container.appendChild(item);
    });
}

function selectForDownload(symbol, type) {
    const display = document.getElementById('selected-symbol-val');
    if (display) {
        display.innerText = symbol;
        display.dataset.type = type; // Tipi sakla (spot/swap)
        display.style.color = 'var(--neon-green)';
        checkHistoryStatus(); // Hemen veritabanı durumunu sorgula
    }
}

function toggleLocalSymbol(symbol, cb) {
    if (cb.checked) {
        if (!trackedSymbols.includes(symbol)) trackedSymbols.push(symbol);
        cb.closest('.market-item').classList.add('selected');
    } else {
        trackedSymbols = trackedSymbols.filter(s => s !== symbol);
        cb.closest('.market-item').classList.remove('selected');
    }
}

async function saveMarketSelection() {
    const btn = event.target;
    const originalText = btn.innerText;

    try {
        btn.innerText = '⚠️ Güncelleniyor...';
        btn.disabled = true;

        const res = await fetch('/api/v1/config/symbols', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbols: trackedSymbols })
        });
        const result = await res.json();

        if (result.status === 'success') {
            btn.innerText = '✅ Başarıyla Kaydedildi!';
            setTimeout(() => {
                btn.innerText = originalText;
                btn.disabled = false;
                fetchStrategies(); // Strateji tablosunu da güncelle (yeni coinler için)
                fetchBotData();
            }, 1500);
        }
    } catch (e) {
        console.error("Kaydetme Hatası:", e);
        btn.innerText = '❌ Hata!';
        btn.disabled = false;
    }
}

function initChart() {
    const trace1 = {
        x: ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', 'Canlı'],
        y: [10000, 10150, 10120, 10300, 10450, 10540],
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#bc8cff', width: 3, shape: 'spline' },
        fill: 'tozeroy',
        fillcolor: 'rgba(188, 140, 255, 0.1)',
        name: 'Kasa Büyümesi'
    };
    Plotly.newPlot('plotly-chart', [trace1], {
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: { color: '#8b949e', family: 'Inter' },
        margin: { t: 10, b: 40, l: 40, r: 10 },
        xaxis: { showgrid: true, gridcolor: 'rgba(255,255,255,0.05)' },
        yaxis: { showgrid: true, gridcolor: 'rgba(255,255,255,0.05)', tickprefix: '$' }
    }, { responsive: true, displayModeBar: false });
}

async function fetchBotData() {
    try {
        // Sistem Durumu
        const statusRes = await fetch('/api/v1/status');
        const statusData = await statusRes.json();
        const envEl = document.getElementById('env-status');
        if (envEl) {
            envEl.innerText = statusData.environment.toUpperCase() + ' MODE';
            envEl.classList.add('neon-text');
        }
        document.getElementById('exchange-val').innerText = statusData.exchange.toUpperCase();

        // --- SİSTEM DURUM ÖZETİ (AKTİF EMİRLER SAYFASI İÇİN) ---
        const statusSummary = document.getElementById('system-status-summary');

        if (statusSummary) {
            // Strateji bilgilerini al
            const stratRes = await fetch('/api/v1/strategies');
            const stratData = await stratRes.json();

            const symbols = statusData.tracking_symbols || [];

            // SADECE AKTİF STRATEJİLERİ GÖSTER (strategy_id boş olmayanlar)
            const activeSymbols = symbols.filter(sym => {
                const activeStrategy = stratData.active_strategies[sym] || '';
                return activeStrategy && activeStrategy !== '';
            });

            if (activeSymbols.length === 0) {
                statusSummary.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: var(--text-muted); grid-column: span 100%;">
                        📭 Henüz aktif strateji yok
                    </div>
                `;
            } else {
                // Dashboard metriklerini al (latest_decisions için gerekli)
                const metricsRes = await fetch('/api/v1/dashboard-metrics');
                const metricsData = await metricsRes.json();
                const metrics = metricsData;

                // MEVCUT KARTLARI GÜNCELLE (Yeniden oluşturma yerine)
                const existingCards = statusSummary.querySelectorAll('.system-status-card');
                const cardMap = new Map();

                // Mevcut kartları sembole göre map'le
                existingCards.forEach(card => {
                    const symbolEl = card.querySelector('.status-symbol');
                    if (symbolEl) {
                        cardMap.set(symbolEl.textContent, card);
                    }
                });

                // Yeni semboller için kartları güncelle veya oluştur
                activeSymbols.forEach((sym, index) => {
                    const activeStrategy = stratData.active_strategies[sym] || 'trend_master';
                    const activeTimeframe = stratData.active_timeframes[sym] || '1m';
                    const marketType = stratData.market_types[sym] || 'swap';
                    const marginType = stratData.margin_types[sym] || 'isolated';

                    // Strateji adını bul
                    const strategyInfo = stratData.strategies.find(s => s.id === activeStrategy);
                    const strategyName = strategyInfo ? strategyInfo.name : 'Unknown';

                    // Son kararı bul
                    const decision = metrics.latest_decisions ? metrics.latest_decisions[sym] : null;
                    const signalText = decision ?
                        (decision.signal_val === 2 ? '🟢 AL' : decision.signal_val === 0 ? '🔴 SAT' : '⚪ BEKLE') :
                        '⚪ Başlatılıyor...';
                    const signalColor = decision ?
                        (decision.signal_val === 2 ? '#2ea043' : decision.signal_val === 0 ? '#f85149' : '#8b949e') :
                        '#8b949e';

                    // Mevcut kartı bul veya yeni oluştur
                    let card = cardMap.get(sym);

                    if (!card) {
                        // Yeni kart oluştur
                        card = document.createElement('div');
                        card.className = 'system-status-card';
                        statusSummary.appendChild(card);
                    }

                    // İçeriği güncelle (kompakt - tüm bilgiler)
                    card.innerHTML = `
                        <div class="status-card-header-compact">
                            <span class="status-symbol">${sym.replace('/USDT', '')}</span>
                            <span class="status-signal" style="color: ${signalColor}; font-weight: 700; font-size: 0.75rem;">${signalText}</span>
                        </div>
                        <div class="status-card-body-compact">
                            <div class="status-row-compact">
                                <span class="status-label">🤖</span>
                                <span class="status-value" title="${strategyName}">${strategyName.split(' ')[0]}</span>
                            </div>
                            <div class="status-row-compact">
                                <span class="status-label">⏱️</span>
                                <span class="status-value">${activeTimeframe}</span>
                            </div>
                            <div class="status-row-compact">
                                <span class="status-label">💰</span>
                                <span class="status-value" title="${marketType === 'spot' ? 'Spot' : 'Futures'}">${marketType.toUpperCase()}</span>
                            </div>
                            <div class="status-row-compact">
                                <span class="status-label">🔒</span>
                                <span class="status-value" title="${marginType === 'isolated' ? 'İzole Marjin' : 'Çapraz Marjin'}">${marginType.toUpperCase()}</span>
                            </div>
                        </div>
                    `;

                    // Map'ten kaldır
                    cardMap.delete(sym);
                });

                // Kullanılmayan kartları sil
                cardMap.forEach((card, sym) => {
                    card.remove();
                });
            }
        }

        const res = await fetch('/api/v1/dashboard-metrics');
        const metrics = await res.json();
        const p = metrics.portfolio;

        // --- PORTFÖY ANALİZİ SEKME GÜNCELLEMELERİ ---
        if (document.getElementById('realized-pnl')) {
            document.getElementById('total-balance').innerText = '$' + p.equity.toLocaleString(undefined, { minimumFractionDigits: 2 });
            document.getElementById('realized-pnl').innerText = (p.total_pnl >= 0 ? '+$' : '-$') + Math.abs(p.total_pnl).toFixed(2);
            document.getElementById('realized-pnl').className = p.total_pnl >= 0 ? 'success-text' : 'danger-text';

            document.getElementById('daily-roi').innerText = '%' + p.daily_roi_percent;
            document.getElementById('roi-status').innerText = p.daily_roi_percent >= 0 ? 'Piyasa Üstü Performans' : 'Risk Yönetimi Devrede';
            document.getElementById('roi-status').className = p.daily_roi_percent >= 0 ? 'success-text' : 'warning-text';

            // İleri Düzey İstatistikler
            document.getElementById('stat-profit-factor').innerText = p.profit_factor;
            document.getElementById('stat-drawdown').innerText = p.max_drawdown + '%';
            document.getElementById('stat-sharpe').innerText = p.sharpe_ratio;

            // Isı Haritası ve Dağılım Grafiği
            renderMarketHeatmap(metrics.latest_decisions);
            renderAllocationChart(p);
        }

        // --- ÜST PERFORMANS PANELİ (Orders sekmesi için) ---
        if (document.getElementById('perf-balance')) {
            document.getElementById('perf-balance').innerText = '$' + p.total_balance.toLocaleString(undefined, { minimumFractionDigits: 2 });
            document.getElementById('perf-equity').innerText = '$' + p.equity.toLocaleString(undefined, { minimumFractionDigits: 2 });
            document.getElementById('perf-count').innerText = metrics.open_positions.length;
            document.getElementById('perf-winrate').innerText = p.win_rate + '%';
            document.getElementById('perf-total-trades').innerText = p.total_trades;
            document.getElementById('perf-total-pnl').innerText = (p.total_pnl >= 0 ? '+$' : '-$') + Math.abs(p.total_pnl).toFixed(2);
            document.getElementById('perf-total-fees').innerText = '$' + p.total_commission.toFixed(2);

            // MARKET REGIME UPDATE
            const regimeEl = document.getElementById('perf-regime');
            if (regimeEl && p.market_regime) {
                regimeEl.innerText = p.market_regime.replace('_', ' ');
                const iconEl = document.getElementById('perf-regime-icon');

                if (p.market_regime === 'TRENDING_BULL') {
                    regimeEl.style.color = '#00ff88';
                    iconEl.innerHTML = '🚀';
                } else if (p.market_regime === 'TRENDING_BEAR') {
                    regimeEl.style.color = '#ff3366';
                    iconEl.innerHTML = '📉';
                } else if (p.market_regime === 'RANGING') {
                    regimeEl.style.color = '#ffcc00';
                    iconEl.innerHTML = '↔️';
                } else if (p.market_regime === 'SQUEEZE_PRE_TREND') {
                    regimeEl.style.color = '#bc8cff';
                    iconEl.innerHTML = '🌀';
                }
            }
        }

        // --- SERMAYE KULLANIMI --- (Yeni)
        if (document.getElementById('usage-used-margin')) {
            document.getElementById('usage-used-margin').innerText = '$' + p.used_margin.toLocaleString();
            document.getElementById('usage-free-margin').innerText = '$' + p.free_margin.toLocaleString();
            document.getElementById('usage-notional').innerText = '$' + p.total_notional.toLocaleString();
            document.getElementById('usage-leverage').innerText = p.avg_leverage + 'x';
        }

        // --- AKILLI KARAR KARTLARI ---
        const decGrid = document.getElementById('decision-grid');
        if (decGrid) {
            const decisions = metrics.latest_decisions || {};

            // MEVCUT KARTLARI KORU (Yeniden oluşturma yerine)
            const existingCards = decGrid.querySelectorAll('.decision-card-multi');
            const cardMap = new Map();

            // Mevcut kartları sembole göre map'le
            existingCards.forEach(card => {
                const symbolEl = card.querySelector('strong');
                if (symbolEl) {
                    cardMap.set(symbolEl.textContent, card);
                }
            });

            // Yeni kararlar için kartları güncelle veya oluştur
            if (Object.keys(decisions).length > 0) {
                for (const sym in decisions) {
                    const dec = decisions[sym];
                    let sigText = "HOLD"; let sigColor = "var(--text-muted)";
                    if (dec.signal_val === 2) { sigText = "LONG"; sigColor = "var(--neon-green)"; }
                    if (dec.signal_val === 0) { sigText = "SHORT"; sigColor = "var(--neon-red)"; }

                    const isAdaptive = dec.bot_name === "Adaptive Koncorde X";
                    const metricsHtml = isAdaptive ? `
                        <div class="mini-item"><span>Koncorde (A/V):</span> <strong>${dec.azul} / ${dec.verde}</strong></div>
                        <div class="mini-item"><span>Kalman / VIX:</span> <strong>${dec.kalman.toFixed(1)} / ${dec.vix}</strong></div>
                    ` : `
                        <div class="mini-item"><span>RSI/ATR:</span> <strong>${dec.rsi} / ${dec.atr.toFixed(2)}</strong></div>
                        <div class="mini-item"><span>EMA 5/13:</span> <strong>${dec.ema_5} / ${dec.ema_13}</strong></div>
                    `;

                    // Mevcut kartı bul veya yeni oluştur
                    let card = cardMap.get(sym);

                    if (!card) {
                        // Yeni kart oluştur
                        card = document.createElement('div');
                        card.className = "card glass-panel decision-card-multi";
                        decGrid.appendChild(card);
                    }

                    // İçeriği güncelle
                    card.innerHTML = `
                        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                            <strong style="color:var(--neon-blue)">${dec.symbol}</strong>
                            <span style="font-size:0.7rem; color:var(--text-muted)">via ${dec.bot_name}</span>
                        </div>
                        <div style="margin-bottom:10px; font-size:1.1rem; font-family:monospace">$${dec.price.toFixed(2)}</div>
                        <div class="mini-metrics">
                            ${metricsHtml}
                        </div>
                        <div class="cf-bar">
                            <div class="cf-fill" style="width:${dec.ml_conf}%"></div>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
                            <span style="font-size:0.75rem; color:var(--text-muted)">%${dec.ml_conf} Güven</span>
                            <strong style="color:${sigColor}">${sigText}</strong>
                        </div>
                    `;

                    // Map'ten kaldır
                    cardMap.delete(sym);
                }
            }

            // Kullanılmayan kartları sil
            cardMap.forEach(card => {
                card.remove();
            });
        }

        // --- DETAYLI POZİSYON TABLOSU --- (Güncellendi)
        const tbody = document.getElementById('positions-body');
        if (tbody) {
            tbody.innerHTML = '';
            if (metrics.open_positions.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color:var(--text-muted); padding:30px;">Açık pozisyon yok. Makine fırsat kolluyor...</td></tr>';
            } else {
                metrics.open_positions.forEach((pos, idx) => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td style="color:var(--text-muted)">#${idx + 1}</td>
                        <td>
                            <div class="${pos.direction === 'LONG' ? 'success-text' : 'danger-text'}" style="font-weight:bold;">
                                ${pos.direction === 'LONG' ? '🚀 LONG' : '🔻 SHORT'}
                            </div>
                            <div style="font-size:0.7rem; color:var(--text-muted)">${pos.symbol}</div>
                        </td>
                        <td>
                            <div>${pos.size.toFixed(4)}</div>
                            <div class="timeframe-tag" style="display:inline-block; font-size:0.65rem;">${pos.leverage}x</div>
                        </td>
                        <td>
                            <div>$${pos.entry_price.toFixed(2)}</div>
                            <div style="font-size:0.7rem; color:var(--text-muted)">Val: $${pos.notional_value.toFixed(2)}</div>
                        </td>
                        <td>
                            <div>$${pos.current_price.toFixed(2)}</div>
                            <div class="${pos.unrealized_usd >= 0 ? 'success-text' : 'danger-text'}">
                                ${pos.unrealized_usd >= 0 ? '+' : ''}$${pos.unrealized_usd.toFixed(2)}
                            </div>
                        </td>
                        <td class="${pos.pnl_percent >= 0 ? 'success-text' : 'danger-text'}" style="font-weight:bold;">
                            ${pos.pnl_percent.toFixed(2)}%
                        </td>
                        <td>
                            <span class="target-badge target-tp">TP: $${pos.take_profit.toFixed(2)}</span>
                            <span class="target-badge target-sl">SL: $${pos.stop_loss.toFixed(2)}</span>
                            <span class="target-badge target-liq">Liq: $${pos.liquidation_price.toFixed(2)}</span>
                        </td>
                        <td>
                            <button class="btn-close-pos" onclick="closePosition('${pos.symbol}')">KAPAT</button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        }
    } catch (e) {
        console.error("Dashboard Güncelleme Hatası:", e);
    }
}

async function closePosition(symbol) {
    if (!confirm(`${symbol} pozisyonunu kapatmak istediğinize emin misiniz?`)) return;
    try {
        const res = await fetch('/api/v1/position/close', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol: symbol })
        });
        const result = await res.json();
        if (result.status === 'success') {
            fetchBotData();
        }
    } catch (e) { console.error("Kapatma Hatası:", e); }
}

async function fetchTradeHistory() {
    try {
        const res = await fetch('/api/v1/trade-history');
        const data = await res.json();
        const tbody = document.getElementById('history-body');
        tbody.innerHTML = '';
        if (data.trades) {
            data.trades.forEach(t => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="font-size:0.75rem">${new Date(t.timestamp).toLocaleString()}</td>
                    <td>${t.symbol}</td>
                    <td>G: ${t.entry_price.toFixed(2)} <br> Ç: ${t.exit_price.toFixed(2)}</td>
                    <td class="${t.pnl_usd >= 0 ? 'success-text' : 'danger-text'}">$${t.pnl_usd.toFixed(2)}</td>
                    <td>${t.reason}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (e) { console.error("Geçmiş Hatası:", e); }
}

async function fetchStrategies() {
    try {
        const [stratRes, dbRes] = await Promise.all([
            fetch('/api/v1/strategies'),
            fetch('/api/v1/data/symbols-with-data')
        ]);
        const data = await stratRes.json();
        const dbData = await dbRes.json();

        // 1. Strateji Atama Tablosu
        const tbody = document.getElementById('strategy-allocation-body');
        if (tbody) {
            tbody.innerHTML = '';
            if (!dbData.symbols || dbData.symbols.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted);">⚠️ DB\'de henüz veri bulunamadı. Önce "Veri Laboratuvarı"ndan veri indirin.</td></tr>';
            } else {
                tbody.innerHTML = '';
                const uniqueSymbols = [...new Set(dbData.symbols)];
                uniqueSymbols.forEach(symbol => {
                    const symActiveId = data.active_strategies[symbol] || "";
                    const symActiveTf = data.active_timeframes ? (data.active_timeframes[symbol] || "1m") : "1m";
                    const activeStrategy = data.strategies.find(s => s.id === symActiveId);
                    const activeStrategyName = activeStrategy ? activeStrategy.name : "Atanalı Değil";
                    const isActuallyRunning = !!symActiveId;

                    const timeframes = ["1m", "3m", "5m", "10m", "15m", "20m", "30m", "45m", "1h", "2h", "3h", "4h", "6h", "8h", "12h", "1d"];

                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td style="font-weight:bold; color:var(--neon-blue)">${symbol}</td>
                        <td style="font-size:0.8rem">${activeStrategyName} <br><small class="text-muted">${symActiveTf}</small></td>
                        <td>
                            <div style="display:flex; gap:5px;">
                                <select class="strategy-select" id="strat-sel-${symbol.replace('/', '-')}" style="min-width:120px;">
                                    <option value="">Bot Seç...</option>
                                    ${data.strategies.map(s => `<option value="${s.id}" ${s.id === symActiveId ? 'selected' : ''}>${s.name}</option>`).join('')}
                                </select>
                                <select class="strategy-select" id="tf-sel-${symbol.replace('/', '-')}" style="width:70px;">
                                    ${timeframes.map(tf => `<option value="${tf}" ${tf === symActiveTf ? 'selected' : ''}>${tf}</option>`).join('')}
                                </select>
                                <select class="strategy-select" id="market-sel-${symbol.replace('/', '-')}" style="width:80px;">
                                    <option value="swap" ${(data.market_types && data.market_types[symbol] === 'swap') ? 'selected' : ''}>Vadeli</option>
                                    <option value="spot" ${(data.market_types && data.market_types[symbol] === 'spot') ? 'selected' : ''}>Spot</option>
                                </select>
                                <select class="strategy-select" id="margin-sel-${symbol.replace('/', '-')}" style="width:80px;">
                                    <option value="isolated" ${(data.margin_types && data.margin_types[symbol] === 'isolated') ? 'selected' : ''}>İzole</option>
                                    <option value="cross" ${(data.margin_types && data.margin_types[symbol] === 'cross') ? 'selected' : ''}>Çapraz</option>
                                </select>
                            </div>
                        </td>
                        <td>
                            <div style="display:flex; gap:5px; flex-wrap:wrap;">
                                <button class="btn btn-primary" style="padding:4px 8px; font-size:0.7rem;"
                                    onclick="window.selectStrategy('${symbol}')" title="Stratejiyi Uygula ve Başlat">▶ Uygula</button>
                                <button class="btn btn-danger" style="padding:4px 8px; font-size:0.7rem;"
                                    onclick="window.stopStrategy('${symbol}')" title="Botu Durdur">⏹ Durdur</button>
                                <button class="btn btn-success" style="padding:4px 8px; font-size:0.7rem;"
                                    onclick="window.restartStrategy('${symbol}')" title="Botu Yeniden Başlat">🔄 Yeniden Başlat</button>
                            </div>
                        </td>
                        <td><span class="${isActuallyRunning ? 'success-text' : 'text-muted'}" id="status-${symbol.replace('/', '-')}">${isActuallyRunning ? '● Aktif' : '○ Bekliyor'}</span></td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        }

        // 2. Strateji Kütüphanesi (Dokümantasyon)
        const libContainer = document.getElementById('strategy-library-container');
        if (libContainer) {
            libContainer.innerHTML = '';
            data.strategies.forEach(s => {
                const card = document.createElement('div');
                card.className = 'card glass-panel';
                card.style.borderLeft = `4px solid var(--neon-blue)`;
                card.style.transition = 'transform 0.2s';
                card.style.cursor = 'default';

                // Stratejiye özel detayları (göstergeler vs) tahmin ederek veya meta veriden çekerek ekleyelim
                let techDetails = "";
                if (s.id === 'trend_master') {
                    techDetails = `
                        <div style="margin-top:10px; font-size:0.75rem;">
                            <div style="margin-bottom:5px;"><b>🔍 Göstergeler:</b> EMA (200), SMA (20), RSI (14)</div>
                            <div style="margin-bottom:5px;"><b>📈 Giriş Mantığı:</b> Fiyat EMA 200 üzerindeyken SMA 20'yi yukarı keserse ve RSI 50-70 arasındaysa LONG girer.</div>
                            <div><b>🛡️ Risk:</b> 3.5x ATR Stop-Loss, 2.0x TP.</div>
                        </div>`;
                } else if (s.id === 'scalper_ninja') {
                    techDetails = `
                        <div style="margin-top:10px; font-size:0.75rem;">
                            <div style="margin-bottom:5px;"><b>🔍 Göstergeler:</b> EMA (5), EMA (13), RSI (14)</div>
                            <div style="margin-bottom:5px;"><b>📉 Giriş Mantığı:</b> EMA 5, EMA 13'ü yukarı kestiğinde RSI boğa bölgesindeyse hızlı kâr odaklı LONG girer.</div>
                            <div><b>🛡️ Risk:</b> 1.5x ATR Dar Stop, 1.5x TP.</div>
                        </div>`;
                } else if (s.id === 'adaptive_koncorde') {
                    techDetails = `
                        <div style="margin-top:10px; font-size:0.75rem;">
                            <div style="margin-bottom:5px;"><b>🔍 Göstergeler:</b> Kalman Filtresi, Koncorde (PVI/NVI), BTC VIX, EWO</div>
                            <div style="margin-bottom:5px;"><b>📉 Giriş Mantığı:</b> VIX'e göre dinamik eşik belirler. Akıllı Para (Azul) ve Küçük Yatırımcı (Verde) ters korelasyonu (Ayna Modeli) ve Kalman trendini takip eder.</div>
                            <div><b>🛡️ Risk:</b> 2.5x ATR Esnek Stop, 3.0x TP.</div>
                        </div>`;
                }

                card.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <h4 style="color:var(--neon-blue); margin:0;">${s.name}</h4>
                        <span style="font-size:0.6rem; padding:2px 6px; border-radius:4px; background:rgba(255,255,255,0.05); color:var(--text-muted);">v1.0</span>
                    </div>
                    <p style="font-size:0.8rem; margin:10px 0; line-height:1.4;">${s.desc}</p>
                    <div style="background:rgba(0,0,0,0.2); padding:10px; border-radius:8px; border:1px solid rgba(255,255,255,0.03);">
                        ${techDetails || `<p style="font-size:0.75rem; color:var(--text-muted); font-style:italic;">Teknik detaylar hazırlanıyor...</p>`}
                    </div>
                `;
                libContainer.appendChild(card);
            });
        }
    } catch (e) { console.error("Strateji Listeleme Hatası:", e); }
}

window.selectStrategy = async function (symbol) {
    const stratEl = document.getElementById(`strat-sel-${symbol.replace('/', '-')}`);
    const tfEl = document.getElementById(`tf-sel-${symbol.replace('/', '-')}`);
    const marketEl = document.getElementById(`market-sel-${symbol.replace('/', '-')}`);
    const marginEl = document.getElementById(`margin-sel-${symbol.replace('/', '-')}`);
    const statusEl = document.getElementById(`status-${symbol.replace('/', '-')}`);

    const strategyId = stratEl.value;
    const timeframe = tfEl.value;
    const marketType = marketEl.value;
    const marginType = marginEl.value;

    if (!strategyId) {
        alert("Lütfen bir strateji (bot) seçin!");
        return;
    }

    // FAZ 2: MODEL TIMEFRAME KONTROLÜ (GÜVENLİK KALKANI)
    // Kullanıcı botu başlatmadan önce model-frame uyumluluğunu kontrol et
    const modelCheck = await checkModelCompatibility(symbol, timeframe);

    if (!modelCheck.compatible) {
        // Model yok veya timeframe uyuşmuyor - kullanıcıyı uyar
        showErrorToast(
            `⚠️ <strong>Model Bulunamadı!</strong><br>${modelCheck.error}`,
            8000
        );

        // Yine de devam etmek istiyor mu? (ML olmadan çalışacak)
        const confirmContinue = confirm(
            `⚠️ UYARI: ${symbol} için ${timeframe} timeframe'inde eğitilmiş ML modeli bulunamadı.\n\n` +
            `Bot ML olmadan (sadece teknik indikatörlerle) çalışacak.\n\n` +
            `Devam etmek istiyor musunuz?\n\n` +
            `İPTAL: Botu başlatma\n` +
            `TAMAM: ML olmadan devam et`
        );

        if (!confirmContinue) {
            statusEl.innerText = '● İptal';
            statusEl.className = 'danger-text';
            return;
        }
    }

    try {
        statusEl.innerText = '● Atanıyor...';
        statusEl.className = 'warning-text'; // Sarımsı bir renk (CSS'e eklenebilir)

        const res = await fetch('/api/v1/strategy/select', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                strategy_id: strategyId,
                symbol: symbol,
                timeframe: timeframe,
                market_type: marketType,
                margin_type: marginType
            })
        });
        const result = await res.json();
        if (result.status === 'success') {
            console.log("Strateji ve Periyot başarıyla atandı:", result.symbol, result.active_timeframe);

            // Kullanıcıya bilgi ver (ML varsa veya yoksa)
            if (modelCheck.compatible) {
                showErrorToast(`✅ <strong>${symbol}</strong> başlatıldı!<br>ML Model: ${timeframe} timeframe için hazır.`, 3000);
            } else {
                showErrorToast(`⚠️ <strong>${symbol}</strong> başlatıldı!<br>ML olmadan çalışıyor (sadece indikatörler).`, 5000);
            }

            setTimeout(() => {
                fetchStrategies(); // Tabloyu tazele
                fetchBotData();
            }, 500);
        }
    } catch (e) {
        console.error("Strateji Seçim Hatası:", e);
        statusEl.innerText = '● Hata!';
        statusEl.className = 'danger-text';
        showErrorToast(`❌ Hata: ${e.message}`, 5000);
    }
}

function renderMarketHeatmap(decisions) {
    const container = document.getElementById('market-heatmap');
    if (!container || !decisions) return;

    container.innerHTML = '';
    for (const sym in decisions) {
        const data = decisions[sym];
        const box = document.createElement('div');
        box.className = 'heatmap-box';

        // Rastgele değişim simülasyonu veya gerçek veri (şuan veri yoksa 0.0)
        const chg = (Math.random() * 4 - 2).toFixed(2); // Örnek değişim
        const chgClass = chg >= 0 ? 'success-text' : 'danger-text';

        box.innerHTML = `
            <span class="sym">${sym}</span>
            <span class="price">$${data.price.toFixed(2)}</span>
            <span class="chg ${chgClass}">${chg >= 0 ? '+' : ''}${chg}%</span>
        `;
        container.appendChild(box);
    }
}

let allocationChart = null;
function renderAllocationChart(p) {
    const el = document.getElementById('allocation-chart');
    if (!el) return;

    const data = [{
        values: [p.free_margin, p.used_margin],
        labels: ['Nakit (Boş)', 'Marjin (İşlemde)'],
        type: 'pie',
        hole: .6,
        marker: {
            colors: ['#58a6ff', '#f85149']
        },
        textinfo: 'none'
    }];

    const layout = {
        showlegend: false,
        margin: { t: 0, b: 0, l: 0, r: 0 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        height: 180
    };

    if (!allocationChart) {
        Plotly.newPlot('allocation-chart', data, layout, { displayModeBar: false });
        allocationChart = true;
    } else {
        Plotly.react('allocation-chart', data, layout, { displayModeBar: false });
    }
}

// --- VERİ LABORATUVARI YÖNETİMİ ---

let statusRefreshInterval = null;
window.isDownloading = false;

async function checkHistoryStatus() {
    const symbol = document.getElementById('selected-symbol-val').innerText;
    const timeframe = document.getElementById('download-timeframe').value;
    const view = document.getElementById('history-status-view');

    if (!symbol || symbol === '-- SEÇİNİZ --') return;

    try {
        const res = await fetch(`/api/v1/data/history-status?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`);
        const data = await res.json();

        // Aktif görevleri alalım
        const tasksRes = await fetch('/api/v1/data/active-downloads');
        const tasks = await tasksRes.json();
        const isActive = symbol in tasks;
        const taskObj = tasks[symbol];

        const pContainer = document.getElementById('progress-container');
        const pBar = document.getElementById('progress-bar');
        const pText = document.getElementById('progress-text');
        const startBtn = document.getElementById('start-download-btn');
        const stopBtn = document.getElementById('stop-download-btn');

        // Buton ve İlerleme Görünümü Yönetimi (Veri durumundan bağımsız)
        let percent = "0";
        if (isActive) {
            if (startBtn) startBtn.style.display = 'none';
            if (stopBtn) stopBtn.style.display = 'block';

            if (data.status !== 'no_data') {
                const safeEndDate = data.end_date.replace(' ', 'T'); // Safari/Cross-browser fix
                const endTs = new Date(safeEndDate).getTime();
                const nowTs = new Date().getTime();
                const taskStartTs = Math.min(taskObj.target_start_ms, taskObj.since);
                const totalExpected = Math.max(1, nowTs - taskStartTs);
                const currentProgress = Math.max(0, endTs - taskStartTs);
                percent = Math.max(0, Math.min(100, (currentProgress / totalExpected) * 100)).toFixed(1);
            }

            if (pContainer) pContainer.style.display = 'block';
            if (pText) {
                pText.style.display = 'block';
                pText.innerText = `[${symbol}] Senkronize Ediliyor: %${percent} ${taskObj.status === 'paused' ? '(DURAKLATILDI)' : ''}`;
            }
            if (pBar) {
                pBar.style.width = percent + '%';
                pBar.style.background = taskObj.status === 'paused' ? '#f1c40f' : 'var(--neon-blue)';
            }

        } else if (Object.keys(tasks).length > 0) {
            // Başka bir şey inerken bu pariteye bakıyoruz
            const activeSymbol = Object.keys(tasks)[0];
            if (startBtn) startBtn.style.display = 'block';
            if (stopBtn) stopBtn.style.display = 'none';

            if (pContainer) pContainer.style.display = 'block';
            if (pText) {
                pText.style.display = 'block';
                pText.innerText = `⚠️ Şu an ${activeSymbol} (ve ${Object.keys(tasks).length - 1} diğer) indiriliyor... (İzleniyor: ${symbol})`;
            }
            if (pBar) pBar.style.width = '100%';
        } else {
            if (startBtn) startBtn.style.display = 'block';
            if (stopBtn) stopBtn.style.display = 'none';
            if (pContainer) pContainer.style.display = 'none';
            if (pText) pText.style.display = 'none';
        }

        if (data.status === 'no_data') {
            view.innerHTML = `
                <div style="text-align:center; padding:40px; color:var(--text-muted);">
                    <div style="font-size:2rem; margin-bottom:10px;">📉</div>
                    <div style="font-weight:700; color:var(--text-main); margin-bottom:5px; font-size:1.2rem;">${symbol}</div>
                    <p>Veritabanında bu parite için henüz hiçbir kayıt bulunamadı.</p>
                </div>`;
        } else {
            // Tarih ve saat parçalarını ayıran yardımcı fonksiyon
            const formatDateTime = (dtStr) => {
                if (!dtStr) return '--';
                const parts = dtStr.split(' ');
                return `<span style="font-size:1.1rem; font-weight:700; color:var(--text-main);">${parts[0]}</span> <span style="font-size:0.8rem; color:var(--text-muted); margin-left:5px;">${parts[1]}</span>`;
            };

            const formattedStart = formatDateTime(data.start_date);
            const formattedEnd = formatDateTime(data.end_date);

            view.innerHTML = `
                ${isActive ? `
                <div id="history-loader" style="position:absolute; top:10px; right:12px; display:flex; align-items:center; gap:8px;">
                    <div class="pulse-dot" style="width:8px; height:8px; background:${taskObj.status === 'paused' ? '#f1c40f' : 'var(--neon-green)'}"></div>
                    <span style="font-size:0.75rem; color:${taskObj.status === 'paused' ? '#f1c40f' : 'var(--neon-green)'}; font-weight:600; letter-spacing:0.5px;">${taskObj.status === 'paused' ? 'DURAKLATILDI' : 'ŞU AN İNDİRİLİYOR...'}</span>
                </div>` : ''}
                
                <div style="text-align:left; background:rgba(255,255,255,0.02); padding:20px; border-radius:12px; border: 1px solid rgba(255,255,255,0.05);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:12px;">
                        <div>
                            <div style="font-size:1.1rem; font-weight:800; color:var(--neon-blue);">${symbol}</div>
                            <div style="font-size:0.65rem; color:var(--text-muted); letter-spacing:1px; margin-top:2px;">VERİTABANI DURUMU</div>
                        </div>
                        <span style="font-size:0.65rem; padding:4px 10px; border-radius:15px; background:rgba(0,0,0,0.3); color:var(--text-muted); border:1px solid rgba(255,255,255,0.1)">
                            ${isActive ? `AKTİF: %${percent}` : 'İZLEME MODU'}
                        </span>
                    </div>

                    <div style="display:flex; flex-direction:column; gap:20px; position:relative; padding-left:18px; border-left:2px solid rgba(188, 140, 255, 0.2);">
                        <div style="position:relative;">
                            <div style="position:absolute; left:-24px; top:5px; width:10px; height:10px; border-radius:50%; background:var(--neon-blue); box-shadow:0 0 10px var(--neon-blue);"></div>
                            <div style="font-size:0.65rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px; font-weight:600;">Başlangıç Noktası (DB)</div>
                            <div>${formattedStart}</div>
                        </div>

                        <div style="position:relative;">
                            <div style="position:absolute; left:-24px; top:5px; width:10px; height:10px; border-radius:50%; background:var(--neon-green); box-shadow:0 0 12px var(--neon-green); ${window.isDownloading ? 'animation: pulse 1s infinite;' : ''}"></div>
                            <div style="font-size:0.65rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px; font-weight:600;">Güncel Uç Nokta</div>
                            <div>${formattedEnd}</div>
                        </div>
                    </div>

                    <div style="margin-top:20px; font-size:0.75rem; color:var(--text-muted); background:rgba(0,0,0,0.22); padding:12px; border-radius:8px; font-style:italic; border:1px solid rgba(255,255,255,0.03);">
                        ${window.isDownloading ?
                    '🚀 Veriler Binance üzerinden çekilerek yerel veritabanına işleniyor. Panel 5 saniyede bir otomatik güncellenir.' :
                    '✨ Bu sembol için seçili tarih aralığı yerel veritabanında kullanıma hazır durumdadır.'}
                    </div>
                </div>`;
        }
    } catch (e) {
        console.error("Geçmiş Sorgu Hatası:", e);
    }
}

async function startDownload() {
    const symbol = document.getElementById('selected-symbol-val').innerText;
    const timeframe = document.getElementById('download-timeframe').value;
    const startDate = document.getElementById('download-start-date').value;
    const btn = document.getElementById('start-download-btn');
    const originalText = btn.innerText;

    if (!symbol || symbol === '-- SEÇİNİZ --') {
        alert("Lütfen önce listeden bir sembol seçin.");
        return;
    }

    // Artık çoklu indirme destekleniyor!
    // Sadece AYNI sembol için mükerrer kontrolü backend'de yapılıyor.

    try {
        btn.disabled = true;
        btn.innerText = '⚙️ Görev Başlatıldı...';
        window.isDownloading = true;
        window.activeDownloadSymbol = symbol;

        const type = document.getElementById('selected-symbol-val').dataset.type || 'future';

        const res = await fetch('/api/v1/data/download-history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                symbol: symbol,
                timeframe: timeframe,
                start_date: startDate,
                market_type: type
            })
        });
        const result = await res.json();

        if (result.status === 'exists') {
            const confirmed = confirm(`⚠️ ${symbol} için zaten mevcut bir kayıt var.\nDurumu: ${result.task.status.toUpperCase()}\n\nEski kaydı TAMAMEN SİLİP yeni tarihle (${startDate}) baştan başlamak istiyor musunuz? \n\n(Not: İndirmeye devam etmek istiyorsanız aşağıdan "Yeniden Başlat" butonuna basınız.)`);
            if (confirmed) {
                // Önce eskiyi temizle
                await fetch('/api/v1/data/delete-task', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ symbol: symbol, with_data: true })
                });
                // Sonra yeni kaydı tetikle
                return startDownload();
            } else {
                btn.disabled = false;
                btn.innerText = originalText;
                return;
            }
        }

        if (result.status === 'started') {
            updateActiveTasks(); // Listeyi anında tazele
            checkHistoryStatus(); // Butonları ve görünümü anında güncelle
            // Eğer daha önce durdurulmuş bir durumu varsa hafızada, temizle
            if (statusRefreshInterval) clearInterval(statusRefreshInterval);
            statusRefreshInterval = setInterval(checkHistoryStatus, 5000);

            setTimeout(() => {
                btn.disabled = false;
                btn.innerText = originalText;
            }, 2000);
        }
    } catch (e) {
        console.error("İndirme Başlatma Hatası:", e);
        alert("İndirme görevi başlatılamadı.");
        btn.disabled = false;
        btn.innerText = originalText;
        window.isDownloading = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    initChart();
    fetchBotData();
    setInterval(fetchBotData, 5000);

    // Aktif görevleri takip et
    updateActiveTasks();
    setInterval(updateActiveTasks, 3000);
});
async function stopDownload(symbolToStopArg = null) {
    const symbolToStop = symbolToStopArg || window.activeDownloadSymbol || document.getElementById('selected-symbol-val').innerText;
    const btn = symbolToStopArg ? null : document.getElementById('stop-download-btn');

    try {
        if (btn) {
            btn.innerText = `🛑 ${symbolToStop} Durduruluyor...`;
            btn.disabled = true;
        }

        const res = await fetch('/api/v1/data/stop-download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol: symbolToStop })
        });
        const result = await res.json();

        if (result.status === 'success') {
            if (symbolToStop === window.activeDownloadSymbol) {
                window.isDownloading = false;
                window.activeDownloadSymbol = null;
            }
            updateActiveTasks(); // Listeyi hemen güncelle

            if (btn) {
                setTimeout(() => {
                    checkHistoryStatus();
                    btn.disabled = false;
                    btn.innerText = '🛑 İndirmeyi Durdur';
                }, 1000);
            }
        } else {
            alert(result.message);
        }
    } catch (e) {
        console.error("Durdurma Hatası:", e);
        if (btn) btn.disabled = false;
    }
}

async function togglePause(symbol) {
    try {
        const res = await fetch('/api/v1/data/toggle-pause', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol: symbol })
        });
        const result = await res.json();
        if (result.status === 'success') {
            updateActiveTasks();
        }
    } catch (e) {
        console.error("Pause Hatası:", e);
    }
}

async function updateActiveTasks() {
    const list = document.getElementById('active-tasks-list');
    const countDisplay = document.getElementById('active-tasks-count');
    if (!list) return;

    try {
        const res = await fetch('/api/v1/data/active-downloads');
        const tasks = await res.json();
        const symbols = Object.keys(tasks);
        countDisplay.innerText = `${symbols.length} Görev / Geçmiş`;

        if (symbols.length === 0) {
            list.innerHTML = `<p style="text-align:center; padding:20px; color:var(--text-muted); font-style:italic;">Şu an kayıtlı bir görev geçmişi bulunmuyor.</p>`;
            window.isDownloading = false;
            return;
        }

        let html = `
            <table style="width:100%; border-collapse: collapse; font-size:0.75rem; color:var(--text-main);">
                <thead>
                    <tr style="text-align:left; color:var(--text-muted); border-bottom:1px solid rgba(255,255,255,0.05);">
                        <th style="padding:10px;">Sembol</th>
                        <th style="padding:10px;">Aralık / İlerleme</th>
                        <th style="padding:10px;">Durum</th>
                        <th style="padding:10px; text-align:right;">İşlem</th>
                    </tr>
                </thead>
                <tbody>
        `;

        symbols.forEach(s => {
            const t = tasks[s];
            const now = new Date().getTime();
            const startPoint = (t.target_start_ms && t.target_start_ms > 0) ? Math.min(t.target_start_ms, (t.since || t.target_start_ms)) : (t.since || now);
            const total = Math.max(1, now - startPoint);
            const progress = Math.max(0, (t.current_ts || t.since || startPoint) - startPoint);
            let percent = ((progress / total) * 100);
            if (isNaN(percent)) percent = 0;
            percent = Math.max(0, Math.min(100, percent)).toFixed(1);

            const formatTs = (ts) => (ts && ts > 100000) ? new Date(ts).toLocaleDateString() + ' ' + new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';
            const isStarted = t.current_ts && t.current_ts > 0;
            const dateRange = `<b>Başlangıç:</b> ${t.start_date || formatTs(t.target_start_ms)} <br> <b>Son Veri:</b> ${isStarted ? formatTs(t.current_ts) : '<span style="color:#f39c12">Veri İ bekleniyor...</span>'}`;

            let statusColor = 'var(--neon-green)';
            if (t.status === 'paused') statusColor = '#f1c40f';
            if (t.status === 'stopped' || t.status === 'error' || t.status === 'completed') statusColor = t.status === 'completed' ? '#2ecc71' : '#e74c3c';

            html += `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.03); background:rgba(255,255,255,0.01);">
                    <td style="padding:10px; font-weight:700;">
                        <span style="color:${statusColor}">●</span> ${s}<br>
                        <span style="font-size:0.6rem; color:var(--text-muted);">${t.timeframe} | ${t.market_type.toUpperCase()}</span>
                    </td>
                    <td style="padding:10px;">
                        <div style="margin-bottom:5px; font-size:0.65rem; color:var(--text-muted); line-height:1.4;">${dateRange}</div>
                        <div style="background:rgba(0,0,0,0.3); height:4px; border-radius:2px; overflow:hidden;">
                            <div style="width:${percent}%; height:100%; background:${statusColor};" title="%${percent}"></div>
                        </div>
                    </td>
                    <td style="padding:10px;">
                        <span style="color:${statusColor}; font-weight:700; font-size:0.6rem; letter-spacing:0.5px;">${t.status.toUpperCase()}</span>
                    </td>
                    <td style="padding:10px; text-align:right;">
                        <div style="display:flex; gap:5px; justify-content:flex-end;">
                            ${(t.status === 'stopped' || t.status === 'completed' || t.status === 'error') ? `
                                <button onclick="resumeDownload('${s}', '${t.timeframe}', '${t.start_date}', '${t.market_type}')" 
                                        class="btn-select" style="padding:3px 8px; font-size:0.6rem; background:rgba(88, 166, 255, 0.1); color:var(--neon-blue); border:1px solid var(--neon-blue)33;">
                                    ${t.status === 'completed' ? '🔄 Güncelle' : '🔄 Devam Et'}
                                </button>
                                <button onclick="removeTaskPermanently('${s}')" class="btn-select" style="padding:3px 8px; font-size:0.6rem; background:rgba(255, 77, 77, 0.05); color:#ff4d4d;">
                                    🗑️ Sil
                                </button>
                            ` : `
                                <button onclick="togglePause('${s}')" class="btn-select" style="padding:3px 8px; font-size:0.6rem;">
                                    ${t.status === 'paused' ? '▶️' : '⏸️'}
                                </button>
                                <button onclick="stopDownload('${s}')" class="btn-select" title="Durdur" style="padding:3px 8px; font-size:0.6rem; background:rgba(255, 77, 77, 0.1); color:#ff4d4d; border:1px solid #ff4d4d33;">
                                    🛑 Durdur
                                </button>
                                <button onclick="removeTaskPermanently('${s}')" class="btn-select" title="Vazgeç ve Sil" style="padding:3px 8px; font-size:0.6rem; background:rgba(255, 255, 255, 0.05);">
                                    ❌ Vazgeç
                                </button>
                            `}
                        </div>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        list.innerHTML = html;
        window.isDownloading = symbols.some(s => tasks[s].status === 'running');

    } catch (e) {
        console.error("Görev Listesi Güncelleme Hatası:", e);
    }
}

async function resumeDownload(symbol, timeframe, startDate, marketType) {
    try {
        const res = await fetch('/api/v1/data/resume-download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol: symbol })
        });
        const result = await res.json();
        if (result.status === 'success') {
            updateActiveTasks();
            checkHistoryStatus();
        } else {
            console.error("Resume Hatası:", result.message);
        }
    } catch (e) {
        console.error("Resume Bağlantı Hatası:", e);
    }
}

async function removeTaskPermanently(symbol) {
    const withData = confirm(`🗑️ ${symbol} görev kaydını silmek üzeresiniz.\n\nAYNI ZAMANDA indirilmiş tüm grafikleri (klines) de veritabanından temizlemek ister misiniz? \n\n(Tamam = Her şeyi sil, İptal = Sadece görevi listeden kaldır)`);

    try {
        const res = await fetch('/api/v1/data/delete-task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                symbol: symbol,
                with_data: withData
            })
        });
        const result = await res.json();
        if (result.status === 'success') {
            console.log(result.message);
            updateActiveTasks(); // Listeyi hemen güncelle
        } else {
            alert(result.message);
        }
    } catch (e) {
        console.error("Kalıcı Silme Hatası:", e);
    }
}

let globalChartInstance = null;

async function runMLVisualAnalysis() {
    const symbolField = document.getElementById('ml-analysis-symbol');
    const stratField = document.getElementById('ml-analysis-strategy');
    const tfField = document.getElementById('ml-analysis-timeframe');
    const container = document.getElementById('ml-analysis-chart');
    const importanceContainer = document.getElementById('feature-importance-chart');

    if (!container || !importanceContainer || !symbolField || !stratField || !tfField) return;

    container.innerHTML = '<div class="loader-container" style="text-align:center; padding-top:100px; color:var(--neon-blue);"><span class="pulse-dot"></span> Simülasyon Motoru Hazırlanıyor...</div>';
    importanceContainer.innerHTML = '<div style="text-align:center; padding-top:100px; font-size:0.8rem;">İndikatörler Hesaplanıyor...</div>';

    const symbolValue = symbolField.value;
    const strategyId = stratField.value;
    const tfValue = tfField.value;

    const marketTypeField = document.getElementById('ml-analysis-market-type');
    const marginTypeField = document.getElementById('ml-analysis-margin-type');
    const marketType = marketTypeField ? marketTypeField.value : 'swap';
    const marginType = marginTypeField ? marginTypeField.value : 'isolated';

    if (!symbolValue) return;

    try {
        const encodedSymbol = encodeURIComponent(symbolValue);

        // ⚠️ DİKKAT: ML analizi için strateji başlatmıyoruz!
        // Sadece görselleştirme yapıyoruz, gerçek strateji değişikliği yapmıyoruz.
        // Eğer kullanıcı strateji değiştirmek isterse "Sistem Ayarları" sayfasını kullanmalı.

        const res = await fetch(`/api/v1/ml/visual-analysis?symbol=${encodedSymbol}&strategy_id=${strategyId}&timeframe=${tfValue}&limit=300`);
        const data = await res.json();

        if (data.status === 'error') {
            container.innerHTML = `<div style="color:var(--neon-error); text-align:center; padding-top:100px;">${data.message}</div>`;
            return;
        }

        const candles = data.candles || [];
        const mlPredictions = data.ml_predictions || [];
        const stratSignals = data.strategy_signals || [];
        const importance = data.feature_importance || {};

        if (candles.length === 0) {
            container.innerHTML = `<div style="color:var(--text-muted); text-align:center; padding-top:100px;">Bu parite için henüz veri yok.</div>`;
            return;
        }

        // Temizle ve Eski Grafiği Yok Et (LWC Bellek Yönetimi)
        if (globalChartInstance) {
            try { globalChartInstance.remove(); } catch (err) { }
            globalChartInstance = null;
        }
        container.innerHTML = '';
        importanceContainer.innerHTML = '';

        if (typeof LightweightCharts === 'undefined') {
            container.innerHTML = `
                <div style="color:var(--neon-error); text-align:center; padding-top:100px;">
                    <p>Hata: Grafik motoru (lightweight-charts.js) yüklenemedi.</p>
                    <p style="font-size:0.75rem; color:var(--text-muted); margin-top:10px;">Lütfen sayfayı yenileyiniz veya dosyanın varlığını kontrol ediniz.</p>
                </div>`;
            return;
        }
        if (!candles || candles.length === 0) {
            container.innerHTML = `<div style="color:var(--neon-error); text-align:center; padding-top:100px;">Hata: Mum verisi bulunamadı.</div>`;
            return;
        }

        // Fiyat büyüklüğüne göre Dinamik Ondalık (Decimal) Hassasiyeti belirle
        let precision = 2;
        const samplePrice = candles[candleIdxCheck = candles.length > 0 ? 0 : 0].close;
        if (samplePrice < 0.0001) precision = 8;
        else if (samplePrice < 0.01) precision = 6;
        else if (samplePrice < 1) precision = 5;
        else if (samplePrice < 100) precision = 4;

        const formatPrice = (p) => p.toFixed(precision);

        // 1. TRADINGVIEW LIGHTWEIGHT CHART BAŞLATMA
        const chart = LightweightCharts.createChart(container, {
            layout: { background: { color: 'transparent' }, textColor: '#d1d4dc' },
            grid: {
                vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
                horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
            },
            rightPriceScale: { borderColor: 'rgba(197, 203, 206, 0.1)', autoScale: true },
            timeScale: { borderColor: 'rgba(197, 203, 206, 0.1)', timeVisible: true, secondsVisible: false },
            crosshair: { mode: 0 },
            localization: {
                priceFormatter: price => formatPrice(price)
            }
        });
        globalChartInstance = chart;

        // Mum Çubukları Serisini Ekle (Versiyon Uyumluluk Modu)
        let candleSeries = null;
        try {
            if (typeof chart.addCandlestickSeries === 'function') {
                candleSeries = chart.addCandlestickSeries({
                    upColor: '#00ff88', downColor: '#ff3366', borderVisible: false,
                    wickUpColor: '#00ff88', wickDownColor: '#ff3366',
                });
            } else {
                candleSeries = chart.addSeries(LightweightCharts.SeriesType.Candlestick, {
                    upColor: '#00ff88', downColor: '#ff3366', borderVisible: false,
                    wickUpColor: '#00ff88', wickDownColor: '#ff3366',
                });
            }
        } catch (e) {
            console.error("Grafik serisi oluşturulamadı:", e);
            throw new Error("Grafik motoru başlatılamadı. Kütüphane uyumsuz veya bozuk.");
        }

        // Veriyi TV formatına çevir ve sırala/temizle
        let tvCandles = candles.map(c => ({
            time: Math.floor(c.timestamp / 1000),
            open: parseFloat(c.open),
            high: parseFloat(c.high),
            low: parseFloat(c.low),
            close: parseFloat(c.close)
        }));

        // Kronolojik sıralama ve benzersizlik kontrolü (LWC şartı)
        tvCandles.sort((a, b) => a.time - b.time);
        tvCandles = tvCandles.filter((v, i, a) => i === 0 || v.time > a[i - 1].time);

        candleSeries.setData(tvCandles);

        // Markerları hazırla (Hiyerarşik Gösterim Modeli)
        const markers = [];

        // 1. ML Tahminleri (Sadece Nokta - Arka Plan Bilgisi)
        mlPredictions.forEach(p => {
            if (p.choice === 2) {
                markers.push({ time: Math.floor(p.timestamp / 1000), position: 'belowBar', color: 'rgba(0, 255, 136, 0.4)', shape: 'circle', text: '' });
            } else if (p.choice === 0) {
                markers.push({ time: Math.floor(p.timestamp / 1000), position: 'aboveBar', color: 'rgba(255, 51, 102, 0.4)', shape: 'circle', text: '' });
            }
        });

        // 2. Teknik Strateji Sinyalleri (Sadece Nokta - Arka Plan Bilgisi)
        stratSignals.forEach(s => {
            if (s.signal === 2) {
                markers.push({
                    time: Math.floor(s.timestamp / 1000),
                    position: 'belowBar',
                    color: '#bc8cff',
                    shape: 'circle',
                    text: 'STRAT:AL'  // ← Etiket eklendi
                });
            } else if (s.signal === 0) {
                markers.push({
                    time: Math.floor(s.timestamp / 1000),
                    position: 'aboveBar',
                    color: '#ffcc00',
                    shape: 'circle',
                    text: 'STRAT:SAT'  // ← Etiket eklendi
                });
            }
        });

        // 3. GERÇEK AL-SAT SİMÜLASYONU (NET İŞLEMLER - Odak Noktası)
        const actualTrades = data.actual_trades || [];
        actualTrades.forEach(t => {
            if (t.action === "LONG_ENTER") {
                markers.push({
                    time: Math.floor(t.timestamp / 1000), position: 'belowBar', color: '#00FA9A', shape: 'arrowUp', size: 2, text: 'İŞLEM: AL'
                });
            } else if (t.action === "SHORT_ENTER") {
                markers.push({
                    time: Math.floor(t.timestamp / 1000), position: 'aboveBar', color: '#FF4500', shape: 'arrowDown', size: 2, text: 'İŞLEM: SAT'
                });
            } else if (t.action === "LONG_EXIT" || t.action === "SHORT_EXIT") {
                markers.push({
                    time: Math.floor(t.timestamp / 1000), position: 'aboveBar', color: '#FFFFFF', shape: 'square', text: 'KAPANIŞ'
                });
            }
        });

        // Markerları filtretle (Hatalı zaman damgalarını ayıkla)
        const validMarkers = markers.filter(m => !isNaN(m.time) && m.time > 0);
        validMarkers.sort((a, b) => a.time - b.time);
        candleSeries.setMarkers(validMarkers);

        // Responsive boyutlandırma
        const resizeObserver = new ResizeObserver(entries => {
            if (entries.length === 0 || !entries[0].contentRect || !globalChartInstance) return;
            const { width, height } = entries[0].contentRect;
            try { globalChartInstance.applyOptions({ width, height }); } catch (err) { }
        });
        resizeObserver.observe(container);

        // Tooltip (Popup) Mantığı
        const tooltip = document.getElementById('chart-tooltip');
        if (globalChartInstance && tooltip) {
            globalChartInstance.subscribeCrosshairMove(param => {
                if (
                    param.point === undefined ||
                    !param.time ||
                    param.point.x < 0 ||
                    param.point.x > container.clientWidth ||
                    param.point.y < 0 ||
                    param.point.y > container.clientHeight
                ) {
                    tooltip.style.display = 'none';
                    return;
                }

                const candleData = param.seriesData.get(candleSeries);
                if (!candleData) {
                    tooltip.style.display = 'none';
                    return;
                }

                // O zamana denk gelen arka plan sinyallerini bul
                const currentMarkers = validMarkers.filter(m => m.time === param.time);

                let tooltipContent = `<div style="font-weight:bold; margin-bottom:5px; border-bottom:1px solid rgba(255,255,255,0.2); padding-bottom:3px; color:#a0a5ba;">Fiyat Analizi</div>`;
                tooltipContent += `<div style="line-height:1.4;">
                    Açılış: <span style="color:#d1d4dc">${formatPrice(candleData.open)}</span><br>
                    Yüksek: <span style="color:#d1d4dc">${formatPrice(candleData.high)}</span><br>
                    Düşük: <span style="color:#d1d4dc">${formatPrice(candleData.low)}</span><br>
                    Kapanış: <span style="font-weight:bold; color:${candleData.close >= candleData.open ? '#00FA9A' : '#FF4500'}">${formatPrice(candleData.close)}</span>
                </div>`;

                if (currentMarkers.length > 0) {
                    tooltipContent += `<div style="font-weight:bold; margin-top:8px; margin-bottom:5px; border-bottom:1px solid rgba(255,255,255,0.2); padding-bottom:3px; color:#a0a5ba;">Arka Plan Sinyalleri</div>`;
                    currentMarkers.forEach(m => {
                        let text = m.text || '';
                        let displayColor = m.color;
                        if (!text) {
                            if (m.color === 'rgba(0, 255, 136, 0.4)') { text = '🤖 ML: AL Önerisi'; displayColor = '#00ff88'; }
                            else if (m.color === 'rgba(255, 51, 102, 0.4)') { text = '🤖 ML: SAT Önerisi'; displayColor = '#ff3366'; }
                            else if (m.color === '#bc8cff') { text = '📐 Strateji: AL Sinyali'; }
                            else if (m.color === '#ffcc00') { text = '📐 Strateji: SAT Sinyali'; }
                        }
                        tooltipContent += `<div style="color:${displayColor}; font-weight:500; margin-top:2px;">${text}</div>`;
                    });
                }

                tooltip.innerHTML = tooltipContent;
                tooltip.style.display = 'block';

                // Tooltip'in ekrandan taşmasını engelle
                let x = param.point.x + 15;
                const y = param.point.y;

                // Sağ kenara yaklaştıysa sola al
                if (x > container.clientWidth - 150) {
                    x = param.point.x - 160;
                }

                tooltip.style.left = x + 'px';
                tooltip.style.top = y + 'px';
            });
        }

        // 2. FEATURE IMPORTANCE CHART
        if (importance && Object.keys(importance).length > 0) {
            const keys = Object.keys(importance).sort((a, b) => importance[a] - importance[b]);
            const vals = keys.map(k => importance[k]);

            const traceImportance = {
                x: vals,
                y: keys,
                type: 'bar',
                orientation: 'h',
                marker: {
                    color: 'rgba(88, 166, 255, 0.5)',
                    line: { color: 'var(--neon-blue)', width: 1 }
                }
            };

            const layoutImportance = {
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent',
                font: { color: '#fff', size: 9, family: 'Inter' },
                margin: { t: 5, b: 20, l: 110, r: 10 },
                xaxis: { gridcolor: 'rgba(255,255,255,0.05)', tickformat: '.0%' },
                yaxis: { gridcolor: 'transparent' }
            };

            try {
                Plotly.newPlot('feature-importance-chart', [traceImportance], layoutImportance, { responsive: true, displayModeBar: false });
            } catch (err) {
                console.error("Plotly Error:", err);
            }
        } else {
            importanceContainer.innerHTML = '<div style="text-align:center; padding-top:100px; font-size:0.8rem; color:var(--text-muted);">Model ağırlık verisi bulunamadı.</div>';
        }

    } catch (e) {
        console.error("ML Visual Analysis Error Details:", e);
        if (container) {
            container.innerHTML = `
                <div style="color:var(--neon-error); text-align:center; padding-top:80px;">
                    <p>Analiz yüklenirken hata oluştu.</p>
                    <p style="font-size:0.75rem; color:var(--text-muted); margin-top:10px;">Detay: ${e.message}</p>
                    <button class="btn" onclick="runMLVisualAnalysis()" style="margin-top:15px; font-size:0.7rem;">Yeniden Dene</button>
                </div>
            `;
        }
    }
}

window.runMLVisualAnalysis = runMLVisualAnalysis;

async function fetchAnalysableSymbols() {
    const select = document.getElementById('ml-analysis-symbol');
    if (!select) return;

    try {
        const res = await fetch('/api/v1/data/symbols-with-data');
        const data = await res.json();

        select.innerHTML = '';
        if (data.symbols && data.symbols.length > 0) {
            data.symbols.forEach(sym => {
                const opt = document.createElement('option');
                opt.value = sym;
                opt.innerText = sym;
                select.appendChild(opt);
            });
        } else {
            select.innerHTML = '<option value="">Cihazda Veri Yok</option>';
        }
    } catch (e) {
        console.error("Analiz Sembolleri Yüklenemedi:", e);
    }
}

// Global'e bağla
window.runMLVisualAnalysis = runMLVisualAnalysis;
window.fetchAnalysableSymbols = fetchAnalysableSymbols;

// ============================================
// 1-to-N (ÇOKLU BOT) MİMARİSİ FONKSİYONLARI
// ============================================

async function startBot(symbol, strategy_id, timeframe, market_type = 'future', margin_type = 'isolated') {
    /**
     * Yeni bir bot başlatır. Aynı sembolde birden fazla bot çalışabilir.
     */
    try {
        const response = await fetch('/api/v1/bot/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                symbol: symbol,
                strategy_id: strategy_id,
                timeframe: timeframe,
                market_type: market_type,
                margin_type: margin_type
            })
        });

        const result = await response.json();

        if (result.status === 'success') {
            console.log(`✅ Bot başlatıldı: ${result.bot_id}`);
            showErrorToast(`🤖 Bot başlatıldı: ${result.bot_id}`, 3000);
            loadActiveBots(); // Bot listesini güncelle
            return result.bot_id;
        } else {
            console.error(`❌ Bot başlatma hatası: ${result.message}`);
            showErrorToast(`❌ ${result.message}`, 5000);
            return null;
        }
    } catch (error) {
        console.error('Bot başlatma hatası:', error);
        showErrorToast(`❌ Bot başlatılamadı: ${error.message}`, 5000);
        return null;
    }
}

async function stopBot(bot_id) {
    /**
     * Belirli bir botu durdurur.
     */
    if (!confirm(`Botu durdurmak istediğinize emin misiniz?\n\nBot ID: ${bot_id}`)) {
        return;
    }

    try {
        const response = await fetch('/api/v1/bot/stop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bot_id: bot_id })
        });

        const result = await response.json();

        if (result.status === 'success') {
            console.log(`🛑 Bot durduruldu: ${bot_id}`);
            showErrorToast(`🛑 Bot durduruldu: ${bot_id}`, 3000);
            loadActiveBots(); // Bot listesini güncelle
        } else {
            console.error(`❌ Bot durdurma hatası: ${result.message}`);
            showErrorToast(`❌ ${result.message}`, 5000);
        }
    } catch (error) {
        console.error('Bot durdurma hatası:', error);
        showErrorToast(`❌ Bot durdurulamadı: ${error.message}`, 5000);
    }
}

async function loadActiveBots() {
    /**
     * Tüm aktif botları yükler ve tabloda gösterir.
     */
    try {
        const response = await fetch('/api/v1/bots/list');
        const data = await response.json();

        const container = document.getElementById('active-bots-container');
        if (!container) return;

        if (!data.bots || data.bots.length === 0) {
            container.innerHTML = '<p style="text-align:center; padding:40px; color:var(--text-muted);">Aktif bot yok</p>';
            return;
        }

        // Bot kartlarını oluştur
        container.innerHTML = data.bots.map(bot => `
            <div class="card glass-panel" style="margin-bottom:15px;">
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <div style="flex:1;">
                        <h3 style="color:var(--neon-blue); margin:0 0 10px 0;">
                            🤖 ${bot.strategy_id}
                        </h3>
                        <div style="font-size:0.85rem; color:var(--text-muted);">
                            <div><strong>Sembol:</strong> ${bot.symbol}</div>
                            <div><strong>Timeframe:</strong> ${bot.timeframe}</div>
                            <div><strong>Market:</strong> ${bot.market_type}</div>
                            <div><strong>Bot ID:</strong> <code style="font-size:0.75rem;">${bot.bot_id || bot.symbol}_${bot.strategy_id}_${bot.timeframe}</code></div>
                            <div><strong>Başlangıç:</strong> ${new Date(bot.started_at).toLocaleString()}</div>
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:1.5rem; font-weight:bold; color:${bot.state?.realized_pnl >= 0 ? 'var(--neon-green)' : 'var(--neon-red)'};">
                            $${(bot.state?.realized_pnl || 0).toFixed(2)}
                        </div>
                        <div style="font-size:0.75rem; color:var(--text-muted);">
                            PnL (${bot.positions_count || 0} pozisyon)
                        </div>
                        <button class="btn btn-danger"
                                onclick="stopBot('${bot.bot_id || bot.symbol}_${bot.strategy_id}_${bot.timeframe}')"
                                style="margin-top:10px; padding:8px 15px; font-size:0.75rem;">
                            🛑 Durdur
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Aktif botlar yüklenemedi:', error);
    }
}

// Global'e ekle
window.startBot = startBot;
window.stopBot = stopBot;
window.loadActiveBots = loadActiveBots;

async function loadBotFormOptions() {
    /**
     * Bot başlatma formu için dinamik seçenekleri yükler.
     * OPTGROUP ile builtin ve custom stratejileri grupla.
     */
    try {
        console.log('🔄 [DEBUG] loadBotFormOptions() çağrıldı...');

        // DOM elemanlarını kontrol et
        const symbolSelect = document.getElementById('bot-symbol');
        const strategySelect = document.getElementById('bot-strategy');

        console.log('🔍 [DEBUG] DOM Elemanları:', {
            'bot-symbol': symbolSelect ? '✅ Var' : '❌ YOK',
            'bot-strategy': strategySelect ? '✅ Var' : '❌ YOK'
        });

        if (!symbolSelect || !strategySelect) {
            console.warn('⚠️ [DEBUG] Form elemanları bulunamadı, bekleniyor...');
            return;
        }

        // 1. Sembolleri yükle (DB'de verisi olanlar)
        console.log('📡 [DEBUG] Semboller API çağrısı...');
        const symbolsRes = await fetch('/api/v1/data/symbols-with-data');
        const symbolsData = await symbolsRes.json();

        if (symbolSelect && symbolsData.symbols) {
            symbolSelect.innerHTML = '';
            symbolsData.symbols.forEach(symbol => {
                const opt = document.createElement('option');
                opt.value = symbol;
                opt.textContent = symbol;
                symbolSelect.appendChild(opt);
            });
            if (symbolsData.symbols.length === 0) {
                symbolSelect.innerHTML = '<option value="">DB\'de veri yok</option>';
            }
            console.log(`✅ [DEBUG] ${symbolsData.symbols.length} sembol yüklendi`);
        }

        // 2. Stratejileri yükle (OPTGROUP ile grupla)
        console.log('📡 [DEBUG] Stratejiler API çağrısı: /api/v1/strategy/list');

        // Önce API'yi test et
        try {
            const testRes = await fetch('/api/v1/strategy/list');
            const testData = await testRes.json();
            console.log('🧪 [DEBUG] Test API Response:', testData);
        } catch (testErr) {
            console.error('❌ [DEBUG] Test API hatası:', testErr);
        }

        const strategiesRes = await fetch('/api/v1/strategy/list?t=' + Date.now()); // Cache bypass
        const strategiesData = await strategiesRes.json();

        console.log('📊 [DEBUG] API Response:', strategiesData);

        if (strategySelect && strategiesData.strategies) {
            strategySelect.innerHTML = '';

            // Filtrele
            const builtinStrategies = strategiesData.strategies.filter(s => s.type === 'builtin');
            const customStrategies = strategiesData.strategies.filter(s => s.type === 'custom');

            console.log(`📊 [DEBUG] Builtin: ${builtinStrategies.length}, Custom: ${customStrategies.length}`);

            // OPTGROUP: Yerleşik Stratejiler (Builtin)
            if (builtinStrategies.length > 0) {
                const builtinGroup = document.createElement('optgroup');
                builtinGroup.label = '🤖 Yerleşik Stratejiler';

                builtinStrategies.forEach(strat => {
                    const opt = document.createElement('option');
                    opt.value = strat.id;
                    opt.textContent = strat.name;
                    builtinGroup.appendChild(opt);
                });

                strategySelect.appendChild(builtinGroup);
                console.log(`✅ [DEBUG] ${builtinStrategies.length} builtin strateji eklendi`);
            }

            // OPTGROUP: Özel Stratejiler (Custom)
            if (customStrategies.length > 0) {
                const customGroup = document.createElement('optgroup');
                customGroup.label = '🎨 Özel Stratejiler';

                customStrategies.forEach(strat => {
                    const opt = document.createElement('option');
                    opt.value = strat.id;
                    opt.textContent = strat.name + ' ⚡';
                    customGroup.appendChild(opt);
                });

                strategySelect.appendChild(customGroup);
                console.log(`✅ [DEBUG] ${customStrategies.length} custom strateji eklendi`);
            }

            const totalStrategies = builtinStrategies.length + customStrategies.length;
            console.log(`✅ [DEBUG] Toplam ${totalStrategies} strateji yüklendi`);

            if (totalStrategies === 0) {
                strategySelect.innerHTML = '<option value="">Strateji yok</option>';
            }
        } else {
            console.error('❌ [DEBUG] Strateji verisi yok:', strategiesData);
        }

    } catch (error) {
        console.error('❌ [DEBUG] Bot form seçenekleri yüklenemedi:', error);
        console.error('❌ [DEBUG] Stack:', error.stack);
        showErrorToast('⚠️ Stratejiler yüklenemedi: ' + error.message, 5000);
    }
}

function handleStartBot() {
    /**
     * Bot başlatma formunu işler.
     */
    const symbol = document.getElementById('bot-symbol')?.value;
    const strategy = document.getElementById('bot-strategy')?.value;
    const timeframe = document.getElementById('bot-timeframe')?.value;
    const market = document.getElementById('bot-market')?.value;

    if (!symbol || !strategy || !timeframe) {
        showErrorToast('❌ Lütfen tüm alanları doldurun!', 3000);
        return;
    }

    // Bot başlat
    startBot(symbol, strategy, timeframe, market);
}

/**
 * Strateji uygula ve başlat
 */
async function selectStrategy(symbol) {
    const strategyId = document.getElementById(`strat-sel-${symbol.replace('/', '-')}`).value;
    const timeframe = document.getElementById(`tf-sel-${symbol.replace('/', '-')}`).value;
    const marketType = document.getElementById(`market-sel-${symbol.replace('/', '-')}`).value;
    const marginType = document.getElementById(`margin-sel-${symbol.replace('/', '-')}`).value;

    if (!strategyId) {
        alert("Lütfen önce bir strateji seçin!");
        return;
    }

    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Uygulanıyor...';
    btn.disabled = true;

    try {
        const res = await fetch('/api/v1/strategy/select', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                strategy_id: strategyId,
                symbol: symbol,
                timeframe: timeframe,
                market_type: marketType,
                margin_type: marginType
            })
        });

        const result = await res.json();

        if (result.status === 'success') {
            btn.innerHTML = '✅ Uygulandı!';
            btn.style.background = 'var(--neon-green)';

            // Status güncelle
            const statusEl = document.getElementById(`status-${symbol.replace('/', '-')}`);
            if (statusEl) {
                statusEl.innerHTML = '● Aktif';
                statusEl.className = 'success-text';
            }

            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
                btn.style.background = '';
                fetchStrategies(); // Tabloyu yenile
            }, 2000);
        } else {
            alert("Hata: " + result.message);
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    } catch (e) {
        alert("Bağlantı hatası: " + e.message);
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

/**
 * Stratejiyi durdur
 */
async function stopStrategy(symbol) {
    if (!confirm(`${symbol} için botu DURDURMAK istediğinize emin misiniz?\n\nBu işlem botu durdurur ama pozisyonları kapatmaz.`)) {
        return;
    }

    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏹ Durduruluyor...';
    btn.disabled = true;

    try {
        // Şimdilik sadece stratejiyi sıfırlıyoruz
        const res = await fetch('/api/v1/strategy/select', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                strategy_id: '', // Boş strateji = durdur
                symbol: symbol,
                timeframe: '1m',
                market_type: 'swap',
                margin_type: 'isolated'
            })
        });

        const result = await res.json();

        if (result.status === 'success') {
            btn.innerHTML = '✅ Durduruldu';
            btn.style.background = 'var(--neon-red)';

            // Status güncelle
            const statusEl = document.getElementById(`status-${symbol.replace('/', '-')}`);
            if (statusEl) {
                statusEl.innerHTML = '○ Durduruldu';
                statusEl.className = 'text-muted';
            }

            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
                btn.style.background = '';
                fetchStrategies(); // Tabloyu yenile
            }, 2000);
        } else {
            alert("Hata: " + result.message);
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    } catch (e) {
        alert("Bağlantı hatası: " + e.message);
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

/**
 * Stratejiyi yeniden başlat
 */
async function restartStrategy(symbol) {
    if (!confirm(`${symbol} için botu YENİDEN BAŞLATMAK istediğinize emin misiniz?\n\nMevcut ayarlarla bot yeniden başlatılacak.`)) {
        return;
    }

    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.innerHTML = '🔄 Başlatılıyor...';
    btn.disabled = true;

    try {
        // Mevcut ayarları al
        const strategyId = document.getElementById(`strat-sel-${symbol.replace('/', '-')}`).value;
        const timeframe = document.getElementById(`tf-sel-${symbol.replace('/', '-')}`).value;
        const marketType = document.getElementById(`market-sel-${symbol.replace('/', '-')}`).value;
        const marginType = document.getElementById(`margin-sel-${symbol.replace('/', '-')}`).value;

        const res = await fetch('/api/v1/strategy/select', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                strategy_id: strategyId || 'trend_master', // Varsayılan
                symbol: symbol,
                timeframe: timeframe || '1m',
                market_type: marketType || 'swap',
                margin_type: marginType || 'isolated'
            })
        });

        const result = await res.json();

        if (result.status === 'success') {
            btn.innerHTML = '✅ Başlatıldı';
            btn.style.background = 'var(--neon-green)';

            // Status güncelle
            const statusEl = document.getElementById(`status-${symbol.replace('/', '-')}`);
            if (statusEl) {
                statusEl.innerHTML = '● Aktif';
                statusEl.className = 'success-text';
            }

            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
                btn.style.background = '';
                fetchStrategies(); // Tabloyu yenile
            }, 2000);
        } else {
            alert("Hata: " + result.message);
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    } catch (e) {
        alert("Bağlantı hatası: " + e.message);
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// İlk yükleme
setTimeout(() => {
    fetchAnalysableSymbols().then(() => {
        if (document.getElementById('ml-analysis-chart')) runMLVisualAnalysis();
    });
}, 1000);

// --- STRATEJİ RAPORU YÜKLEME ---
async function loadStrategyReport() {
    const container = document.getElementById('strategy-report-container');
    if (!container) return;

    container.innerHTML = '<p style="text-align:center; padding: 40px; color:var(--text-muted); grid-column: span 100%;">🤖 Botların nöronları analiz ediliyor...</p>';

    try {
        const res = await fetch('/api/v1/strategy-report');
        if (!res.ok) throw new Error("API Hatası");
        const data = await res.json();

        container.innerHTML = '';

        if (!data.report || data.report.length === 0) {
            container.innerHTML = '<p style="text-align:center; padding: 40px; color:var(--text-muted); grid-column: span 100%;">⚠️ Henüz raporlanacak kapanmış bir işlem kaydı yok. Simülasyon devam etmeli.</p>';
            return;
        }

        data.report.forEach(strat => {
            let symbolRows = '';
            strat.symbols.forEach(sym => {
                const pColor = sym.pnl >= 0 ? 'var(--neon-green)' : 'var(--neon-red)';
                symbolRows += `
                    <div style="display:flex; justify-content:space-between; margin-top:5px; font-size:0.85rem; border-bottom: 1px dashed rgba(255,255,255,0.05); padding-bottom:3px;">
                        <span style="color:var(--text-muted);">${sym.name} <small>(${sym.trades} İşlem)</small></span>
                        <span style="color:${pColor}; font-family:monospace;">${sym.pnl >= 0 ? '+' : ''}$${sym.pnl.toFixed(2)} (%${sym.win_rate})</span>
                    </div>
                `;
            });

            const cardBg = strat.total_pnl >= 0 ? "rgba(0, 255, 136, 0.02)" : "rgba(255, 51, 102, 0.02)";
            const pnlColor = strat.total_pnl >= 0 ? "var(--neon-green)" : "var(--neon-red)";
            const pnlSign = strat.total_pnl >= 0 ? "+" : "";

            const cardHtml = `
                <div class="card glass-panel" style="background: ${cardBg}; border: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <h3 style="color:var(--neon-blue); margin: 0; font-size: 1.1rem;">${strat.strategy}</h3>
                        <span class="timeframe-tag" style="font-size: 0.75rem;">${strat.total_trades} Toplam İşlem</span>
                    </div>
                    
                    <div style="margin: 20px 0; display:flex; gap:20px;">
                        <div>
                            <span style="display:block; font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Win Rate</span>
                            <strong style="font-size:1.4rem; font-family:var(--font-mono); color:${strat.win_rate >= 50 ? 'var(--neon-green)' : 'var(--neon-red)'};">%${strat.win_rate}</strong>
                        </div>
                        <div>
                            <span style="display:block; font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Net Kâr/Zarar</span>
                            <strong style="font-size:1.4rem; font-family:var(--font-mono); color:${pnlColor};">${pnlSign}$${strat.total_pnl.toFixed(2)}</strong>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 20px; flex-grow: 1;">
                        <span style="display:block; font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:10px;">📉 Sembol Kırılımı</span>
                        ${symbolRows}
                    </div>
                    
                    <div style="padding: 12px; background: rgba(0,0,0,0.3); border-radius: 8px; border-left: 3px solid ${strat.total_pnl > 0 ? 'var(--neon-green)' : 'var(--neon-blue)'};">
                        <span style="display:block; font-size:0.7rem; color:var(--neon-blue); margin-bottom:5px; font-weight:bold;">🤖 YAPAY ZEKA ÖNERİSİ:</span>
                        <p style="font-size: 0.8rem; color: #ddd; line-height:1.4; margin:0;">${strat.recommendation}</p>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', cardHtml);
        });

    } catch (e) {
        console.error("Rapor Yükleme Hatası:", e);
        container.innerHTML = '<p style="text-align:center; padding: 40px; color:var(--neon-red); grid-column: span 100%;">Analiz sunucusuyla iletişim kurulamadı.</p>';
    }
}

window.loadStrategyReport = loadStrategyReport;


// ============================================
// ML MODEL EĞİTİM FONKSİYONLARI
// ============================================

// Veri laboratuvarından indirilmiş coinleri ML training dropdown'una yükle
async function loadMLTrainingSymbols() {
    try {
        const response = await fetch('/api/v1/data/symbols-with-data');
        const data = await response.json();

        const select = document.getElementById('ml-train-symbol');
        if (!select || !data.symbols || data.symbols.length === 0) return;

        // Dropdown'u tamamen temizle
        select.innerHTML = '';

        // Veri laboratuvarından gelen coinleri ekle (GERÇEK DB FORMATI)
        // Örnek: BTC/USDT:USDT_future, BNB/USDT:USDT_future vb.
        data.symbols.forEach(symbol => {
            const option = document.createElement('option');
            option.value = symbol;  // DB'deki TAM formatı kullan
            option.textContent = symbol.replace('_future', '');  // Kullanıcıya _future'siz göster
            select.appendChild(option);
        });

        // İlk sembol seçildiğinde DB kontrolü yap
        if (select.value) {
            setTimeout(() => checkDbMumCount(), 100);
        }

    } catch (error) {
        console.error('ML Training sembolleri yüklenemedi:', error);
    }
}

async function startMLTraining() {
    const symbol = document.getElementById('ml-train-symbol').value;
    const timeframe = document.getElementById('ml-train-timeframe').value;
    const limit = document.getElementById('ml-train-limit').value;
    const tp = document.getElementById('ml-train-tp').value;
    const sl = document.getElementById('ml-train-sl').value;

    // UI güncelle
    const progressDiv = document.getElementById('ml-training-progress');
    const progressBar = document.getElementById('ml-progress-bar');
    const progressMsg = document.getElementById('ml-training-message');
    const resultDiv = document.getElementById('ml-training-result');

    progressDiv.style.display = 'block';
    resultDiv.style.display = 'none';
    progressBar.style.width = '0%';
    progressMsg.textContent = 'Eğitim başlatılıyor...';

    try {
        const response = await fetch('/api/v1/ml/train', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                symbol: symbol,
                timeframe: timeframe,
                limit: parseInt(limit),
                tp_multiplier: parseFloat(tp),
                sl_multiplier: parseFloat(sl),
                time_horizon: 10,
                train_ratio: 0.8
            })
        });

        const data = await response.json();

        if (data.status === 'error') {
            showError(data.message);
            return;
        }

        progressMsg.textContent = data.message;

        // İlerlemeyi poll et (her 2 saniyede bir kontrol et)
        const pollInterval = setInterval(async () => {
            const statusRes = await fetch('/api/v1/ml/status');
            const statusData = await statusRes.json();

            if (statusData.training) {
                const training = statusData.training;
                progressBar.style.width = training.progress + '%';
                progressMsg.textContent = training.message;

                if (!training.is_training) {
                    // Eğitim tamamlandı
                    clearInterval(pollInterval);

                    if (training.progress === 100) {
                        // Başarılı
                        resultDiv.style.display = 'block';
                        resultDiv.style.background = 'rgba(0, 255, 136, 0.1)';
                        resultDiv.style.border = '1px solid var(--neon-green)';
                        resultDiv.innerHTML = `
                            <h4 style="color: var(--neon-green); margin-bottom: 10px;">✅ Eğitim Başarılı!</h4>
                            <p style="color: #fff;">Model kaydedildi: <strong>${training.model_path}</strong></p>
                            <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 10px;">
                                Model artık PaperTrader tarafından kullanılıyor.
                            </p>
                        `;
                        progressDiv.style.display = 'none';
                    } else {
                        // Hata
                        showError(training.message);
                        progressDiv.style.display = 'none';
                    }
                }
            }
        }, 2000);

    } catch (error) {
        showError('Eğitim başlatılamadı: ' + error.message);
        progressDiv.style.display = 'none';
    }
}

function showError(message) {
    const resultDiv = document.getElementById('ml-training-result');
    resultDiv.style.display = 'block';
    resultDiv.style.background = 'rgba(255, 69, 0, 0.1)';
    resultDiv.style.border = '1px solid var(--neon-red)';
    resultDiv.innerHTML = `
        <h4 style="color: var(--neon-red); margin-bottom: 10px;">❌ Eğitim Hatası</h4>
        <p style="color: #fff;">${message}</p>
    `;
}

// Global scope'a ekle
window.startMLTraining = startMLTraining;


// ============================================
// EĞİTİM GEÇMİŞİ TABLOSU
// ============================================

async function loadTrainingHistory() {
    const container = document.getElementById('training-history-table');
    if (!container) return;

    container.innerHTML = '<p style="text-align: center; padding: 40px; color: var(--text-muted);">Yükleniyor...</p>';

    try {
        const response = await fetch('/api/v1/ml/training-history');
        const data = await response.json();

        if (!data.history || data.history.length === 0) {
            container.innerHTML = '<p style="text-align: center; padding: 40px; color: var(--text-muted);">Henüz eğitilmiş model yok. İlk modelinizi eğitin! 🚀</p>';
            return;
        }

        // Tarihe göre sırala (en yeni önce)
        const sortedHistory = data.history.sort((a, b) =>
            new Date(b.trained_at) - new Date(a.trained_at)
        );

        let html = `
            <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                <thead>
                    <tr style="border-bottom: 2px solid var(--neon-blue);">
                        <th style="padding: 12px; text-align: left; color: var(--neon-blue);">Sembol</th>
                        <th style="padding: 12px; text-align: left; color: var(--neon-blue);">Zaman Dilimi</th>
                        <th style="padding: 12px; text-align: left; color: var(--neon-blue);">Mum Sayısı</th>
                        <th colspan="3" style="padding: 12px; text-align: center; color: var(--neon-blue);">Model Doğrulukları</th>
                        <th style="padding: 12px; text-align: left; color: var(--neon-blue);">Eğitim Zamanı</th>
                        <th style="padding: 12px; text-align: left; color: var(--neon-blue);">Durum</th>
                    </tr>
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); font-size: 0.75rem;">
                        <th style="padding: 12px; text-align: left; color: var(--neon-blue);"></th>
                        <th style="padding: 12px; text-align: left; color: var(--neon-blue);"></th>
                        <th style="padding: 12px; text-align: left; color: var(--neon-blue);"></th>
                        <th style="padding: 12px; text-align: center; color: #26a69a;">📊 XGBoost</th>
                        <th style="padding: 12px; text-align: center; color: #66bb6a;">🌲 RF</th>
                        <th style="padding: 12px; text-align: center; color: var(--neon-blue);">🔗 Ensemble</th>
                        <th style="padding: 12px; text-align: left; color: var(--neon-blue);"></th>
                        <th style="padding: 12px; text-align: left; color: var(--neon-blue);"></th>
                    </tr>
                </thead>
                <tbody>
        `;

        sortedHistory.forEach((model, index) => {
            const date = new Date(model.trained_at);
            const dateStr = date.toLocaleString('tr-TR', {
                day: '2-digit', month: '2-digit',
                hour: '2-digit', minute: '2-digit'
            });

            // Model doğrulukları
            const xgb_acc = (model.metrics.xgb_accuracy * 100).toFixed(1);
            const rf_acc = (model.metrics.rf_accuracy * 100).toFixed(1);
            const ensemble_acc = (model.metrics.ensemble_accuracy * 100).toFixed(1);

            // En yüksek doğruluğu vurgula
            const bestModel = Math.max(xgb_acc, rf_acc, ensemble_acc);
            let xgbColor = xgb_acc >= 60 ? '#26a69a' : 'var(--text-muted)'; if (xgb_acc == bestModel && ensemble_acc < xgb_acc) xgbColor = 'var(--neon-green)';
            let rfColor = rf_acc >= 60 ? '#66bb6a' : 'var(--text-muted)'; if (rf_acc == bestModel && ensemble_acc < rf_acc) rfColor = 'var(--neon-green)';
            const ensembleColor = ensemble_acc >= 60 ? 'var(--neon-blue)' : 'var(--text-muted)';

            const rowColor = index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)';

            html += `
                <tr style="background: ${rowColor}; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 12px; font-weight: bold; color: var(--neon-blue);">${model.symbol.replace('USDT', '/USDT')}</td>
                    <td style="padding: 12px;">${model.timeframe}</td>
                    <td style="padding: 12px;">${model.limit.toLocaleString()}</td>
                    <td style="padding: 12px; text-align: center; color: ${xgbColor}; font-weight: ${xgb_acc == bestModel ? 'bold' : 'normal'};">%${xgb_acc}</td>
                    <td style="padding: 12px; text-align: center; color: ${rfColor}; font-weight: ${rf_acc == bestModel ? 'bold' : 'normal'};">%${rf_acc}</td>
                    <td style="padding: 12px; text-align: center; color: ${ensembleColor}; font-weight: bold;">%${ensemble_acc}</td>
                    <td style="padding: 12px; color: var(--text-muted);">${dateStr}</td>
                    <td style="padding: 12px;">
                        <span style="display: inline-flex; align-items: center; gap: 5px; padding: 4px 8px; background: rgba(0, 255, 136, 0.1); border-radius: 4px; color: var(--neon-green); font-size: 0.75rem;">
                            ✅ Hazır
                        </span>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        container.innerHTML = html;

    } catch (error) {
        console.error('Eğitim geçmişi yüklenemedi:', error);
        container.innerHTML = '<p style="text-align: center; padding: 40px; color: var(--neon-red);">Geçmiş yüklenemedi.</p>';
    }
}

// Global scope'a ekle
window.loadTrainingHistory = loadTrainingHistory;


// ============================================
// ML EĞİTİM - DİNAMİK MUM SAYISI
// ============================================

let currentDbMumCount = 0;  // DB'deki mevcut mum sayısı

async function checkDbMumCount() {
    /**
     * Seçili sembol ve timeframe için DB'deki mum sayısını kontrol eder
     * RESAMPLING MANTIĞI: DB'de her zaman 1m var, diğer TF'ler resample ile oluşur
     */
    const symbol = document.getElementById('ml-train-symbol')?.value;
    const timeframe = document.getElementById('ml-train-timeframe')?.value;
    const countDisplay = document.getElementById('ml-db-count');

    if (!symbol || !timeframe || !countDisplay) return;

    // Timeframe multipliers (çarpanlar)
    const timeframeMultipliers = {
        '1m': 1, '3m': 3, '5m': 5, '10m': 10, '15m': 15, '20m': 20, '30m': 30, '45m': 45,
        '1h': 60, '2h': 120, '3h': 180, '4h': 240, '6h': 360, '8h': 480, '12h': 720, '1d': 1440
    };

    const multiplier = timeframeMultipliers[timeframe] || 1;

    try {
        // DB'den 1m mum sayısını al
        const response = await fetch(`/api/v1/data/klines-count?symbol=${encodeURIComponent(symbol)}&timeframe=1m`);
        const data = await response.json();

        currentDbMumCount = data.count || 0;

        // Hedef timeframe'de kaç mum olur?
        const availableTargetCandles = Math.floor(currentDbMumCount / multiplier);

        if (currentDbMumCount > 0) {
            if (timeframe === '1m') {
                countDisplay.textContent = `(DB'de: ${currentDbMumCount.toLocaleString()} mum)`;
            } else {
                countDisplay.textContent = `(DB'de: ${currentDbMumCount.toLocaleString()} mum 1m ≈ ${availableTargetCandles.toLocaleString()} mum ${timeframe})`;
            }
            countDisplay.style.color = 'var(--neon-green)';

            // Input max değerini güncelle (hedef timeframe bazında)
            const limitInput = document.getElementById('ml-train-limit');
            if (limitInput) {
                limitInput.max = availableTargetCandles;
                if (parseInt(limitInput.value) > availableTargetCandles) {
                    limitInput.value = availableTargetCandles;
                }
            }
        } else {
            countDisplay.textContent = '(DB\'de veri yok!)';
            countDisplay.style.color = 'var(--neon-red)';
        }

        validateMumCount();
    } catch (error) {
        console.error('DB mum count hatası:', error);
        countDisplay.textContent = '(Kontrol edilemedi)';
        countDisplay.style.color = 'var(--text-muted)';
    }
}

function validateMumCount() {
    /**
     * Kullanıcının girdiği mum sayısını DB'deki mevcut mum sayısı ile karşılaştırır
     */
    const limitInput = document.getElementById('ml-train-limit');
    const warningSpan = document.getElementById('ml-limit-warning');
    const countDisplay = document.getElementById('ml-db-count');

    if (!limitInput || !warningSpan) return;

    const userLimit = parseInt(limitInput.value) || 0;

    if (currentDbMumCount > 0 && userLimit > currentDbMumCount) {
        // Kullanıcı DB'den fazla mum istiyor
        warningSpan.style.display = 'block';
        warningSpan.textContent = `⚠️ DB'de sadece ${currentDbMumCount.toLocaleString()} mum var!`;
        limitInput.style.borderColor = 'var(--neon-red)';
    } else if (userLimit < 100) {
        // Çok az mum
        warningSpan.style.display = 'block';
        warningSpan.textContent = '⚠️ Minimum 100 mum önerilir!';
        limitInput.style.borderColor = 'var(--neon-red)';
    } else {
        // Her şey yolunda
        warningSpan.style.display = 'none';
        limitInput.style.borderColor = 'rgba(255,255,255,0.1)';

        if (currentDbMumCount > 0) {
            const percentage = Math.round((userLimit / currentDbMumCount) * 100);
            countDisplay.textContent = `(DB'de: ${currentDbMumCount.toLocaleString()} mum - ${percentage}%)`;
            countDisplay.style.color = percentage <= 100 ? 'var(--neon-green)' : 'var(--neon-blue)';
        }
    }
}

// Sembol veya timeframe değiştiğinde DB kontrolü yap
function setupMLTrainListeners() {
    const symbolSelect = document.getElementById('ml-train-symbol');
    const timeframeSelect = document.getElementById('ml-train-timeframe');

    if (symbolSelect) {
        symbolSelect.addEventListener('change', checkDbMumCount);
    }
    if (timeframeSelect) {
        timeframeSelect.addEventListener('change', checkDbMumCount);
    }
}

// Sayfa yüklendiğinde listener'ları ayarla
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupMLTrainListeners);
} else {
    setupMLTrainListeners();
}


// ============================================
// EĞİTİM GEÇMİŞİNİ TEMİZLE
// ============================================

async function clearTrainingHistory() {
    if (!confirm('⚠️ Tüm eğitim geçmişini silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz!')) return;

    try {
        const response = await fetch('/api/v1/ml/training-history', {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.status === 'success') {
            alert('✅ ' + result.message);
            loadTrainingHistory(); // Tabloyu yenile
        } else {
            alert('❌ Hata: ' + result.message);
        }
    } catch (error) {
        console.error('Geçmiş silme hatası:', error);
        alert('❌ Geçmiş silinemedi: ' + error.message);
    }
}

// Global scope'a ekle
window.clearTrainingHistory = clearTrainingHistory;


// ============================================
// MODEL TIMEFRAME KONTROLÜ (GÜVENLİK KALKANI)
// ============================================

async function checkModelCompatibility(symbol, timeframe) {
    /**
     * Seçili sembol ve timeframe için modelin var olup olmadığını kontrol eder.
     * @returns {Promise<{compatible: boolean, error: string|null}>}
     */
    try {
        const response = await fetch(`/api/v1/ml/check-model?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`);
        const result = await response.json();

        if (result.error) {
            return {
                compatible: false,
                error: result.error
            };
        }

        return {
            compatible: result.timeframe_match,
            error: null
        };
    } catch (error) {
        console.error('Model kontrol hatası:', error);
        return {
            compatible: false,
            error: 'Model kontrolü yapılamadı: ' + error.message
        };
    }
}

function showErrorToast(message, duration = 5000) {
    /**
     * Ekrana kırmızı uyarı mesajı (toast) gösterir.
     */
    // Toast container oluştur (yoksa)
    let container = document.getElementById('error-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'error-toast-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(container);
    }

    // Toast oluştur
    const toast = document.createElement('div');
    toast.style.cssText = `
        background: linear-gradient(135deg, #ff4500, #ff6347);
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(255, 69, 0, 0.4);
        font-size: 0.9rem;
        font-weight: 500;
        max-width: 400px;
        animation: slideIn 0.3s ease-out;
        border-left: 4px solid #fff;
    `;
    toast.innerHTML = `
        <div style="display: flex; align-items: start; gap: 10px;">
            <span style="font-size: 1.2rem;">⚠️</span>
            <div style="flex: 1;">${message}</div>
            <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: white; cursor: pointer; font-size: 1.2rem;">&times;</button>
        </div>
    `;

    container.appendChild(toast);

    // Otomatik kaldır
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, duration);
}

// Global scope'a ekle
window.checkModelCompatibility = checkModelCompatibility;
window.showErrorToast = showErrorToast;

// Sekme dinleyicisini ezmeden global bağlama yap
document.addEventListener('click', (e) => {
    if (e.target.matches('.menu-item') && e.target.dataset.target === 'tab-reports') {
        loadStrategyReport();
    }
    // Ayarlar sekmesi açıldığında aktif botları ve form seçeneklerini yükle
    if (e.target.matches('.menu-item') && e.target.dataset.target === 'tab-settings') {
        setTimeout(() => {
            loadActiveBots();
            loadBotFormOptions();
        }, 500);
    }
});

// Sayfa yüklendiğinde aktif botları ve form seçeneklerini yükle
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            loadActiveBots();
            loadBotFormOptions();
        }, 1000);
    });
} else {
    setTimeout(() => {
        loadActiveBots();
        loadBotFormOptions();
    }, 1000);
}


