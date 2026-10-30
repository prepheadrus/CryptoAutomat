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
                "bot_started_success": "Bot launched successfully!",
                "bot_stopped_success": "Bot has been stopped.",
                "bot_resumed_success": "Bot resumed execution.",
                "bot_removed_success": "Bot removed.",
                "api_saved_success": "API credentials encrypted and saved successfully.",
                "api_testing": "Testing API connection with Binance...",
                "api_test_success": "Binance API connection verified!",
                "api_test_failed": "API connection failed. Please verify credentials.",
                "select_symbol_timeframe": "Please select a symbol and timeframe!",
                "data_download_started": "Historical data ingestion started.",
                "data_download_stopped": "Data ingestion stopped.",
                "all_data_deleted": "Historical data deleted.",
                "strategy_saved_success": "Strategy saved successfully.",
                "model_training_started": "ML model training pipeline initiated...",
                "model_trained_success": "Model training complete!",
                "analyzing": "Analyzing...",
                "testing": "Running backtest...",
                "confirm_kill": "Are you sure you want to trigger EMERGENCY STOP? All bots will be halted."
            },
            tr: {
                "bot_started_success": "Bot başarıyla başlatıldı!",
                "bot_stopped_success": "Bot durduruldu.",
                "bot_resumed_success": "Bot yeniden başlatıldı.",
                "bot_removed_success": "Bot kaldırıldı.",
                "api_saved_success": "API anahtarları şifrelenerek başarıyla kaydedildi.",
                "api_testing": "Binance ile API bağlantısı test ediliyor...",
                "api_test_success": "Binance API bağlantısı doğrulandı!",
                "api_test_failed": "API bağlantısı başarısız. Lütfen bilgilerinizi kontrol edin.",
                "select_symbol_timeframe": "Lütfen bir sembol ve zaman dilimi seçin!",
                "data_download_started": "Geçmiş veri indirme işlemi başlatıldı.",
                "data_download_stopped": "Veri indirme işlemi durduruldu.",
                "all_data_deleted": "Geçmiş veriler silindi.",
                "strategy_saved_success": "Strateji başarıyla kaydedildi.",
                "model_training_started": "Makine öğrenimi modeli eğitim süreci başlatıldı...",
                "model_trained_success": "Model eğitimi tamamlandı!",
                "analyzing": "Analiz ediliyor...",
                "testing": "Test ediliyor...",
                "confirm_kill": "ACİL DURDURMAYI tetiklemek istediğinizden emin misiniz? Tüm botlar durdurulacak."
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
        console.log(`🌐 [i18n] Language switched to: ${lang.toUpperCase()}`);
    }

    applyLanguageToDOM() {
        // 1. Process elements with explicit [data-tr] and [data-en]
        document.querySelectorAll('[data-en][data-tr]').forEach(el => {
            const val = this.currentLang === 'tr' ? el.getAttribute('data-tr') : el.getAttribute('data-en');
            if (val) {
                // If it has children icons, keep icons
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

        const btnEn = document.getElementById('lang-btn-en');
        const btnTr = document.getElementById('lang-btn-tr');

        if (btnEn) {
            btnEn.onclick = (e) => {
                e.preventDefault();
                this.setLanguage('en');
            };
        }
        if (btnTr) {
            btnTr.onclick = (e) => {
                e.preventDefault();
                this.setLanguage('tr');
            };
        }
    }
}

export const i18n = new I18nManager();
export default i18n;

if (typeof window !== 'undefined') {
    window.i18n = i18n;
}
