/**
 * CryptoAlgoBot - No-Code Strateji Oluşturucu
 * Frontend JavaScript Logic
 */

// Global state
let strategyData = {
    name: 'Yeni Strateji',
    description: '',
    timeframe: '15m',
    indicators: [],
    conditions: {
        long: { logic: 'AND', rules: [] },
        short: { logic: 'AND', rules: [] }
    },
    risk: {
        stop_loss: { type: 'ATR', multiplier: 2.0 },
        take_profit: { type: 'ATR', multiplier: 3.0 },
        max_risk_percent: 2.0
    }
};

let pendingIndicator = null;

// İndikatör parametreleri
const INDICATOR_PARAMS = {
    'EMA': [{ name: 'length', type: 'number', default: 20, min: 1, max: 200 }],
    'SMA': [{ name: 'length', type: 'number', default: 20, min: 1, max: 200 }],
    'RSI': [{ name: 'length', type: 'number', default: 14, min: 1, max: 50 }],
    'MACD': [
        { name: 'fast', type: 'number', default: 12, min: 1, max: 50 },
        { name: 'slow', type: 'number', default: 26, min: 1, max: 100 },
        { name: 'signal', type: 'number', default: 9, min: 1, max: 50 }
    ],
    'Stochastic': [
        { name: 'k', type: 'number', default: 14, min: 1, max: 50 },
        { name: 'd', type: 'number', default: 3, min: 1, max: 50 }
    ],
    'ATR': [{ name: 'period', type: 'number', default: 14, min: 1, max: 50 }],
    'Bollinger': [
        { name: 'length', type: 'number', default: 20, min: 1, max: 100 },
        { name: 'std', type: 'number', default: 2.0, min: 0.5, max: 5.0, step: 0.1 }
    ],
    'Supertrend': [
        { name: 'multiplier', type: 'number', default: 3.0, min: 1.0, max: 10.0, step: 0.1 },
        { name: 'period', type: 'number', default: 10, min: 1, max: 50 }
    ],
    'OBV': [],
    'VWAP': [],
    'MFI': [{ name: 'period', type: 'number', default: 14, min: 1, max: 50 }]
};

/**
 * İndikatör ekleme
 */
function addIndicator(type) {
    const params = INDICATOR_PARAMS[type] || [];
    
    if (params.length === 0) {
        // Parametre yoksa direkt ekle
        addIndicatorToStrategy(type, {});
    } else {
        // Modal aç
        openParamModal(type, params);
    }
}

/**
 * Parametre modal'ı aç
 */
function openParamModal(type, params) {
    pendingIndicator = { type, params };
    
    document.getElementById('modal-title').textContent = `${type} Parametreleri`;
    
    const paramsContainer = document.getElementById('modal-params');
    paramsContainer.innerHTML = '';
    
    params.forEach(param => {
        const group = document.createElement('div');
        group.className = 'param-group';
        
        const label = document.createElement('label');
        label.className = 'param-label';
        label.textContent = param.name.charAt(0).toUpperCase() + param.name.slice(1);
        
        const input = document.createElement('input');
        input.type = param.type;
        input.className = 'param-input';
        input.value = param.default;
        if (param.min) input.min = param.min;
        if (param.max) input.max = param.max;
        if (param.step) input.step = param.step;
        input.dataset.param = param.name;
        
        group.appendChild(label);
        group.appendChild(input);
        paramsContainer.appendChild(group);
    });
    
    document.getElementById('param-modal').style.display = 'flex';
}

/**
 * Modal kapat
 */
function closeModal() {
    document.getElementById('param-modal').style.display = 'none';
    pendingIndicator = null;
}

/**
 * İndikatörü onayla ve ekle
 */
function confirmIndicator() {
    if (!pendingIndicator) return;
    
    const params = {};
    const inputs = document.querySelectorAll('#modal-params .param-input');
    
    inputs.forEach(input => {
        const paramName = input.dataset.param;
        let value = input.type === 'number' ? parseFloat(input.value) : input.value;
        params[paramName] = value;
    });
    
    addIndicatorToStrategy(pendingIndicator.type, params);
    closeModal();
}

/**
 * İndikatörü strategy'ye ekle
 */
function addIndicatorToStrategy(type, params) {
    const id = `${type.toLowerCase()}_${Date.now()}`;
    
    strategyData.indicators.push({
        id,
        type,
        parameters: params
    });
    
    updatePreview();
    renderConditionSelectors();
}

/**
 * Koşul rule ekle
 */
function addConditionRule(side) {
    const container = document.getElementById(`${side}-conditions`);
    const ruleId = `rule-${Date.now()}`;
    
    const ruleDiv = document.createElement('div');
    ruleDiv.className = 'condition-rule';
    ruleDiv.dataset.ruleId = ruleId;
    
    ruleDiv.innerHTML = `
        <select class="condition-select indicator-select" data-side="${side}">
            <option value="">İndikatör Seç...</option>
        </select>
        <select class="condition-select operator-select">
            <option value="<">&lt;</option>
            <option value=">">&gt;</option>
            <option value="=">=</option>
            <option value="<=">&le;</option>
            <option value=">=">&ge;</option>
        </select>
        <input type="text" class="condition-input value-input" placeholder="Değer">
        <button class="btn-remove" onclick="removeRule('${ruleId}')">✕</button>
    `;
    
    container.appendChild(ruleDiv);
    
    // İndikatör seçeneklerini doldur
    updateIndicatorSelects();
}

/**
 * Rule kaldır
 */
function removeRule(ruleId) {
    const rule = document.querySelector(`[data-rule-id="${ruleId}"]`);
    if (rule) rule.remove();
    
    updateStrategyData();
}

/**
 * Logic ayarla (AND/OR)
 */
function setLogic(side, logic) {
    strategyData.conditions[side].logic = logic;
    
    // UI güncelle
    const container = document.querySelector(`#${side}-conditions`).previousElementSibling;
    const buttons = container.querySelectorAll('.logic-btn');
    buttons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.includes(logic === 'AND' ? 'VE' : 'VEYA')) {
            btn.classList.add('active');
        }
    });
    
    updatePreview();
}

/**
 * İndikatör select'lerini güncelle
 */
function updateIndicatorSelects() {
    const selects = document.querySelectorAll('.indicator-select');
    
    selects.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = '<option value="">İndikatör Seç...</option>';
        
        strategyData.indicators.forEach(ind => {
            const option = document.createElement('option');
            option.value = ind.id;
            option.textContent = `${ind.type} (${JSON.stringify(ind.parameters)})`;
            select.appendChild(option);
        });
        
        select.value = currentValue;
    });
}

/**
 * Koşul select'lerini render et
 */
function renderConditionSelectors() {
    updateIndicatorSelects();
}

/**
 * Strategy data'yı güncelle
 */
function updateStrategyData() {
    // LONG koşulları
    strategyData.conditions.long.rules = [];
    document.querySelectorAll('#long-conditions .condition-rule').forEach(rule => {
        const indicator = rule.querySelector('.indicator-select').value;
        const operator = rule.querySelector('.operator-select').value;
        const value = rule.querySelector('.value-input').value;
        
        if (indicator && operator && value) {
            strategyData.conditions.long.rules.push({
                indicator,
                operator,
                value: isNaN(value) ? value : parseFloat(value)
            });
        }
    });
    
    // SHORT koşulları
    strategyData.conditions.short.rules = [];
    document.querySelectorAll('#short-conditions .condition-rule').forEach(rule => {
        const indicator = rule.querySelector('.indicator-select').value;
        const operator = rule.querySelector('.operator-select').value;
        const value = rule.querySelector('.value-input').value;
        
        if (indicator && operator && value) {
            strategyData.conditions.short.rules.push({
                indicator,
                operator,
                value: isNaN(value) ? value : parseFloat(value)
            });
        }
    });
    
    // Risk parametreleri
    strategyData.risk.stop_loss.multiplier = parseFloat(document.getElementById('stop-loss').value) || 2.0;
    strategyData.risk.take_profit.multiplier = parseFloat(document.getElementById('take-profit').value) || 3.0;
    strategyData.risk.max_risk_percent = parseFloat(document.getElementById('max-risk').value) || 2.0;
    
    // Genel bilgiler
    strategyData.name = document.getElementById('strategy-name').value;
    strategyData.timeframe = document.getElementById('timeframe').value;
    
    updatePreview();
}

/**
 * Preview güncelle
 */
function updatePreview() {
    document.getElementById('preview-indicators').textContent = strategyData.indicators.length;
    document.getElementById('preview-long').textContent = strategyData.conditions.long.rules.length;
    document.getElementById('preview-short').textContent = strategyData.conditions.short.rules.length;
    
    // JSON preview
    document.getElementById('json-preview').textContent = JSON.stringify(strategyData, null, 2);
}

/**
 * Stratejiyi test et
 */
async function testStrategy() {
    updateStrategyData();
    
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = '⏳ Test ediliyor...';
    btn.disabled = true;
    
    try {
        const response = await fetch('/api/v1/strategy/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(strategyData)
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            alert(`✅ Test Başarılı!\n\nWin Rate: ${result.metrics.win_rate}%\nTotal Trades: ${result.metrics.total_trades}`);
        } else {
            alert(`❌ Test Hatası:\n${result.message}`);
        }
    } catch (error) {
        alert(`❌ Test Hatası:\n${error.message}`);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

/**
 * Stratejiyi kaydet
 */
async function saveStrategy() {
    updateStrategyData();
    
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = '⏳ Kaydediliyor...';
    btn.disabled = true;
    
    try {
        const response = await fetch('/api/v1/strategy/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(strategyData)
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            alert(`✅ Strateji Kaydedildi!\n\nDosya: ${result.filename}`);
        } else {
            alert(`❌ Kaydetme Hatası:\n${result.message}`);
        }
    } catch (error) {
        alert(`❌ Kaydetme Hatası:\n${error.message}`);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

/**
 * Event listeners
 */
document.addEventListener('DOMContentLoaded', () => {
    // Input change listeners
    document.querySelectorAll('input, select').forEach(input => {
        input.addEventListener('change', updateStrategyData);
        input.addEventListener('input', updateStrategyData);
    });
    
    // Initial preview
    updatePreview();
});
