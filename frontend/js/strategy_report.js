// --- strategy_report.js ---

async function loadStrategyReport() {
    const container = document.getElementById('strategy-report-container');
    if (!container) return;

    const isTr = (typeof window !== 'undefined' && window.i18n && window.i18n.currentLang === 'tr');

    container.innerHTML = `<p style="text-align:center; padding: 40px; color:var(--text-muted);"><i class="lucide-icon" data-lucide="loader"></i> ⏳ ${isTr ? 'Raporlar oluşturuluyor, lütfen bekleyin...' : 'Generating performance reports, please wait...'}</p>`;

    try {
        const response = await fetch('/api/v1/strategy-report');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.status === 'success' && result.report && result.report.length > 0) {
            container.innerHTML = ''; // Temizle

            result.report.forEach(strat => {
                const isProfitable = strat.total_pnl > 0;
                const pnlClass = isProfitable ? 'pnl-profit' : 'pnl-loss';
                const pnlSign = isProfitable ? '+' : '';

                const winRateColor = strat.win_rate >= 50 ? 'var(--neon-green)' : 'var(--neon-red)';
                const pfColor = strat.profit_factor >= 1.5 ? 'var(--neon-green)' : (strat.profit_factor >= 1 ? 'var(--accent-color)' : 'var(--neon-red)');
                const pfText = strat.profit_factor === null ? '∞' : strat.profit_factor.toFixed(2);

                // Sembol kırılımları
                let symbolsHtml = '';
                if (strat.symbols && strat.symbols.length > 0) {
                    symbolsHtml = `
                        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--border-color);">
                            <h5 style="color:var(--text-muted); font-size:0.8rem; margin-bottom:10px;">${isTr ? 'Parite Kırılımı' : 'Pair Breakdown'}</h5>
                            <div style="display:flex; flex-wrap:wrap; gap:10px;">
                    `;

                    strat.symbols.forEach(sym => {
                        const symIsProfitable = sym.pnl > 0;
                        const symPnlClass = symIsProfitable ? 'color:var(--neon-green)' : 'color:var(--neon-red)';
                        const symPnlSign = symIsProfitable ? '+' : '';

                        symbolsHtml += `
                            <div style="background:rgba(0,0,0,0.2); padding:5px 10px; border-radius:4px; font-size:0.8rem;">
                                <span style="color:var(--text-main); font-weight:bold;">${sym.name}</span>:
                                <span style="${symPnlClass}">${symPnlSign}$${sym.pnl.toFixed(2)}</span>
                                <span style="color:var(--text-muted); margin-left:5px;">(${sym.trades} ${isTr ? 'işlem' : 'trades'}, %${sym.win_rate.toFixed(0)})</span>
                            </div>
                        `;
                    });

                    symbolsHtml += `</div></div>`;
                }

                // Tavsiye (Bilingual recommendation)
                const recText = (isTr ? strat.recommendation_tr : strat.recommendation_en) || strat.recommendation || '';
                let recHtml = '';
                if (recText) {
                    let recIcon = 'ℹ️';
                    const upperRec = recText.toUpperCase();
                    if (upperRec.includes('DÜŞÜK') || upperRec.includes('LOW WIN RATE')) recIcon = '🎯';
                    if (upperRec.includes('KRİTİK') || upperRec.includes('CRITICAL') || upperRec.includes('DİKKAT') || upperRec.includes('CAUTION') || upperRec.includes('DRAWDOWN')) recIcon = '⚠️';
                    if (upperRec.includes('MÜKEMMEL') || upperRec.includes('EXCELLENT')) recIcon = '🏆';

                    recHtml = `
                        <div style="margin-top: 15px; padding: 10px; background: rgba(0, 168, 255, 0.05); border-left: 3px solid var(--neon-blue); border-radius: 0 4px 4px 0;">
                            <span style="font-size: 0.85rem; color: var(--text-main);"><span style="margin-right:5px;">${recIcon}</span>${recText}</span>
                        </div>
                    `;
                }

                const cardHtml = `
                    <div class="glass-panel" style="padding: 20px; margin-bottom: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <div>
                                <h3 style="margin: 0; color: var(--neon-blue); display:flex; align-items:center; gap:8px;">
                                    <span class="pulse-dot"></span> ${strat.strategy}
                                </h3>
                                <span style="font-size: 0.8rem; color: var(--text-muted);">${isTr ? 'Zaman Dilimi' : 'Timeframe'}: ${strat.timeframe} | ${isTr ? 'İşlem' : 'Trades'}: ${strat.total_trades}</span>
                            </div>
                            <div style="text-align: right;">
                                <div class="${pnlClass}" style="font-size: 1.5rem; font-weight: bold; font-family: monospace;">
                                    ${pnlSign}$${strat.total_pnl.toFixed(2)}
                                </div>
                                <div style="font-size: 0.8rem; color: var(--text-muted);">${isTr ? 'Toplam PnL' : 'Total PnL'}</div>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-top: 20px; background: rgba(0,0,0,0.2); padding: 15px; border-radius: 8px;">
                            <div>
                                <div style="font-size: 0.8rem; color: var(--text-muted);">${isTr ? 'Başarı Oranı' : 'Win Rate'}</div>
                                <div style="font-size: 1.2rem; font-weight: bold; color: ${winRateColor}; font-family: monospace;">
                                    %${strat.win_rate.toFixed(1)}
                                </div>
                                <div style="font-size: 0.7rem; color: var(--text-muted); margin-top:3px;">
                                    <span style="color:var(--neon-green)">${strat.wins}W</span> / <span style="color:var(--neon-red)">${strat.losses}L</span>
                                </div>
                            </div>
                            <div>
                                <div style="font-size: 0.8rem; color: var(--text-muted);">${isTr ? 'Kâr Faktörü' : 'Profit Factor'}</div>
                                <div style="font-size: 1.2rem; font-weight: bold; color: ${pfColor}; font-family: monospace;">
                                    ${pfText}
                                </div>
                            </div>
                            <div>
                                <div style="font-size: 0.8rem; color: var(--text-muted);">${isTr ? 'Brüt Kâr / Zarar' : 'Gross Profit / Loss'}</div>
                                <div style="font-size: 0.9rem; font-weight: bold; color: var(--neon-green); font-family: monospace; margin-top:2px;">
                                    +$${strat.gross_profit.toFixed(2)}
                                </div>
                                <div style="font-size: 0.9rem; font-weight: bold; color: var(--neon-red); font-family: monospace;">
                                    -$${strat.gross_loss.toFixed(2)}
                                </div>
                            </div>
                            <div>
                                <div style="font-size: 0.8rem; color: var(--text-muted);">${isTr ? 'Maksimum Düşüş' : 'Max Drawdown'}</div>
                                <div style="font-size: 1.2rem; font-weight: bold; color: var(--neon-red); font-family: monospace;">
                                    -%${strat.max_drawdown_pct.toFixed(1)}
                                </div>
                                <div style="font-size: 0.7rem; color: var(--text-muted); margin-top:3px;">
                                    ($${strat.max_drawdown.toFixed(2)})
                                </div>
                            </div>
                        </div>

                        ${symbolsHtml}
                        ${recHtml}
                    </div>
                `;

                container.innerHTML += cardHtml;
            });
        } else {
            container.innerHTML = `<p style="text-align:center; padding: 40px; color:var(--text-muted);">${isTr ? 'Henüz kapanmış işlem verisi bulunamadı.' : 'No closed trade data available yet.'}</p>`;
        }

    } catch (error) {
        console.error('Rapor yükleme hatası:', error);
        container.innerHTML = `<p style="text-align:center; padding: 40px; color:var(--neon-red);">${isTr ? 'Raporlar yüklenirken bir hata oluştu: ' : 'An error occurred while loading reports: '}${error.message}</p>`;
    }
}

// Dil değişiminde açık olan sekmedeyse otomatik yenile
if (typeof window !== 'undefined') {
    window.addEventListener('languageChanged', () => {
        const tabReports = document.getElementById('tab-reports');
        if (tabReports && tabReports.classList.contains('active-tab')) {
            loadStrategyReport();
        }
    });
}

// Global scope'a ekle (HTML onclick için)
window.loadStrategyReport = loadStrategyReport;
