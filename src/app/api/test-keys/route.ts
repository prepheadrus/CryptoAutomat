import { NextResponse } from 'next/server';
import { validateApiKeys } from '@/lib/exchange';

export async function POST(request: Request) {
  try {
    const { apiKey, secretKey } = await request.json();
    const exchange = 'binance'; // Hardcoded for now

    if (!apiKey || !secretKey) {
      return NextResponse.json(
        { success: false, message: 'API anahtarı ve gizli anahtar gereklidir.' },
        { status: 400 }
      );
    }
    
    await validateApiKeys(exchange, apiKey, secretKey);

    return NextResponse.json({
      success: true,
      message: 'API anahtarları geçerli ve bağlantı başarılı!',
    });

  } catch (error: any) {
    console.error('API anahtar testi hatası:', error.message);
    return NextResponse.json(
      { success: false, message: error.message || 'Bilinmeyen bir hata oluştu.' },
      { status: 500 }
    );
  }
}
