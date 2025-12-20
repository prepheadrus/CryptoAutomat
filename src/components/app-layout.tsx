"use client";

import { usePathname } from "next/navigation";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Bot,
  LogOut,
  Share2,
  LayoutDashboard,
  Settings,
  User,
} from "lucide-react";
import Link from "next/link";
import { Separator } from "./ui/separator";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import type { ImagePlaceholder } from "@/lib/placeholder-images";
import { cn } from "@/lib/utils";

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
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/20 text-primary">
                <Bot className="h-6 w-6" />
              </div>
              <h1 className="text-xl font-semibold font-headline text-primary">
                AutoPilot
              </h1>
            </div>
          </SidebarHeader>
          <SidebarContent className="p-2">
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.label}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter>
            <Separator className="my-1" />
            <div className="flex items-center gap-3 p-2">
              <Avatar className="h-9 w-9">
                <AvatarImage src={userAvatar.imageUrl} data-ai-hint={userAvatar.imageHint} alt="User Avatar" />
                <AvatarFallback>
                  <User />
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium">Trader Pro</span>
                <span className="text-xs text-muted-foreground">
                  user@autopilot.dev
                </span>
              </div>
              <Button variant="ghost" size="icon" className="ml-auto">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between h-14 shrink-0 px-4 border-b md:justify-end">
            <SidebarTrigger className="md:hidden" />
            <p className="text-sm text-muted-foreground">Algo Trading Platform</p>
          </header>
          <main className={cn(
              "flex-1 overflow-auto bg-background",
              // Remove padding for the editor page to allow it to fill the entire space
              pathname !== '/editor' && "p-4 md:p-6"
            )}>
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
