/**
 * CryptoAutomat - Comprehensive Internationalization (i18n) Engine
 * Seamless dual-language runtime switching (EN default / TR full support)
 */

class I18nManager {
    constructor() {
        const savedLang = localStorage.getItem('app_lang');
        this.currentLang = (savedLang === 'tr' || savedLang === 'en') ? savedLang : 'en';

        // Translation dictionary for dynamic JS calls & toast notifications
        this.messages = {
            en: {
                // General & Nav
                "app_title": "AlgoBot",
                "system_env": "System Environment",
                "loading": "Loading...",
                "emergency_stop": "EMERGENCY STOP",
                "nav_portfolio": "Portfolio Analysis",
                "nav_ml": "ML Decision Engine",
                "nav_orders": "Active Orders",
                "nav_history": "Trade History",
                "nav_reports": "Performance Reports",
                "nav_builder": "Strategy Builder",
                "nav_strategies": "Strategy Library",
                "nav_settings": "System Settings",
                "nav_data": "Data Laboratory",
                "select_symbol": "Select Symbol...",
                "select_strategy": "Select Strategy...",
                "select_timeframe": "Select Timeframe...",
                "refresh": "Refresh",
                "clear_history": "Clear History",
                "delete": "Delete",
                "date": "Date",
                "symbol": "Symbol",
                "action": "Action",
                "accuracy": "Accuracy",
                "metrics": "Metrics",
                "features": "Features",

                // Bot Operations
                "bot_started_success": "Bot launched successfully!",
                "bot_stopped_success": "Bot has been stopped.",
                "bot_resumed_success": "Bot resumed execution.",
                "bot_removed_success": "Bot removed.",
                "no_active_bots": "No active bots. You can start a new bot above.",
                "confirm_kill": "Are you sure you want to trigger EMERGENCY STOP? All bots will be halted.",

                // Settings & API
                "api_saved_success": "API credentials encrypted and saved successfully.",
                "api_testing": "Testing API connection with Binance...",
                "api_test_success": "Binance API connection verified!",
                "api_test_failed": "API connection failed. Please verify credentials.",
                "select_symbol_timeframe": "Please select a symbol and timeframe!",

                // Data Lab
                "data_download_started": "Historical data ingestion started.",
                "data_download_stopped": "Data ingestion stopped.",
                "all_data_deleted": "Historical data deleted.",

                // Strategy Builder
                "strategy_saved_success": "Strategy saved successfully.",
                "testing": "Running backtest...",

                // Trade History
                "no_trade_history": "No trade history available yet.",

                // ML Decision Engine
                "ml_training_started": "ML model training pipeline initiated...",
                "ml_training_success": "ML model trained successfully!",
                "ml_training_failed": "ML training failed",
                "ml_data_preparing": "Preparing dataset...",
                "ml_training_history_cleared": "Training history cleared successfully.",
                "ml_model_deleted": "Model deleted successfully.",
                "ml_select_strategy_symbol": "Please select both a strategy and a symbol!",
                "ml_select_symbol_timeframe": "Please select both a symbol and a timeframe!",
                "ml_candle_min_100": "Candle count must be at least 100!",
                "ml_tp_range": "TP multiplier must be between 0.5 and 10!",
                "ml_sl_range": "SL multiplier must be between 0.5 and 10!",
                "ml_visual_analysis_started": "Visual Decision Simulation initiated...",
                "ml_visual_analysis_success": "Visual Decision Simulation complete!",
                "ml_visual_analysis_failed": "Simulation failed",
                "ml_no_trained_models": "No trained models available yet.",
                "ml_no_data_for_pair": "No data found for this symbol/timeframe!",
                "ml_db_candles_available": "Available: {dbCount} candles - will use {limit} candles",
                "ml_db_candles_shortage": "Database has only {dbCount} candles! Ingest more data first.",
                "ml_feature_importance_title": "Model Feature Importance",
                "ml_feature_importance_xaxis": "Importance (%)",
                "ml_model_ready_for_hub": "Model is now ready for use in Strategy Decision Hub.",
                "ml_load_error": "Load Error",
                "ml_samples": "samples",
                "ml_training_error_title": "Training Error!"
            },
            tr: {
                // General & Nav
                "app_title": "AlgoBot",
                "system_env": "Sistem Durumu",
                "loading": "Yükleniyor...",
                "emergency_stop": "ACİL DURDURMA",
                "nav_portfolio": "Portföy Analizi",
                "nav_ml": "ML Karar Motoru",
                "nav_orders": "Aktif Emirler",
                "nav_history": "İşlem Geçmişi",
                "nav_reports": "Performans Raporları",
                "nav_builder": "Strateji Oluşturucu",
                "nav_strategies": "Strateji Kütüphanesi",
                "nav_settings": "Sistem Ayarları",
                "nav_data": "Veri Laboratuvarı",
                "select_symbol": "Sembol Seçin...",
                "select_strategy": "Strateji Seçin...",
                "select_timeframe": "Timeframe Seçin...",
                "refresh": "Yenile",
                "clear_history": "Geçmişi Temizle",
                "delete": "Sil",
                "date": "Tarih",
                "symbol": "Sembol",
                "action": "İşlem",
                "accuracy": "Doğruluk",
                "metrics": "Metrikler",
                "features": "Özellikler",

                // Bot Operations
                "bot_started_success": "Bot başarıyla başlatıldı!",
                "bot_stopped_success": "Bot durduruldu.",
                "bot_resumed_success": "Bot yeniden başlatıldı.",
                "bot_removed_success": "Bot kaldırıldı.",
                "no_active_bots": "Aktif bot yok. Yukarıdan yeni bot başlatabilirsiniz.",
                "confirm_kill": "ACİL DURDURMAYI tetiklemek istediğinizden emin misiniz? Tüm botlar durdurulacak.",

                // Settings & API
                "api_saved_success": "API anahtarları şifrelenerek başarıyla kaydedildi.",
                "api_testing": "Binance ile API bağlantısı test ediliyor...",
                "api_test_success": "Binance API bağlantısı doğrulandı!",
                "api_test_failed": "API bağlantısı başarısız. Lütfen bilgilerinizi kontrol edin.",
                "select_symbol_timeframe": "Lütfen bir sembol ve zaman dilimi seçin!",

                // Data Lab
                "data_download_started": "Geçmiş veri indirme işlemi başlatıldı.",
                "data_download_stopped": "Veri indirme işlemi durduruldu.",
                "all_data_deleted": "Geçmiş veriler silindi.",

                // Strategy Builder
                "strategy_saved_success": "Strateji başarıyla kaydedildi.",
                "testing": "Test ediliyor...",

                // Trade History
                "no_trade_history": "Henüz işlem geçmişi yok veya yükleniyor...",

                // ML Decision Engine
                "ml_training_started": "Makine öğrenimi modeli eğitim süreci başlatıldı...",
                "ml_training_success": "ML modeli başarıyla eğitildi!",
                "ml_training_failed": "ML eğitimi başarısız",
                "ml_data_preparing": "Veri hazırlanıyor...",
                "ml_training_history_cleared": "Eğitim geçmişi başarıyla temizlendi.",
                "ml_model_deleted": "Model başarıyla silindi.",
                "ml_select_strategy_symbol": "Lütfen hem strateji hem de sembol seçin!",
                "ml_select_symbol_timeframe": "Lütfen sembol ve zaman dilimi seçin!",
                "ml_candle_min_100": "Mum sayısı en az 100 olmalı!",
                "ml_tp_range": "TP çarpanı 0.5 - 10 arasında olmalı!",
                "ml_sl_range": "SL çarpanı 0.5 - 10 arasında olmalı!",
                "ml_visual_analysis_started": "Görsel Karar Simülasyonu başlatılıyor...",
                "ml_visual_analysis_success": "Görsel Karar Simülasyonu tamamlandı!",
                "ml_visual_analysis_failed": "Simülasyon başarısız",
                "ml_no_trained_models": "Henüz eğitilmiş model yok.",
                "ml_no_data_for_pair": "Bu sembol/timeframe için veri bulunamadı!",
                "ml_db_candles_available": "Mevcut: {dbCount} mum - {limit} mum kullanılacak",
                "ml_db_candles_shortage": "Veritabanında sadece {dbCount} mum var! Önce veri indirin.",
                "ml_feature_importance_title": "Model Ağırlık Analizi (Feature Importance)",
                "ml_feature_importance_xaxis": "Önem Yüzdesi (%)",
                "ml_model_ready_for_hub": "Model artık Strateji Karar Merkezi'nde kullanıma hazır.",
                "ml_load_error": "Yükleme Hatası",
                "ml_samples": "örnek",
                "ml_training_error_title": "Eğitim Hatası!"
            }
        };
    }

    t(key) {
        const langData = this.messages[this.currentLang] || this.messages.en;
        return langData[key] || this.messages.en[key] || key;
    }

    setLanguage(lang) {
        if (lang !== 'en' && lang !== 'tr') return;
        this.currentLang = lang;
        localStorage.setItem('app_lang', lang);
        document.documentElement.lang = lang;
        this.applyLanguageToDOM();
        this.updateSwitcherUI();
        this.updateDynamicDropdowns();

        // Dispatch language change event for dynamic components
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));

        console.log(`🌐 [i18n] Language switched to: ${lang.toUpperCase()}`);
    }

    applyLanguageToDOM() {
        // 1. Process elements with explicit [data-en] and [data-tr]
        document.querySelectorAll('[data-en][data-tr]').forEach(el => {
            const val = this.currentLang === 'tr' ? el.getAttribute('data-tr') : el.getAttribute('data-en');
            if (val) {
                const icon = el.querySelector('i, svg');
                if (icon) {
                    el.innerHTML = '';
                    el.appendChild(icon);
                    el.appendChild(document.createTextNode(' ' + val));
                } else {
                    el.textContent = val;
                }
            }
        });

        // 2. Process placeholder translations
        document.querySelectorAll('[data-en-ph][data-tr-ph]').forEach(el => {
            const val = this.currentLang === 'tr' ? el.getAttribute('data-tr-ph') : el.getAttribute('data-en-ph');
            if (val) {
                el.setAttribute('placeholder', val);
            }
        });

        // 3. Process [data-i18n] keys if defined in dictionary
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = this.t(key);
            if (translation && translation !== key) {
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
    }

    updateDynamicDropdowns() {
        const symbolText = this.currentLang === 'tr' ? 'Sembol Seçin...' : 'Select Symbol...';
        const stratText = this.currentLang === 'tr' ? 'Strateji Seçin...' : 'Select Strategy...';
        const tfText = this.currentLang === 'tr' ? 'Timeframe Seçin...' : 'Select Timeframe...';

        document.querySelectorAll('select.symbol-select, #bot-symbol, #ml-train-symbol, #ml-analysis-symbol, #data-symbol-select').forEach(sel => {
            if (sel && sel.options && sel.options.length > 0 && sel.options[0].value === "") {
                sel.options[0].textContent = symbolText;
            }
        });

        document.querySelectorAll('select.strategy-select, #bot-strategy, #ml-analysis-strategy').forEach(sel => {
            if (sel && sel.options && sel.options.length > 0 && sel.options[0].value === "") {
                sel.options[0].textContent = stratText;
            }
        });

        document.querySelectorAll('select.timeframe-select, #bot-timeframe, #ml-train-timeframe, #ml-analysis-timeframe').forEach(sel => {
            if (sel && sel.options && sel.options.length > 0 && sel.options[0].value === "") {
                sel.options[0].textContent = tfText;
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
        this.applyLanguageToDOM();
        this.updateSwitcherUI();
        this.updateDynamicDropdowns();

        const btnEn = document.getElementById('lang-btn-en');
        const btnTr = document.getElementById('lang-btn-tr');

        if (btnEn) {
            btnEn.onclick = (e) => {
                if (e) e.preventDefault();
                this.setLanguage('en');
            };
        }
        if (btnTr) {
            btnTr.onclick = (e) => {
                if (e) e.preventDefault();
                this.setLanguage('tr');
            };
        }
    }
}

export const i18n = new I18nManager();
export default i18n;

if (typeof window !== 'undefined') {
    window.i18n = i18n;
    window.setLang = (lang) => i18n.setLanguage(lang);
}
