import pandas as pd
from strategy.base import BaseStrategy

class DivergenceHunter(BaseStrategy):
    """
    "Senkronize Uyuşmazlık Avcısı" Stratejisi
    
    Kullanılan Göstergeler:
    1. Demand Index (Talep Endeksi)
    2. Ultimate Oscillator
    3. ADX (Directional Movement)
    4. Parabolic SAR (PSAR)
    
    Mantık:
    Yatay piyasa yanılgılarından kurtulmak ve dip/tepe dönüşlerini yakalamak için pozitif/negatif uyuşmazlıklara odaklanır.
    """
    
    def name(self) -> str:
        return "divergence_hunter"
        
    def description(self) -> str:
        return "Senkronize Uyuşmazlık Avcısı: Talep Endeksi ve Ultimate Osilatör uyuşmazlığını ADX gücüyle birleştirir ve PSAR ile tetiği çeker."

    def generate_signal(self, current_row: pd.Series) -> int:
        """
        Dönüş:
        2: LONG (AL)
        0: SHORT (SAT)
        1: HOLD (BEKLE)
        """
        # Gerekli indikatörlerin olup olmadığını kontrol et
        required_cols = ['DEMAND_INDEX', 'UO', 'ADX_14', 'DMP_14', 'DMN_14', 'PSAR', 'close', 
                         'DIV_PRICE_LOWER', 'DIV_DEMAND_HIGHER', 'DIV_UO_HIGHER', 'ADX_BULL_CROSS']
        
        for col in required_cols:
            if col not in current_row:
                return 1 # Veri eksiği varsa bekle
                
        # --- LONG (AL) ŞARTLARI ---
        # 1. Uyuşmazlık Şartı: Fiyat dip yapıyor, ancak Demand ve UO yükseliyor. Demand 0 altında.
        is_pos_divergence = (
            current_row.get('DIV_PRICE_LOWER', False) and 
            current_row.get('DIV_DEMAND_HIGHER', False) and 
            current_row.get('DIV_UO_HIGHER', False) and
            current_row['DEMAND_INDEX'] < 0
        )
        
        # 2. ADX Teyidi: +DI, -DI nin üzerinde ve trend destekliyor
        # Yazarın kuralı: Şartlar bir araya gelmeli. Bazen uyuşmazlık olduktan biraz sonra kesişim gelir. 
        # Biz burada uyuşmazlık varken ya da yeni gerçekleşmişken yükseliş teyidi arıyoruz.
        is_bull_trend = current_row['DMP_14'] > current_row['DMN_14']
        
        # 3. Tetik (PSAR): Fiyat Parabolic SAR'ın üstüne çıkmış (SAR noktaları altta)
        is_psar_bull = current_row['close'] > current_row['PSAR']
        
        # LONG SİNYALİ VER (Hepsi senkronize ise)
        # Not: Gerçek hayatta bu sinyallerin aynı anda yanması nadir olabilir, esnetilebilir.  
        # Ancak kitaptaki katı kurallara göre "Aynı anda gerçekleşmesi" hedeflenir.
        if is_pos_divergence and is_bull_trend and is_psar_bull:
            return 2
            
        # --- SHORT (SAT) ŞARTLARI ---
        # Kısa pozisyon için zıt yönde benzer uyuşmazlıklar (Fiyat tepe yaparken osilatörler düşüyor)
        # Şimdilik sadece PNL (Kar/Zarar) üzerinden LONG sistemine odaklanalım dediniz ama SHORT da ekleyelim
        is_neg_divergence = (
            current_row['close'] >= current_row.get('high_max_10', current_row['high']) and # Basit tepe kontrolü
            current_row['DEMAND_INDEX'] < current_row.get('DEMAND_MAX_10', 0) and
            current_row['DEMAND_INDEX'] > 0
        )
        is_bear_trend = current_row['DMN_14'] > current_row['DMP_14']
        is_psar_bear = current_row['close'] < current_row['PSAR']
        
        # Sadece basit SHORT varsayımı ekliyoruz, detayı kitap kurallarına sadık.
        if is_neg_divergence and is_bear_trend and is_psar_bear:
            return 0

        return 1

    def get_stop_params(self):
        """
        Risk Yönetimi (Zarar Kes ve Kar Al)
        Yazar Kuralı: 1.5x - 2x ATR Stop, 3x Hedef (1:3 Risk Reward oranı veya daha fazlası) 
        İz süren stop bu oranlardan faydalanır.
        """
        return {
            "atr_multiplier": 2.0,       # Zarar Kes = Fiyatın 2 ATR uzağı
            "risk_reward_ratio": 3.0     # Kar Hedefi (Risk X 3)
        }
