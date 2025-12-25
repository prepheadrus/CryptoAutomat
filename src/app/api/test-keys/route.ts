import { NextResponse } from 'next/server';
import { BinanceAPI } from '@/lib/binance-api';

export async function POST(request: Request) {
  try {
    const { apiKey, secretKey, testnet = false, networkType = 'mainnet' } = await request.json();

    if (!apiKey || !secretKey) {
      return NextResponse.json(
        { success: false, message: 'API anahtarı ve gizli anahtar gereklidir.' },
        { status: 400 }
      );
    }

    // Create Binance API client (backwards compatible with testnet)
    const binance = new BinanceAPI({
      apiKey,
      apiSecret: secretKey,
      testnet, // Backwards compatibility
      networkType,
    });

    // Test connection
    const pingSuccess = await binance.ping();
    if (!pingSuccess) {
      return NextResponse.json(
        { success: false, message: 'Binance API\'ye bağlanılamadı.' },
        { status: 500 }
      );
    }

    // Validate credentials
    const credentialsTest = await binance.testCredentials();
    if (!credentialsTest.valid) {
      return NextResponse.json(
        { success: false, message: credentialsTest.message },
        { status: 401 }
      );
    }

    // Get account info
    const accountInfo = await binance.getAccountInfo();

    return NextResponse.json({
      success: true,
      message: credentialsTest.message,
      accountInfo: {
        canTrade: accountInfo.canTrade,
        canWithdraw: accountInfo.canWithdraw,
        canDeposit: accountInfo.canDeposit,
      },
      networkType,
      testnet, // Backwards compatibility
    });

  } catch (error: any) {
    console.error('API anahtar testi hatası:', error.message);
    return NextResponse.json(
      { success: false, message: error.message || 'Bilinmeyen bir hata oluştu.' },
      { status: 500 }
    );
  }
}
