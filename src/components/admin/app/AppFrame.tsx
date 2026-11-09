import * as React from 'react';
import { FileText, LogOut, X } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/admin/ui/avatar';
import { Button } from '@/components/admin/ui/button';
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from '@/components/admin/ui/sidebar';
import { TooltipProvider } from '@/components/admin/ui/tooltip';
import { goWith, send } from './api';
import { Notice } from './common';
import type { FrameData } from './types';

// Generate and Insights are set aside for now: reachable by address, not listed.
const NAV = [
  { id: 'posts', label: 'Posts', href: '/admin/posts/', icon: FileText },
] as const;

export function Brand() {
  return <a href="/admin/" className="flex items-center gap-2.5 font-[family-name:var(--font-varela-round)] text-base text-heading"><img src="/favicon-32.png" alt="" width="24" height="24" className="size-6" />Easy Clinic</a>;
}

function FlashBanner({ frame }: { frame: FrameData }) {
  const [show, setShow] = React.useState(Boolean(frame.flash));
  const [busy, setBusy] = React.useState(false);
  if (!show || !frame.flash) return null;
  const dismiss = () => {
    setShow(false);
    const url = new URL(location.href);
    ['flash', 'flashKind', 'undo'].forEach((key) => url.searchParams.delete(key));
    history.replaceState(null, '', url.pathname + url.search);
  };
  const undo = async () => {
    setBusy(true);
    const reply = await send('/admin/api/posts/bulk/', { op: 'restore', 'slugs[]': frame.undo!.split(',') });
    const clean = new URL(location.href);
    clean.searchParams.delete('undo');
    goWith(clean.pathname + clean.search, reply.ok ? 'Moved back. It is not live.' : reply.message, reply.ok ? 'success' : 'error');
  };
  return (
    <Notice live tone={frame.flash.kind} className="mb-4" actions={<>
      {frame.undo && <Button size="sm" variant="outline" disabled={busy} onClick={undo}>Undo</Button>}
      <Button size="sm" variant="ghost" onClick={dismiss}><X aria-hidden="true" />Dismiss</Button>
    </>}>{frame.flash.message}</Notice>
  );
}

export function AppFrame({ frame, title, meta, actions, back, children }: { frame: FrameData; title: React.ReactNode; meta?: React.ReactNode; actions?: React.ReactNode; back?: { href: string; label: string }; children: React.ReactNode }) {
  const initial = (frame.user.name || frame.user.email).charAt(0).toUpperCase();
  return (
    <TooltipProvider>
      <SidebarProvider style={{ '--sidebar-width': '13.5rem' } as React.CSSProperties}>
        <Sidebar variant="inset">
          <SidebarHeader className="h-14 justify-center px-4"><Brand /></SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <nav aria-label="Admin">
                  <SidebarMenu>
                    {NAV.map((item) => (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton asChild isActive={item.id === frame.current}>
                          <a href={item.href} aria-current={item.id === frame.current ? 'page' : undefined} className="h-9"><item.icon aria-hidden="true" /><span>{item.label}</span></a>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </nav>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <div className="flex items-center gap-2">
              <Avatar className="size-8"><AvatarFallback aria-hidden="true" className="border bg-card font-medium text-heading">{initial}</AvatarFallback></Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-heading" title={frame.user.email}>{frame.user.name}</p>
                <p className="text-muted-foreground">{frame.user.role === 'approver' ? 'Approver' : 'Editor'}</p>
              </div>
              <form method="post" action="/admin/auth/logout/">
                <Button type="submit" variant="ghost" size="icon" aria-label="Sign out" title="Sign out"><LogOut aria-hidden="true" /></Button>
              </form>
            </div>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset id="main" tabIndex={-1} className="min-w-0">
          <header className="sticky top-0 z-20 flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 border-b bg-background px-4 py-2 sm:px-6 md:rounded-t-xl">
            <SidebarTrigger className="md:hidden" aria-label="Open menu" />
            {back && <a href={back.href} className="whitespace-nowrap text-muted-foreground underline-offset-2 hover:underline">← {back.label}</a>}
            <h1 className="min-w-0 truncate font-semibold tracking-tight text-heading" title={typeof title === 'string' ? title : undefined}>{title}</h1>
            {meta && <div className="flex min-w-0 flex-wrap items-center gap-2 text-muted-foreground">{meta}</div>}
            {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
          </header>
          <div className="min-w-0 flex-1 p-4 sm:p-6">
            <FlashBanner frame={frame} />
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
