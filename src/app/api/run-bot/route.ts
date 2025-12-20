import { NextResponse } from 'next/server';
import { runStrategy } from '@/lib/bot-engine';
import { compileStrategy } from '@/lib/compiler';
import type { Node, Edge } from '@xyflow/react';

export async function POST(request: Request) {
  try {
    const { nodes, edges } = (await request.json()) as { nodes: Node[]; edges: Edge[] };

    // 1. Stratejiyi derle ve doğrula
    const compileResult = compileStrategy(nodes, edges);
    if (!compileResult.valid || !compileResult.strategy) {
      return NextResponse.json(
        { success: false, message: compileResult.message },
        { status: 400 }
      );
    }
    
    // 2. Derlenmiş stratejiyi bot motorunda çalıştır
    const engineResult = await runStrategy(compileResult.strategy, 'BTC/USDT');

    // 3. Sonucu ön yüze döndür
    // Ön yüzün beklediği "message" alanını oluşturuyoruz.
    return NextResponse.json({ 
        success: true, 
        message: engineResult.message 
    });

  } catch (error) {
    console.error("API rotasında hata:", error);
    return NextResponse.json(
      { success: false, message: (error as Error).message || 'Bilinmeyen bir sunucu hatası oluştu.' },
      { status: 500 }
    );
  }
}
