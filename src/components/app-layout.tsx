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
  { href: "/", icon: LayoutDashboard, label: "Özet Panel" },
  { href: "/editor", icon: Share2, label: "Strateji Editörü" },
  { href: "/bot-status", icon: Bot, label: "Bot Yönetimi" },
  { href: "/settings", icon: Settings, label: "Ayarlar" },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const userAvatar = PlaceHolderImages.find(p => p.id === 'user-avatar') as ImagePlaceholder;

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 z-30">
        <nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
          <Link
            href="#"
            className="flex items-center gap-2 text-lg font-semibold md:text-base text-primary"
          >
            <Bot className="h-6 w-6" />
            <span className="font-headline">AutoPilot</span>
          </Link>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "transition-colors hover:text-foreground",
                pathname === item.href ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
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
                href="#"
                className="flex items-center gap-2 text-lg font-semibold text-primary"
              >
                <Bot className="h-6 w-6" />
                <span className="sr-only">AutoPilot</span>
              </Link>
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "hover:text-foreground",
                     pathname === item.href ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {item.label}
                </Link>
              ))}
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
      <main className={cn(
          "flex-1 bg-background overflow-auto",
          // Editör sayfası için özel padding'i kaldırıyoruz, diğerleri için ekliyoruz.
          pathname === '/editor' ? "p-0" : "p-4 md:p-6"
        )}>
          {/* Editör sayfasının tam yüksekliği kullanabilmesi için ekstra bir div ekliyoruz */}
          <div className={cn(pathname === '/editor' && "h-full w-full")}>
            {children}
          </div>
      </main>
    </div>
  );
}
