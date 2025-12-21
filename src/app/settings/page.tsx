'use client';

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Bell, User, Trash2, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
    const [apiKey, setApiKey] = useState('');
    const [secretKey, setSecretKey] = useState('');
    const [isTesting, setIsTesting] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        try {
            const storedKeys = localStorage.getItem('exchangeKeys');
            if (storedKeys) {
                const { apiKey: storedApiKey, secretKey: storedSecretKey } = JSON.parse(storedKeys);
                if (storedApiKey) setApiKey(storedApiKey);
                if (storedSecretKey) setSecretKey(storedSecretKey);
            }
        } catch (error) {
            console.error("API anahtarları localStorage'dan okunurken hata:", error);
        }
    }, []);

    const handleTestAndSave = () => {
        if (!apiKey || !secretKey) {
            toast({
                variant: "destructive",
                title: "Eksik Bilgi",
                description: "Lütfen hem API anahtarını hem de gizli anahtarı girin.",
            });
            return;
        }

        setIsTesting(true);
        toast({
            title: "Bağlantı Test Ediliyor...",
            description: "Lütfen bekleyin.",
        });

        setTimeout(() => {
            // Simulate a random success or failure
            const isSuccess = Math.random() > 0.2; // 80% success rate

            if (isSuccess) {
                try {
                    localStorage.setItem('exchangeKeys', JSON.stringify({ apiKey, secretKey }));
                    toast({
                        title: "Bağlantı Başarılı! 🚀",
                        description: "API anahtarlarınız güvenli bir şekilde kaydedildi.",
                    });
                } catch (error) {
                     toast({
                        variant: "destructive",
                        title: "Kayıt Hatası",
                        description: "API anahtarları kaydedilemedi.",
                    });
                }
            } else {
                toast({
                    variant: "destructive",
                    title: "Bağlantı Başarısız",
                    description: "Girdiğiniz anahtarlar geçersiz. Lütfen kontrol edin.",
                });
            }
            setIsTesting(false);
        }, 1500);
    };

    const handleRemoveKeys = () => {
         if (window.confirm("Mevcut API anahtarlarını kaldırmak istediğinizden emin misiniz?")) {
            setApiKey('');
            setSecretKey('');
            try {
                localStorage.removeItem('exchangeKeys');
                toast({
                    title: "Anahtarlar Kaldırıldı",
                    description: "Kaydedilmiş Binance API anahtarlarınız silindi.",
                });
            } catch (error) {
                 toast({
                    variant: "destructive",
                    title: "Silme Hatası",
                    description: "Anahtarlar kaldırılamadı.",
                });
            }
        }
    };
    
    const handleAccountDelete = () => {
        if (window.confirm("Hesabınızı ve tüm verilerinizi kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz!")) {
            window.alert("Hesap silme işlemi başlatıldı. (Bu bir simülasyondur)");
            // In a real app, this would trigger a server-side deletion process.
        }
    }


    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-headline font-bold">Ayarlar</h1>
            
            <Tabs defaultValue="exchanges" className="w-full">
                <TabsList className="grid w-full grid-cols-3 max-w-2xl">
                    <TabsTrigger value="exchanges">
                        <KeyRound className="mr-2 h-4 w-4"/> Borsa Anahtarları
                    </TabsTrigger>
                    <TabsTrigger value="notifications">
                        <Bell className="mr-2 h-4 w-4"/> Bildirimler
                    </TabsTrigger>
                    <TabsTrigger value="account">
                        <User className="mr-2 h-4 w-4"/> Hesap
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="exchanges">
                    <Card>
                        <CardHeader>
                            <CardTitle className="font-headline">Borsa API Anahtarları</CardTitle>
                            <CardDescription>
                                Borsa hesaplarınızı bağlayın. Anahtarlarınız tarayıcınızda güvenli olarak saklanır.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4 p-4 border rounded-lg">
                                <h3 className="font-semibold">Binance</h3>
                                <div className="space-y-2">
                                    <Label htmlFor="binance-api-key">API Anahtarı</Label>
                                    <Input 
                                        id="binance-api-key" 
                                        placeholder="Binance API Anahtarınız" 
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="binance-secret-key">Gizli Anahtar</Label>
                                    <Input 
                                        id="binance-secret-key" 
                                        type="password" 
                                        placeholder="Binance Gizli Anahtarınız" 
                                        value={secretKey}
                                        onChange={(e) => setSecretKey(e.target.value)}
                                    />
                                </div>
                                <div className="flex justify-end space-x-2">
                                    <Button variant="ghost" size="sm" onClick={handleRemoveKeys} disabled={!apiKey && !secretKey}>
                                        <Trash2 className="mr-2 h-4 w-4" /> Kaldır
                                    </Button>
                                    <Button size="sm" onClick={handleTestAndSave} disabled={isTesting}>
                                        {isTesting ? (
                                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Test Ediliyor...</>
                                        ) : (
                                            "Kaydet ve Test Et"
                                        )}
                                    </Button>
                                </div>
                            </div>
                             <div className="space-y-4 p-4 border rounded-lg border-dashed flex flex-col items-center justify-center text-center">
                                <h3 className="font-semibold mb-2">Diğer Borsalar</h3>
                                 <p className="text-sm text-muted-foreground mb-4">Çoklu borsa desteği yakında geliyor!</p>
                                <Select disabled>
                                    <SelectTrigger className="w-[280px]">
                                        <SelectValue placeholder="Borsa Seçin (Yakında)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="kraken">Kraken</SelectItem>
                                        <SelectItem value="coinbase">Coinbase Pro</SelectItem>
                                        <SelectItem value="kucoin">KuCoin</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="notifications">
                    <Card>
                        <CardHeader>
                            <CardTitle className="font-headline">Bildirim Ayarları</CardTitle>
                            <CardDescription>İşlemler ve bot durumu hakkında nasıl bildirim almak istediğinizi seçin.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div>
                                    <Label htmlFor="email-notifs" className="font-medium">E-posta Bildirimleri</Label>
                                    <p className="text-sm text-muted-foreground">İşlem özetlerini ve uyarıları e-posta ile alın.</p>
                                </div>
                                <Switch id="email-notifs" defaultChecked />
                            </div>
                             <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div>
                                    <Label htmlFor="push-notifs" className="font-medium">Anlık Bildirimler</Label>
                                    <p className="text-sm text-muted-foreground">Mobil cihazınızda gerçek zamanlı uyarılar alın (yakında).</p>
                                </div>
                                <Switch id="push-notifs" disabled />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="account">
                     <Card>
                        <CardHeader>
                            <CardTitle className="font-headline">Hesap Bilgileri</CardTitle>
                            <CardDescription>Hesap detaylarınızı ve aboneliğinizi yönetin.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                             <div className="space-y-2">
                                <Label htmlFor="email">E-posta Adresi</Label>
                                <Input id="email" defaultValue="user@autopilot.dev" disabled />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="plan">Abonelik Planı</Label>
                                <Input id="plan" defaultValue="Pro Plan" disabled />
                                <p className="text-sm text-muted-foreground">Planınız 29 Ağustos 2024 tarihinde yenilenecektir.</p>
                            </div>
                            <Button>Aboneliği Yönet</Button>
                        </CardContent>
                        <Separator className="my-6" />
                         <CardHeader>
                            <CardTitle className="font-headline text-destructive">Tehlikeli Bölge</CardTitle>
                        </CardHeader>
                         <CardContent>
                            <div className="flex items-center justify-between p-4 border border-destructive/50 rounded-lg bg-destructive/10">
                                <div>
                                    <p className="font-medium">Hesabı Sil</p>
                                    <p className="text-sm text-muted-foreground">Hesabınızı ve ilgili tüm verileri kalıcı olarak silin.</p>
                                </div>
                                <Button variant="destructive" onClick={handleAccountDelete}>Hesabımı Sil</Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
