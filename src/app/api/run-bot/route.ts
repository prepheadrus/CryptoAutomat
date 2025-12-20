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

    // 1. Stratejiyi derle
    const compileResult = compileStrategy(nodes, edges);
    if (!compileResult.valid || !compileResult.strategy) {
      return NextResponse.json(
        { success: false, message: compileResult.message },
        { status: 400 }
      );
    }

    // 2. Bot motorunu çalıştır
    const engineResult = await runStrategy(compileResult.strategy);

    return NextResponse.json({
      success: true,
      message: engineResult.message
    });

  } catch (error) {
    console.error("API rotasında beklenmedik hata:", error);
    return NextResponse.json(
      { success: false, message: `Sunucu Hatası: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}