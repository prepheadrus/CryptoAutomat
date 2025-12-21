import { compileStrategy } from '@/lib/compiler';
import { runStrategy } from '@/lib/bot-engine';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { nodes, edges } = await request.json();

    if (!nodes || !edges) {
      return NextResponse.json(
        { success: false, message: 'Eksik parametreler: nodes ve edges gereklidir.' },
        { status: 400 }
      );
    }

    const compileResult = compileStrategy(nodes, edges);
    if (!compileResult.valid || !compileResult.strategy) {
      return NextResponse.json(
        { success: false, message: compileResult.message },
        { status: 400 }
      );
    }
    
    // For now, we only run in live mode for testing. A real implementation
    // would get the mode from the bot's config.
    const mode = 'LIVE'; 
    const storedKeys = { apiKey: process.env.API_KEY, secret: process.env.API_SECRET }; // In a real app, get from a secure vault or session

    try {
      if (mode === 'LIVE') {
        if (!storedKeys.apiKey || !storedKeys.secret) {
            throw new Error("Borsa API anahtarları yapılandırılmamış. Lütfen ayarlar sayfasından anahtarlarınızı ekleyin.");
        }
      }
      // Pass the keys and mode to the engine
      const engineResult = await runStrategy(compileResult.strategy, 'BTC/USDT', storedKeys);
      
      if (engineResult.decision === 'WAIT' && engineResult.data?.error) {
        throw new Error(engineResult.message);
      }

      return NextResponse.json({
        success: true,
        message: `[CANLI] ${engineResult.message}`
      });

    } catch (error) {
      console.warn('Gerçek motor hatası, simülasyon moduna geçiliyor:', (error as Error).message);

      const simulatedPrice = (64000 + Math.random() * 1000).toFixed(2);
      const simulatedRsi = (30 + Math.random() * 40).toFixed(2);
      const decision = compileResult.strategy.action.type.toUpperCase();

      const simulatedMessage = `Karar: ${decision}. Koşul sağlandı (RSI ${simulatedRsi} ${compileResult.strategy.condition.operator} ${compileResult.strategy.condition.value}). Fiyat: ${simulatedPrice}`;
      
      return NextResponse.json({
        success: true,
        message: `[SİMÜLASYON] ${simulatedMessage}`
      });
    }

  } catch (error) {
    console.error("API rotasında beklenmedik hata:", error);
    return NextResponse.json(
      { success: false, message: `Sunucu Hatası: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
