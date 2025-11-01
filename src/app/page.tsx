import ChatInterface from './components/ChatInterface';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

export default function Home() {
  return (
    <div className="h-screen bg-background text-foreground flex flex-col [--header-height:calc(--spacing(14))]">
      <SidebarProvider className="flex h-screen flex-col">
        <SiteHeader />
        <div className="flex flex-1 min-h-0">
          <AppSidebar />
          <SidebarInset>
            <div className="flex h-full min-h-0 flex-1 flex-col gap-4 p-4">
              <ChatInterface />
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}
