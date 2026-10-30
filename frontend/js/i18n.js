/**
 * CryptoAutomat - Internationalization (i18n) Module
 * English (default) & Turkish multi-language support.
 */

const translations = {
    en: {
        // App brand & sidebar
        "app_title": "CryptoAutomat | Pro Dashboard",
        "brand_name": "Algo",
        "brand_sub": "Bot",
        "system_env": "System Environment",
        "loading": "Loading...",
        "exchange_label": "Exchange:",
        "emergency_stop": "EMERGENCY STOP",

        // Sidebar Menu
        "nav_portfolio": "Portfolio Analysis",
        "nav_ml": "ML Decision Engine",
        "nav_orders": "Active Orders",
        "nav_history": "Trade History",
        "nav_reports": "Performance Reports",
        "nav_builder": "Strategy Builder",
        "nav_strategies": "Strategy Library",
        "nav_settings": "System Settings",
        "nav_data": "Data Laboratory",

        // KPI Cards
        "kpi_balance": "Balance",
        "kpi_balance_sub": "Wallet Balance",
        "kpi_free_margin": "Free Margin",
        "kpi_free_margin_sub": "Available Capital",
        "kpi_used_margin": "Used Margin",
        "kpi_used_margin_sub": "Open Positions",
        "kpi_total_pnl": "Total P&L (Live)",
        "kpi_total_pnl_sub": "Real-time Profit/Loss",

        // Tabs Common
        "active_bots": "Active Trading Bots",
        "create_bot": "Start New Bot",
        "start_bot": "Start Bot",
        "symbol": "Symbol",
        "timeframe": "Timeframe",
        "strategy": "Strategy",
        "status": "Status",
        "actions": "Actions",
        "cancel": "Cancel",
        "save": "Save",
        "delete": "Delete",
        "close": "Close",
        "search": "Search...",
        "select": "Select...",

        // Bot actions
        "bot_stop": "Stop",
        "bot_resume": "Resume",
        "bot_remove": "Remove",
        "bot_running": "Running",
        "bot_stopped": "Stopped",
        "no_bots_running": "No active bots. Click 'Start New Bot' to begin.",

        // Orders / Positions
        "open_positions": "Open Positions",
        "no_open_positions": "No open positions found.",
        "order_direction": "Direction",
        "order_entry": "Entry Price",
        "order_current": "Current Price",
        "order_size": "Position Size",
        "order_pnl": "PnL",
        "order_stop_loss": "Stop Loss",
        "order_take_profit": "Take Profit",
        "close_position": "Close Position",

        // Trade History
        "trade_history_title": "Historical Trades",
        "trade_history_desc": "Audit trail of executed trades and closed positions from the database.",
        "clear_history": "Clear History",
        "closed_at": "Closed Time",
        "pnl_usd": "Net PnL ($)",
        "pnl_pct": "PnL (%)",
        "exit_reason": "Exit Reason",

        // Performance Reports
        "reports_title": "Bot Performance & Metrics",
        "win_rate": "Win Rate",
        "total_trades": "Total Trades",
        "profit_factor": "Profit Factor",
        "max_drawdown": "Max Drawdown",
        "net_profit": "Net Profit",

        // Strategy Builder
        "builder_title": "No-Code Strategy Builder",
        "builder_desc": "Design, backtest and deploy trading rules visually without writing code.",
        "strategy_name": "Strategy Name",
        "indicators": "Indicators",
        "add_indicator": "Add Indicator",
        "long_conditions": "LONG Entry Conditions",
        "short_conditions": "SHORT Entry Conditions",
        "save_strategy": "Save Strategy",
        "test_strategy": "Test Strategy",
        "quick_test": "Quick Backtest",

        // Settings
        "settings_title": "System Settings",
        "risk_settings": "Risk Management",
        "max_risk_trade": "Max Risk Per Trade (%)",
        "max_leverage": "Max Leverage",
        "max_open_positions": "Max Open Positions",
        "api_keys": "API Credentials",
        "save_settings": "Save Settings",
        "test_api": "Test Connection",

        // Data Lab
        "data_lab_title": "Data Laboratory",
        "data_lab_desc": "Download historical market data and manage Parquet Data Lake storage.",
        "download_data": "Download Data",
        "start_date": "Start Date",
        "storage_stats": "Storage Statistics",
        "total_candles": "Total Candles"
    },
    tr: {
        // App brand & sidebar
        "app_title": "CryptoAutomat | Profesyonel Panel",
        "brand_name": "Algo",
        "brand_sub": "Bot",
        "system_env": "Sistem Çevresi",
        "loading": "Yükleniyor...",
        "exchange_label": "Borsa:",
        "emergency_stop": "ACİL DURDURMA",

        // Sidebar Menu
        "nav_portfolio": "Portföy Analizi",
        "nav_ml": "ML Karar Motoru",
        "nav_orders": "Aktif Emirler",
        "nav_history": "İşlem Geçmişi",
        "nav_reports": "Performans Raporları",
        "nav_builder": "Strateji Oluşturucu",
        "nav_strategies": "Strateji Kütüphanesi",
        "nav_settings": "Sistem Ayarları",
        "nav_data": "Veri Laboratuvarı",

        // KPI Cards
        "kpi_balance": "Bakiye (Balance)",
        "kpi_balance_sub": "Cüzdan Bakiyesi",
        "kpi_free_margin": "Serbest Marjin",
        "kpi_free_margin_sub": "Mevcut Nakit",
        "kpi_used_margin": "Kullanılan Marjin",
        "kpi_used_margin_sub": "Açık Pozisyonlar",
        "kpi_total_pnl": "Toplam P&L (Live)",
        "kpi_total_pnl_sub": "Anlık Kâr/Zarar",

        // Tabs Common
        "active_bots": "Aktif Ticaret Botları",
        "create_bot": "Yeni Bot Başlat",
        "start_bot": "Botu Başlat",
        "symbol": "Sembol",
        "timeframe": "Zaman Dilimi",
        "strategy": "Strateji",
        "status": "Durum",
        "actions": "İşlemler",
        "cancel": "İptal",
        "save": "Kaydet",
        "delete": "Sil",
        "close": "Kapat",
        "search": "Ara...",
        "select": "Seçiniz...",

        // Bot actions
        "bot_stop": "Durdur",
        "bot_resume": "Devam Et",
        "bot_remove": "Kaldır",
        "bot_running": "Çalışıyor",
        "bot_stopped": "Durduruldu",
        "no_bots_running": "Aktif bot bulunmuyor. Başlatmak için 'Yeni Bot Başlat'a tıklayın.",

        // Orders / Positions
        "open_positions": "Açık Pozisyonlar",
        "no_open_positions": "Açık pozisyon bulunmuyor.",
        "order_direction": "Yön",
        "order_entry": "Giriş Fiyatı",
        "order_current": "Güncel Fiyat",
        "order_size": "Pozisyon Büyüklüğü",
        "order_pnl": "Kâr/Zarar",
        "order_stop_loss": "Zarar Durdur (SL)",
        "order_take_profit": "Kâr Al (TP)",
        "close_position": "Pozisyonu Kapat",

        // Trade History
        "trade_history_title": "İşlem Geçmişi",
        "trade_history_desc": "Veritabanına kaydedilen tüm geçmiş işlemler ve pozisyon kayıtları.",
        "clear_history": "Geçmişi Temizle",
        "closed_at": "Kapanış Zamanı",
        "pnl_usd": "Net K/Z ($)",
        "pnl_pct": "K/Z (%)",
        "exit_reason": "Çıkış Nedeni",

        // Performance Reports
        "reports_title": "Bot Performansı ve Metrikler",
        "win_rate": "Kazanma Oranı",
        "total_trades": "Toplam İşlem",
        "profit_factor": "Kâr Faktörü",
        "max_drawdown": "Maksimum Düşüş",
        "net_profit": "Net Kâr",

        // Strategy Builder
        "builder_title": "Kodsuz Strateji Oluşturucu",
        "builder_desc": "Kod yazmadan görsel olarak al/sat kuralları belirleyin ve anında test edin.",
        "strategy_name": "Strateji Adı",
        "indicators": "İndikatörler",
        "add_indicator": "İndikatör Ekle",
        "long_conditions": "LONG Giriş Koşulları",
        "short_conditions": "SHORT Giriş Koşulları",
        "save_strategy": "Stratejiyi Kaydet",
        "test_strategy": "Stratejiyi Test Et",
        "quick_test": "Hızlı Backtest",

        // Settings
        "settings_title": "Sistem Ayarları",
        "risk_settings": "Risk Yönetimi",
        "max_risk_trade": "İşlem Başına Maksimum Risk (%)",
        "max_leverage": "Maksimum Kaldıraç",
        "max_open_positions": "Maksimum Açık Pozisyon",
        "api_keys": "API Anahtarları",
        "save_settings": "Ayarları Kaydet",
        "test_api": "Bağlantıyı Test Et",

        // Data Lab
        "data_lab_title": "Veri Laboratuvarı",
        "data_lab_desc": "Geçmiş piyasa verilerini indirin ve Parquet Data Lake deposunu yönetin.",
        "download_data": "Veri İndir",
        "start_date": "Başlangıç Tarihi",
        "storage_stats": "Depolama İstatistikleri",
        "total_candles": "Toplam Mum"
    }
};

class I18nManager {
    constructor() {
        // Default language is English (fallback or stored preference)
        const savedLang = localStorage.getItem('app_lang');
        this.currentLang = (savedLang === 'tr' || savedLang === 'en') ? savedLang : 'en';
    }

    t(key) {
        const langData = translations[this.currentLang] || translations.en;
        return langData[key] || translations.en[key] || key;
    }

    setLanguage(lang) {
        if (lang !== 'en' && lang !== 'tr') return;
        this.currentLang = lang;
        localStorage.setItem('app_lang', lang);
        document.documentElement.lang = lang;
        this.updateDOM();
        this.updateSwitcherUI();
    }

    updateDOM() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = this.t(key);
            if (translation) {
                // If element has nested icon, preserve it
                const icon = el.querySelector('i, svg');
                if (icon) {
                    el.innerHTML = '';
                    el.appendChild(icon);
                    el.appendChild(document.createTextNode(' ' + translation));
                } else {
                    el.textContent = translation;
                }
            }
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            const translation = this.t(key);
            if (translation) {
                el.setAttribute('placeholder', translation);
            }
        });
    }

    updateSwitcherUI() {
        const btnEn = document.getElementById('lang-btn-en');
        const btnTr = document.getElementById('lang-btn-tr');
        if (btnEn && btnTr) {
            btnEn.classList.toggle('active', this.currentLang === 'en');
            btnTr.classList.toggle('active', this.currentLang === 'tr');
        }
    }

    init() {
        document.documentElement.lang = this.currentLang;
        this.updateDOM();
        this.updateSwitcherUI();

        const btnEn = document.getElementById('lang-btn-en');
        const btnTr = document.getElementById('lang-btn-tr');

        if (btnEn) btnEn.addEventListener('click', () => this.setLanguage('en'));
        if (btnTr) btnTr.addEventListener('click', () => this.setLanguage('tr'));
    }
}

export const i18n = new I18nManager();
export default i18n;
if (typeof window !== 'undefined') {
    window.i18n = i18n;
}
