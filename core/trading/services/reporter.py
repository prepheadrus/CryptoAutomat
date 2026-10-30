from typing import List, Dict, Any


class StrategyReporterService:
    """
    Kapanan işlemleri baz alarak stratejilerin performans karnesini (röntgenini) çıkarır.
    PaperTrader içerisindeki çok uzun get_strategy_report fonksiyonunu hafifletmek için oluşturuldu.
    """

    @staticmethod
    def _safe_get(obj: Any, key: str, default: Any = None) -> Any:
        if hasattr(obj, key):
            return getattr(obj, key)
        elif isinstance(obj, dict):
            return obj.get(key, default)
        return default

    @staticmethod
    def _calculate_profit_factor(gross_profit: float, gross_loss: float) -> float:
        if gross_loss == 0:
            return float('inf') if gross_profit > 0 else 0.0
        return gross_profit / gross_loss

    @staticmethod
    def _generate_recommendation(win_rate: float, profit_factor: float, total_trades: int, total_pnl: float, max_drawdown_pct: float, max_drawdown: float) -> Dict[str, str]:
        if profit_factor >= 2.0 and win_rate < 50 and total_trades >= 5:
            rec_tr = (
                f"🎯 DÜŞÜK WIN RATE ({win_rate:.0f}%) AMA YÜKSEK KÂRLILIK! "
                f"Profit Factor: {profit_factor:.2f}. "
                f"Risk/Ödül dengesi muazzam - kayıplar küçük, kazançlar büyük. "
                f"Strateji 'trend following' tarzı çalışıyor olabilir."
            )
            rec_en = (
                f"🎯 LOW WIN RATE ({win_rate:.0f}%) BUT HIGH PROFITABILITY! "
                f"Profit Factor: {profit_factor:.2f}. "
                f"Outstanding Risk/Reward balance - minimal losses, outsized gains. "
                f"Strategy operates effectively as a trend-following system."
            )
        elif win_rate < 40 and profit_factor < 1.2 and total_trades >= 3:
            rec_tr = (
                f"⚠️ KRİTİK: Düşük başarı oranı ({win_rate:.0f}%) ve zayıf kâr faktörü ({profit_factor:.2f}). "
                f"Stop-Loss seviyesi hatalı veya işlem yapılan pariteler bu botun tarzına uymuyor. "
                f"Acil parametre optimizasyonu gerekli!"
            )
            rec_en = (
                f"⚠️ CRITICAL: Low win rate ({win_rate:.0f}%) and weak profit factor ({profit_factor:.2f}). "
                f"Stop-Loss level may be inadequate or traded pairs do not fit this strategy profile. "
                f"Immediate parameter optimization recommended!"
            )
        elif win_rate >= 60 and profit_factor >= 1.5 and total_pnl > 0:
            rec_tr = (
                f"🏆 MÜKEMMEL UYUM! Win Rate: %{win_rate:.0f}, Profit Factor: {profit_factor:.2f}. "
                f"Kârlılık ve kazanma oranı muazzam. "
                f"Kaldıraç oranı ufak çaplı artırılarak gelir katlanabilir."
            )
            rec_en = (
                f"🏆 EXCELLENT PERFORMANCE! Win Rate: {win_rate:.0f}%, Profit Factor: {profit_factor:.2f}. "
                f"Outstanding profitability and consistency. "
                f"Moderate leverage scaling may be considered to maximize returns."
            )
        elif win_rate >= 50 and total_pnl < 0:
            rec_tr = (
                f"⚠️ DİKKAT: Kazanma oranı iyi (%{win_rate:.0f}) fakat alınan risk (Stop Loss) kârı eritiyor. "
                f"Profit Factor: {profit_factor:.2f}. "
                f"Risk/Ödül oranı iyileştirilmeli (min 1:2) veya spread/fee kontrol edilmeli."
            )
            rec_en = (
                f"⚠️ CAUTION: Solid win rate ({win_rate:.0f}%) but downside risk (Stop Loss) erodes net profit. "
                f"Profit Factor: {profit_factor:.2f}. "
                f"Improve Risk/Reward ratio (min 1:2) or inspect slippage and exchange fees."
            )
        elif max_drawdown_pct > 30 and total_trades >= 5:
            rec_tr = (
                f"📉 YÜKSEK DRAWDOWN UYARISI: Maksimum düşüş %{max_drawdown:.1f}. "
                f"Strateji büyük değer kaybı yaşamış. "
                f"Pozisyon boyutu küçültülmeli veya kaldıraç düşürülmeli."
            )
            rec_en = (
                f"📉 HIGH DRAWDOWN WARNING: Peak drawdown reached {max_drawdown:.1f}%. "
                f"Strategy experienced heavy equity swings. "
                f"Reduce position sizing or lower leverage."
            )
        elif total_trades < 3:
            rec_tr = (
                f"ℹ️ İŞLEM HACMİ YETERSİZ: Sadece {total_trades} işlem. "
                f"Simülasyon devam etmeli, en az 30 işlem sonrası değerlendirme yapılmalı."
            )
            rec_en = (
                f"ℹ️ INSUFFICIENT SAMPLE SIZE: Only {total_trades} executed trades. "
                f"Continue trading simulation; evaluate robustly after at least 30 closed trades."
            )
        else:
            rec_tr = (
                f"📊 ORTALAMA PERFORMANS: Win Rate %{win_rate:.0f}, Profit Factor {profit_factor:.2f}. "
                f"Risk toleransına göre makul sayılabilir."
            )
            rec_en = (
                f"📊 MODERATE PERFORMANCE: Win Rate {win_rate:.0f}%, Profit Factor {profit_factor:.2f}. "
                f"Acceptable balance based on conservative risk tolerance."
            )
        return {"tr": rec_tr, "en": rec_en}

    def generate_report(self, trades_list: List[Any]) -> List[Dict[str, Any]]:
        report = []
        groups = {}

        if not trades_list or (hasattr(trades_list, '__len__') and len(trades_list) == 0):
            return []

        for trade in trades_list:
            strat = self._safe_get(trade, 'strategy_id') or self._safe_get(trade, 'strategy', 'Unknown')
            pnl = self._safe_get(trade, 'pnl') or self._safe_get(trade, 'pnl_usd', 0)
            symbol = self._safe_get(trade, 'symbol', 'Unknown')
            timeframe = self._safe_get(trade, 'timeframe', '1m')

            strat_key = f"{strat}"

            if strat_key not in groups:
                groups[strat_key] = {
                    "strategy": strat,
                    "timeframe": timeframe,
                    "total_trades": 0,
                    "wins": 0,
                    "losses": 0,
                    "total_pnl": 0.0,
                    "gross_profit": 0.0,
                    "gross_loss": 0.0,
                    "pnl_curve": [],
                    "symbols": {}
                }

            if not groups[strat_key].get("timeframe") and timeframe:
                groups[strat_key]["timeframe"] = timeframe

            groups[strat]["total_trades"] += 1

            if pnl > 0:
                groups[strat]["wins"] += 1
                groups[strat]["gross_profit"] += pnl
            elif pnl < 0:
                groups[strat]["losses"] += 1
                groups[strat]["gross_loss"] += abs(pnl)

            groups[strat]["total_pnl"] += pnl
            groups[strat]["pnl_curve"].append(pnl)

            sym_key = f"{symbol} ({timeframe})"

            if sym_key not in groups[strat]["symbols"]:
                groups[strat]["symbols"][sym_key] = {
                    "trades": 0,
                    "wins": 0,
                    "pnl": 0.0
                }

            groups[strat]["symbols"][sym_key]["trades"] += 1
            if pnl > 0:
                groups[strat]["symbols"][sym_key]["wins"] += 1
            groups[strat]["symbols"][sym_key]["pnl"] += pnl

        for strat, data in groups.items():
            win_rate = (data["wins"] / data["total_trades"] * 100) if data["total_trades"] > 0 else 0
            profit_factor = self._calculate_profit_factor(data["gross_profit"], data["gross_loss"])

            max_drawdown = 0.0
            cumulative_pnl = 0.0
            peak_pnl = 0.0

            for pnl in data["pnl_curve"]:
                cumulative_pnl += pnl
                if cumulative_pnl > peak_pnl:
                    peak_pnl = cumulative_pnl
                drawdown = peak_pnl - cumulative_pnl
                if drawdown > max_drawdown:
                    max_drawdown = drawdown

            if peak_pnl > 0:
                max_drawdown_pct = (max_drawdown / peak_pnl * 100)
            elif max_drawdown > 0:
                max_drawdown_pct = (max_drawdown / abs(cumulative_pnl) * 100) if cumulative_pnl != 0 else 0
            else:
                max_drawdown_pct = 0

            sym_perf = []
            detected_timeframe = data.get("timeframe", "1m")

            for s_name, s_data in data["symbols"].items():
                s_wr = (s_data["wins"] / s_data["trades"] * 100) if s_data["trades"] > 0 else 0
                if " (" in s_name and s_name.endswith(")"):
                    tf = s_name.split(" (")[-1].rstrip(")")
                    if tf:
                        detected_timeframe = tf

                sym_perf.append({
                    "name": s_name,
                    "trades": s_data["trades"],
                    "win_rate": round(s_wr, 1),
                    "pnl": round(s_data["pnl"], 2)
                })

            recommendation_dict = self._generate_recommendation(
                win_rate, profit_factor, data["total_trades"], data["total_pnl"], max_drawdown_pct, max_drawdown
            )

            report.append({
                "strategy": strat,
                "timeframe": detected_timeframe,
                "total_trades": data["total_trades"],
                "wins": data["wins"],
                "losses": data["losses"],
                "win_rate": round(win_rate, 1),
                "total_pnl": round(data["total_pnl"], 2),
                "gross_profit": round(data["gross_profit"], 2),
                "gross_loss": round(data["gross_loss"], 2),
                "profit_factor": round(profit_factor, 2) if profit_factor != float('inf') else None,
                "max_drawdown": round(max_drawdown, 2),
                "max_drawdown_pct": round(max_drawdown_pct, 1),
                "symbols": sym_perf,
                "recommendation": recommendation_dict["en"],
                "recommendation_en": recommendation_dict["en"],
                "recommendation_tr": recommendation_dict["tr"]
            })

        return sorted(report, key=lambda x: x['total_pnl'], reverse=True)


strategy_reporter_service = StrategyReporterService()
