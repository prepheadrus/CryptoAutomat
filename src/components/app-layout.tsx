"use client";

import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Bot,
  LogOut,
  Share2,
  LayoutDashboard,
  Settings,
  User,
  Menu,
  CandlestickChart,
} from "lucide-react";
import Link from "next/link";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import type { ImagePlaceholder } from "@/lib/placeholder-images";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

const navItems = [
  { href: "/", label: "Özet Panel", icon: LayoutDashboard },
  { href: "/editor", label: "Strateji Editörü", icon: Share2 },
  { href: "/bot-status", label: "Bot Yönetimi", icon: Bot },
  { href: "/market", label: "Piyasa Analizi", icon: CandlestickChart },
  { href: "/settings", label: "Ayarlar", icon: Settings },
];

function NavigationLinks({ inSheet = false }: { inSheet?: boolean }) {
  const pathname = usePathname();
  const linkClass = inSheet ? "hover:text-foreground" : "transition-colors hover:text-foreground flex items-center gap-2";
  const activeClass = inSheet ? "text-foreground" : "text-foreground";
  const inactiveClass = inSheet ? "text-muted-foreground" : "text-muted-foreground";

  return (
    <>
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            linkClass,
            pathname === item.href ? activeClass : inactiveClass
          )}
        >
          <item.icon className="h-4 w-4"/>
          {item.label}
        </Link>
      ))}
    </>
  );
}


export function AppLayout({ children }: { children: React.ReactNode }) {
  const userAvatar = PlaceHolderImages.find(p => p.id === 'user-avatar') as ImagePlaceholder;
  const pathname = usePathname();
  const isEditorPage = pathname === '/editor';

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 z-30 shrink-0">
        <nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-semibold md:text-base text-primary"
          >
            <Bot className="h-6 w-6" />
            <span className="font-headline">AutoPilot</span>
          </Link>
          <NavigationLinks />
        </nav>
        
        {/* Mobile Menu */}
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 md:hidden"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <nav className="grid gap-6 text-lg font-medium">
                <Link
                href="/"
                className="flex items-center gap-2 text-lg font-semibold text-primary"
                >
                <Bot className="h-6 w-6" />
                <span className="sr-only">AutoPilot</span>
                </Link>
                <NavigationLinks inSheet={true} />
            </nav>
          </SheetContent>
        </Sheet>
        
        <div className="flex w-full items-center justify-end gap-4 md:ml-auto md:gap-2 lg:gap-4">
            <div className="flex items-center gap-3">
              <div className="flex flex-col text-right">
                <span className="text-sm font-medium">Trader Pro</span>
                <span className="text-xs text-muted-foreground">
                  user@autopilot.dev
                </span>
              </div>
              <Avatar className="h-9 w-9">
                <AvatarImage src={userAvatar.imageUrl} data-ai-hint={userAvatar.imageHint} alt="User Avatar" />
                <AvatarFallback>
                  <User />
                </AvatarFallback>
              </Avatar>
              <Button variant="ghost" size="icon" className="ml-auto">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
        </div>
      </header>

      <main className={`flex flex-1 flex-col ${isEditorPage ? 'p-0 overflow-hidden' : 'p-6 overflow-y-auto'}`}>
          {children}
      </main>
    </div>
  );
}
