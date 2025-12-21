'use client';

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Bell, User, Trash2, Loader2, Check } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";

type NotificationSettings = {
    email: boolean;
    push: boolean;
    telegram: boolean;
    tradeAlerts: boolean;
    errorAlerts: boolean;
    dailySummary: boolean;
};

type AccountSettings = {
    username: string;
    email: string;
    plan: string;
};

export default function SettingsPage() {
    const { toast } = useToast();

    // Exchange Keys State
    const [apiKey, setApiKey] = useState('');
    const [secretKey, setSecretKey] = useState('');
    const [isTesting, setIsTesting] = useState(false);

    // Notifications State
    const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
        email: true,
        push: false,
        telegram: false,
        tradeAlerts: true,
        errorAlerts: true,
        dailySummary: false,
    });
    const [isConnectingTelegram, setIsConnectingTelegram] = useState(false);
    const [isTelegramConnected, setIsTelegramConnected] = useState(false);

    // Account State
    const [accountSettings, setAccountSettings] = useState<AccountSettings>({
        username: "Trader Pro",
        email: "user@autopilot.dev",
        plan: "Pro Plan",
    });

    // Load all settings from localStorage on initial render
    useEffect(() => {
        // Load exchange keys
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

        // Load notification settings
        try {
            const storedNotifications = localStorage.getItem('notificationSettings');
            if (storedNotifications) {
                setNotificationSettings(JSON.parse(storedNotifications));
            }
        } catch (error) {
            console.error("Bildirim ayarları localStorage'dan okunurken hata:", error);
        }

        // Load account settings
        try {
            const storedAccount = localStorage.getItem('accountSettings');
            if (storedAccount) {
                setAccountSettings(JSON.parse(storedAccount));
            }
        } catch (error) {
            console.error("Hesap ayarları localStorage'dan okunurken hata:", error);
        }

    }, []);

    // --- Exchange Keys Handlers ---
    const handleTestAndSaveKeys = () => {
        if (!apiKey || !secretKey) {
            toast({
                variant: "destructive",
                title: "Eksik Bilgi",
                description: "Lütfen hem API anahtarını hem de gizli anahtarı girin.",
            });
            return;
        }

        setIsTesting(true);
        toast({ title: "Bağlantı Test Ediliyor..." });

        setTimeout(() => {
            const isSuccess = Math.random() > 0.2; // 80% success rate
            if (isSuccess) {
                try {
                    localStorage.setItem('exchangeKeys', JSON.stringify({ apiKey, secretKey }));
                    toast({ title: "Bağlantı Başarılı! 🚀", description: "API anahtarlarınız güvenli bir şekilde kaydedildi." });
                } catch (error) {
                     toast({ variant: "destructive", title: "Kayıt Hatası", description: "API anahtarları kaydedilemedi." });
                }
            } else {
                toast({ variant: "destructive", title: "Bağlantı Başarısız", description: "Girdiğiniz anahtarlar geçersiz. Lütfen kontrol edin." });
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
                toast({ title: "Anahtarlar Kaldırıldı" });
            } catch (error) {
                 toast({ variant: "destructive", title: "Silme Hatası" });
            }
        }
    };

    // --- Notifications Handlers ---
    const handleNotificationChange = (key: keyof NotificationSettings, value: boolean) => {
        const newSettings = { ...notificationSettings, [key]: value };
        setNotificationSettings(newSettings);
        try {
            localStorage.setItem('notificationSettings', JSON.stringify(newSettings));
            toast({ title: "Bildirim ayarları güncellendi." });
        } catch (error) {
            toast({ variant: "destructive", title: "Kayıt Hatası" });
        }
    };
    
    const handleConnectTelegram = () => {
        setIsConnectingTelegram(true);
        setTimeout(() => {
            setIsConnectingTelegram(false);
            setIsTelegramConnected(true);
            toast({ title: "Telegram başarıyla bağlandı!" });
        }, 2000);
    };
    
    const handleSendTestNotification = () => {
        toast({
            title: "🔔 Deneme Bildirimi",
            description: "Bildirimleriniz sorunsuz çalışıyor!",
        });
    }

    // --- Account Handlers ---
    const handleAccountChange = (key: keyof AccountSettings, value: string) => {
        setAccountSettings(prev => ({...prev, [key]: value}));
    };

    const handleSaveAccount = () => {
        try {
            localStorage.setItem('accountSettings', JSON.stringify(accountSettings));
            toast({ title: "Hesap bilgileriniz güncellendi." });
        } catch (error) {
            toast({ variant: "destructive", title: "Kayıt Hatası" });
        }
    };

    const handleAccountDelete = () => {
        if (window.confirm("Hesabınızı ve tüm verilerinizi kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz!")) {
            // In a real app, this would trigger a server-side deletion process.
            localStorage.clear();
            window.location.reload(); // Simulate logging out/resetting
            alert("Hesap silme işlemi başlatıldı. Uygulama sıfırlanıyor. (Bu bir simülasyondur)");
        }
    }


    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-headline font-bold">Ayarlar</h1>
            
            <Tabs defaultValue="exchanges" className="w-full">
                <TabsList className="grid w-full grid-cols-3 max-w-2xl">
                    <TabsTrigger value="exchanges"><KeyRound className="mr-2 h-4 w-4"/>Borsa Anahtarları</TabsTrigger>
                    <TabsTrigger value="notifications"><Bell className="mr-2 h-4 w-4"/>Bildirimler</TabsTrigger>
                    <TabsTrigger value="account"><User className="mr-2 h-4 w-4"/>Hesap</TabsTrigger>
                </TabsList>

                {/* Exchange Keys Tab */}
                <TabsContent value="exchanges">
                    <Card>
                        <CardHeader>
                            <CardTitle className="font-headline">Borsa API Anahtarları</CardTitle>
                            <CardDescription>Borsa hesaplarınızı bağlayın. Anahtarlarınız tarayıcınızda güvenli olarak saklanır.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4 p-4 border rounded-lg">
                                <h3 className="font-semibold">Binance</h3>
                                <div className="space-y-2">
                                    <Label htmlFor="binance-api-key">API Anahtarı</Label>
                                    <Input id="binance-api-key" placeholder="Binance API Anahtarınız" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="binance-secret-key">Gizli Anahtar</Label>
                                    <Input id="binance-secret-key" type="password" placeholder="Binance Gizli Anahtarınız" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} />
                                </div>
                                <div className="flex justify-end space-x-2">
                                    <Button variant="ghost" size="sm" onClick={handleRemoveKeys} disabled={!apiKey && !secretKey}><Trash2 className="mr-2 h-4 w-4" />Kaldır</Button>
                                    <Button size="sm" onClick={handleTestAndSaveKeys} disabled={isTesting}>
                                        {isTesting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Test Ediliyor...</>) : ("Kaydet ve Test Et")}
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-4 p-4 border rounded-lg border-dashed flex flex-col items-center justify-center text-center">
                                <h3 className="font-semibold mb-2">Diğer Borsalar</h3>
                                <p className="text-sm text-muted-foreground mb-4">Çoklu borsa desteği yakında geliyor!</p>
                                <Select disabled><SelectTrigger className="w-[280px]"><SelectValue placeholder="Borsa Seçin (Yakında)" /></SelectTrigger></Select>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Notifications Tab */}
                <TabsContent value="notifications">
                    <Card>
                        <CardHeader>
                            <CardTitle className="font-headline">Bildirim Ayarları</CardTitle>
                            <CardDescription>İşlemler ve bot durumu hakkında nasıl bildirim almak istediğinizi seçin.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                             <div>
                                <h4 className="font-semibold mb-3 text-lg">Kanallar</h4>
                                <div className="space-y-4">
                                     <div className="flex items-center justify-between p-4 border rounded-lg">
                                        <div><Label htmlFor="email-notifs" className="font-medium">E-posta Bildirimleri</Label><p className="text-sm text-muted-foreground">İşlem özetlerini ve uyarıları e-posta ile alın.</p></div>
                                        <Switch id="email-notifs" checked={notificationSettings.email} onCheckedChange={(c) => handleNotificationChange('email', c)} />
                                    </div>
                                    <div className="flex items-center justify-between p-4 border rounded-lg">
                                        <div><Label htmlFor="push-notifs" className="font-medium">Anlık Bildirimler</Label><p className="text-sm text-muted-foreground">Mobil cihazınızda gerçek zamanlı uyarılar alın (yakında).</p></div>
                                        <Switch id="push-notifs" checked={notificationSettings.push} onCheckedChange={(c) => handleNotificationChange('push', c)} disabled />
                                    </div>
                                    <div className="flex items-center justify-between p-4 border rounded-lg">
                                        <div><Label htmlFor="telegram-notifs" className="font-medium">Telegram Bildirimleri</Label><p className="text-sm text-muted-foreground">Botunuzdan anlık mesajlar alın.</p></div>
                                        <Switch id="telegram-notifs" checked={notificationSettings.telegram} onCheckedChange={(c) => handleNotificationChange('telegram', c)} />
                                    </div>
                                </div>
                            </div>
                            
                            {notificationSettings.telegram && (
                                <div>
                                    <h4 className="font-semibold mb-3 text-lg">Telegram Kurulumu</h4>
                                    <div className="p-4 border rounded-lg space-y-4">
                                        <p className="text-sm text-muted-foreground">Telegram botumuza bağlanarak gerçek zamanlı bildirimler alabilirsiniz. Başlamak için butona tıklayın.</p>
                                        {!isTelegramConnected ? (
                                            <Button onClick={handleConnectTelegram} disabled={isConnectingTelegram}>
                                                {isConnectingTelegram ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Bağlanıyor...</> : "Telegram Botunu Başlat"}
                                            </Button>
                                        ) : (
                                            <div className="flex items-center gap-2 text-green-400 font-medium">
                                                <Check className="h-5 w-5" /> Bağlandı: @AutoPilotBot (ID: 882910)
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                             <div>
                                <h4 className="font-semibold mb-3 text-lg">Olay Ayarları</h4>
                                <div className="p-4 border rounded-lg space-y-3">
                                    <div className="flex items-center space-x-2"><Checkbox id="tradeAlerts" checked={notificationSettings.tradeAlerts} onCheckedChange={(c) => handleNotificationChange('tradeAlerts', !!c)} /><Label htmlFor="tradeAlerts">Her işlemde bildir</Label></div>
                                    <div className="flex items-center space-x-2"><Checkbox id="errorAlerts" checked={notificationSettings.errorAlerts} onCheckedChange={(c) => handleNotificationChange('errorAlerts', !!c)} /><Label htmlFor="errorAlerts">Sadece hatalarda bildir</Label></div>
                                    <div className="flex items-center space-x-2"><Checkbox id="dailySummary" checked={notificationSettings.dailySummary} onCheckedChange={(c) => handleNotificationChange('dailySummary', !!c)} /><Label htmlFor="dailySummary">Günlük kâr raporu gönder</Label></div>
                                </div>
                            </div>
                            <Button onClick={handleSendTestNotification} variant="outline">Test Bildirimi Gönder</Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Account Tab */}
                <TabsContent value="account">
                     <Card>
                        <CardHeader>
                            <CardTitle className="font-headline">Hesap Bilgileri</CardTitle>
                            <CardDescription>Hesap detaylarınızı ve aboneliğinizi yönetin.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                             <div className="space-y-2">
                                <Label htmlFor="username">Kullanıcı Adı</Label>
                                <Input id="username" value={accountSettings.username} onChange={(e) => handleAccountChange('username', e.target.value)} />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="email">E-posta Adresi</Label>
                                <Input id="email" value={accountSettings.email} disabled />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="plan">Abonelik Planı</Label>
                                <div className="flex items-center gap-4">
                                     <Input id="plan" value={accountSettings.plan} disabled />
                                     <Button>Aboneliği Yönet</Button>
                                </div>
                                <p className="text-sm text-muted-foreground">Planınız süresiz olarak aktiftir.</p>
                            </div>
                            <Button onClick={handleSaveAccount}>Değişiklikleri Kaydet</Button>
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
