/**
 * Strategy Builder - Frontend JavaScript Motoru
 * 
 * No-Code Strateji Oluşturucu için API entegrasyonu.
 * Backend: api/routers/strategy_builder.py
 */

// ============================================================================
// GLOBAL DEĞİŞKENLER
// ============================================================================

let selectedIndicators = [];
let longConditions = [];
let shortConditions = [];
let longLogic = 'AND';
let shortLogic = 'AND';

// ============================================================================
// SAYFA YÜKLENDİĞİNDE
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('[Strategy Builder] Sayfa yüklendi');
    
    // İndikatör butonlarını dinle
    setupIndicatorButtons();
    
    // Kaydedilmiş stratejileri yükle
    loadStrategies();
    
    // Varsayılan koşulları ekle
    addCondition('long');
    addCondition('short');
});

// ============================================================================
// İNDİKATÖR SEÇİMİ
// ============================================================================

function setupIndicatorButtons() {
    const buttons = document.querySelectorAll('.indicator-btn');
    
    buttons.forEach(btn => {
        btn.addEventListener('click', function() {
            const type = this.dataset.type;
            const params = JSON.parse(this.dataset.params);
            
            // Toggle selection
            this.classList.toggle('selected');
            
            if (this.classList.contains('selected')) {
                // İndikatörü listeye ekle
                selectedIndicators.push({
                    name: type,
                    ...params
                });
                console.log(`[OK] İndikatör eklendi: ${type}`, params);
            } else {
                // İndikatörü listeden çıkar
                selectedIndicators = selectedIndicators.filter(ind => ind.name !== type);
                console.log(`[OK] İndikatör çıkarıldı: ${type}`);
            }
        });
    });
}

// ============================================================================
// KOŞUL OLUŞTURUCU
// ============================================================================

function addCondition(type) {
    const container = document.getElementById(`${type}-conditions-container`);
    const conditionId = `${type}-${Date.now()}`;
    
    // Koşul objesi oluştur
    const condition = {
        id: conditionId,
        indicator: '',
        operator: '<',
        value: ''
    };
    
    // Array'e ekle
    if (type === 'long') {
        longConditions.push(condition);
    } else {
        shortConditions.push(condition);
    }
    
    // HTML oluştur
    const conditionHTML = createConditionHTML(condition, type);
    container.insertAdjacentHTML('beforeend', conditionHTML);
    
    // Event listener'ları ekle
    setupConditionListeners(conditionId, type);
    
    console.log(`[OK] ${type.toUpperCase()} koşulu eklendi:`, conditionId);
}

function createConditionHTML(condition, type) {
    return `
        <div class="condition-row" id="${condition.id}">
            <select class="form-select condition-indicator">
                <option value="">İndikatör Seç...</option>
                <option value="RSI_14">RSI (14)</option>
                <option value="MACD_12_26_9">MACD (12, 26, 9)</option>
                <option value="MACD_Signal_12_26_9">MACD Signal</option>
                <option value="EMA_20">EMA (20)</option>
                <option value="SMA_20">SMA (20)</option>
                <option value="ATR_14">ATR (14)</option>
                <option value="STOCH_K_14_3">Stochastic %K</option>
                <option value="STOCH_D_14_3">Stochastic %D</option>
                <option value="BBU_20_2.0">Bollinger Upper</option>
                <option value="BBL_20_2.0">Bollinger Lower</option>
            </select>
            
            <select class="form-select condition-operator">
                <option value="&lt;">&lt;</option>
                <option value="&gt;">&gt;</option>
                <option value="&lt;=">&lt;=</option>
                <option value="&gt;=">&gt;=</option>
                <option value="==">=</option>
                <option value="!=">!=</option>
            </select>
            
            <input type="text" class="form-input condition-value" placeholder="Değer (örn: 30)">
            
            <button class="btn-remove" onclick="removeCondition('${condition.id}', '${type}')">✕</button>
        </div>
    `;
}

function setupConditionListeners(conditionId, type) {
    const row = document.getElementById(conditionId);
    if (!row) return;
    
    const indicatorSelect = row.querySelector('.condition-indicator');
    const operatorSelect = row.querySelector('.condition-operator');
    const valueInput = row.querySelector('.condition-value');
    
    // Değişiklikleri dinle ve array'i güncelle
    indicatorSelect.addEventListener('change', function() {
        const conditions = type === 'long' ? longConditions : shortConditions;
        const condition = conditions.find(c => c.id === conditionId);
        if (condition) {
            condition.indicator = this.value;
        }
    });
    
    operatorSelect.addEventListener('change', function() {
        const conditions = type === 'long' ? longConditions : shortConditions;
        const condition = conditions.find(c => c.id === conditionId);
        if (condition) {
            condition.operator = this.value;
        }
    });
    
    valueInput.addEventListener('input', function() {
        const conditions = type === 'long' ? longConditions : shortConditions;
        const condition = conditions.find(c => c.id === conditionId);
        if (condition) {
            condition.value = this.value;
        }
    });
}

function removeCondition(conditionId, type) {
    const row = document.getElementById(conditionId);
    if (row) {
        row.remove();
    }
    
    const conditions = type === 'long' ? longConditions : shortConditions;
    const index = conditions.findIndex(c => c.id === conditionId);
    if (index !== -1) {
        conditions.splice(index, 1);
    }
    
    console.log(`[OK] ${type.toUpperCase()} koşulu çıkarıldı:`, conditionId);
}

// ============================================================================
// LOGIC SEÇİMİ (AND/OR)
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    // LONG logic selector
    const longLogicButtons = document.querySelectorAll('#long-logic-selector .logic-btn');
    longLogicButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            longLogicButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            longLogic = this.dataset.logic;
            console.log('[OK] LONG logic:', longLogic);
        });
    });
    
    // SHORT logic selector
    const shortLogicButtons = document.querySelectorAll('#short-logic-selector .logic-btn');
    shortLogicButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            shortLogicButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            shortLogic = this.dataset.logic;
            console.log('[OK] SHORT logic:', shortLogic);
        });
    });
});

// ============================================================================
// JSON OLUŞTURMA
// ============================================================================

function buildStrategyJSON() {
    // Strateji bilgilerini topla
    const name = document.getElementById('strategy-name').value.trim();
    const description = document.getElementById('strategy-description').value.trim();
    
    // Risk parametreleri
    const stopLossATR = parseFloat(document.getElementById('stop-loss-atr').value) || 2.0;
    const takeProfitATR = parseFloat(document.getElementById('take-profit-atr').value) || 4.0;
    const maxRiskPercent = parseFloat(document.getElementById('max-risk-percent').value) || 2.0;
    
    // LONG koşullarını oluştur
    const longConditionsData = longConditions.map(c => ({
        indicator: c.indicator,
        operator: c.operator,
        value: isNaN(parseFloat(c.value)) ? c.value : parseFloat(c.value)
    })).filter(c => c.indicator && c.value);
    
    // SHORT koşullarını oluştur
    const shortConditionsData = shortConditions.map(c => ({
        indicator: c.indicator,
        operator: c.operator,
        value: isNaN(parseFloat(c.value)) ? c.value : parseFloat(c.value)
    })).filter(c => c.indicator && c.value);
    
    // JSON objesi oluştur
    const strategyJSON = {
        name: name || 'Yeni Strateji',
        description: description || '',
        indicators: selectedIndicators,
        conditions: {
            LONG: {
                logic: longLogic,
                conditions: longConditionsData
            },
            SHORT: {
                logic: shortLogic,
                conditions: shortConditionsData
            }
        },
        risk: {
            stop_loss_atr_multiplier: stopLossATR,
            take_profit_atr_multiplier: takeProfitATR,
            max_risk_percent: maxRiskPercent
        }
    };
    
    console.log('[OK] Strategy JSON oluşturuldu:', strategyJSON);
    return strategyJSON;
}

// ============================================================================
// API ÇAĞRILARI
// ============================================================================

/**
 * Stratejiyi kaydet
 */
async function saveStrategy() {
    try {
        console.log('[INFO] Strateji kaydediliyor...');
        
        // JSON oluştur
        const strategyData = buildStrategyJSON();
        
        // Validasyon
        if (strategyData.conditions.LONG.conditions.length === 0 && 
            strategyData.conditions.SHORT.conditions.length === 0) {
            alert('⚠️ En az bir LONG veya SHORT koşulu eklemelisiniz!');
            return;
        }
        
        // API çağrısı
        const response = await fetch('/api/v1/strategy/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(strategyData)
        });
        
        const result = await response.json();
        
        if (response.ok && result.status === 'success') {
            console.log('[OK] Strateji kaydedildi:', result.filename);
            alert(`✅ ${result.message}`);
            
            // Formu temizle
            clearForm();
            
            // Strateji listesini yenile
            loadStrategies();
        } else {
            console.error('[HATA] Strateji kaydedilemedi:', result);
            alert(`❌ Hata: ${result.detail || 'Bilinmeyen hata'}`);
        }
        
    } catch (error) {
        console.error('[HATA] Strateji kaydetme hatası:', error);
        alert(`❌ Bağlantı hatası: ${error.message}`);
    }
}

/**
 * Kaydedilmiş stratejileri yükle
 */
async function loadStrategies() {
    try {
        console.log('[INFO] Stratejiler yükleniyor...');
        
        const response = await fetch('/api/v1/strategy/list');
        const result = await response.json();
        
        if (response.ok && result.status === 'success') {
            const container = document.getElementById('saved-strategies-list');
            
            if (result.count === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: var(--text-muted);">
                        📭 Henüz kaydedilmiş strateji yok
                    </div>
                `;
                return;
            }
            
            // Strateji listesini oluştur
            let html = '';
            result.strategies.forEach(strategy => {
                html += `
                    <div class="strategy-item" onclick="loadStrategy('${strategy.filename}')">
                        <div class="strategy-item-header">
                            <span class="strategy-item-name">${strategy.name}</span>
                            <span class="strategy-item-meta">${strategy.indicators_count} indikatör</span>
                        </div>
                        <div class="strategy-item-meta">${strategy.created_at}</div>
                    </div>
                `;
            });
            
            container.innerHTML = html;
            console.log(`[OK] ${result.count} strateji yüklendi`);
        } else {
            console.error('[HATA] Stratejiler yüklenemedi:', result);
        }
        
    } catch (error) {
        console.error('[HATA] Strateji yükleme hatası:', error);
    }
}

/**
 * Strateji yükle
 */
async function loadStrategy(filename) {
    try {
        console.log('[INFO] Strateji yükleniyor:', filename);
        
        const response = await fetch(`/api/v1/strategy/info/${filename}`);
        const result = await response.json();
        
        if (response.ok && result.status === 'success') {
            const data = result.data;
            
            // Formu doldur
            document.getElementById('strategy-name').value = data.name || '';
            document.getElementById('strategy-description').value = data.description || '';
            
            // Risk parametreleri
            if (data.risk) {
                document.getElementById('stop-loss-atr').value = data.risk.stop_loss_atr_multiplier || 2.0;
                document.getElementById('take-profit-atr').value = data.risk.take_profit_atr_multiplier || 4.0;
                document.getElementById('max-risk-percent').value = data.risk.max_risk_percent || 2.0;
            }
            
            // İndikatörleri işaretle
            // TODO: İndikatör butonlarını seçili yap
            
            // Koşulları yükle
            // TODO: LONG ve SHORT koşullarını ekle
            
            console.log('[OK] Strateji yüklendi:', filename);
            alert(`✅ Strateji '${data.name}' yüklendi`);
        } else {
            console.error('[HATA] Strateji yüklenemedi:', result);
            alert(`❌ Hata: ${result.detail || 'Bilinmeyen hata'}`);
        }
        
    } catch (error) {
        console.error('[HATA] Strateji yükleme hatası:', error);
        alert(`❌ Bağlantı hatası: ${error.message}`);
    }
}

/**
 * Stratejiyi test et
 */
async function testStrategy() {
    try {
        console.log('[INFO] Strateji test ediliyor...');
        
        // JSON oluştur
        const strategyData = buildStrategyJSON();
        
        // Test parametreleri
        const testData = {
            strategy: strategyData,
            symbol: 'BTC/USDT',
            timeframe: '1h',
            days: 30
        };
        
        // API çağrısı
        const response = await fetch('/api/v1/strategy/test', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testData)
        });
        
        const result = await response.json();
        
        if (response.ok && result.status === 'success') {
            console.log('[OK] Test tamamlandı:', result.metrics);
            
            // Test sonuçlarını göster
            displayTestResults(result.metrics);
        } else {
            console.error('[HATA] Test başarısız:', result);
            alert(`❌ Hata: ${result.detail || 'Bilinmeyen hata'}`);
        }
        
    } catch (error) {
        console.error('[HATA] Test hatası:', error);
        alert(`❌ Bağlantı hatası: ${error.message}`);
    }
}

/**
 * Test sonuçlarını göster
 */
function displayTestResults(metrics) {
    const container = document.getElementById('test-results-content');
    const resultsDiv = document.getElementById('test-results');
    
    resultsDiv.style.display = 'block';
    
    container.innerHTML = `
        <div style="margin-bottom: 10px;">
            <strong>Toplam Mum:</strong> ${metrics.total_candles}
        </div>
        <div style="margin-bottom: 10px;">
            <strong>Toplam Sinyal:</strong> ${metrics.total_signals} (${metrics.signal_ratio})
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 10px;">
            <div style="background: rgba(46, 160, 67, 0.1); padding: 10px; border-radius: 6px; text-align: center;">
                <div style="font-size: 1.5rem; color: var(--neon-green);">${metrics.long_signals}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">AL Sinyali</div>
            </div>
            <div style="background: rgba(248, 81, 73, 0.1); padding: 10px; border-radius: 6px; text-align: center;">
                <div style="font-size: 1.5rem; color: var(--neon-red);">${metrics.short_signals}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">SAT Sinyali</div>
            </div>
            <div style="background: rgba(255, 255, 255, 0.05); padding: 10px; border-radius: 6px; text-align: center;">
                <div style="font-size: 1.5rem; color: var(--text-muted);">${metrics.hold_signals}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">BEKLE</div>
            </div>
        </div>
        <div style="margin-bottom: 10px;">
            <strong>İndikatörler:</strong>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 5px;">
                ${metrics.indicators_calculated.join(', ')}
            </div>
        </div>
    `;
}

/**
 * Formu temizle
 */
function clearForm() {
    // Strateji bilgileri
    document.getElementById('strategy-name').value = 'Yeni Strateji';
    document.getElementById('strategy-description').value = '';
    
    // Risk parametreleri
    document.getElementById('stop-loss-atr').value = 2.0;
    document.getElementById('take-profit-atr').value = 4.0;
    document.getElementById('max-risk-percent').value = 2.0;
    
    // İndikatörleri temizle
    selectedIndicators = [];
    document.querySelectorAll('.indicator-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    // Koşulları temizle
    longConditions = [];
    shortConditions = [];
    document.getElementById('long-conditions-container').innerHTML = '';
    document.getElementById('short-conditions-container').innerHTML = '';
    
    // Varsayılan koşulları ekle
    addCondition('long');
    addCondition('short');
    
    // Test sonuçlarını gizle
    document.getElementById('test-results').style.display = 'none';
    
    console.log('[OK] Form temizlendi');
}

// ============================================================================
// YARDIMCI FONKSİYONLAR
// ============================================================================

// İndikatör arama
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('indicator-search');
    
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const buttons = document.querySelectorAll('.indicator-btn');
        
        buttons.forEach(btn => {
            const text = btn.textContent.toLowerCase();
            if (text.includes(searchTerm)) {
                btn.style.display = 'block';
            } else {
                btn.style.display = 'none';
            }
        });
    });
});
