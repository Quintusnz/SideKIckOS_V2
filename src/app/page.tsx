import ChatInterface from './components/ChatInterface';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground [--header-height:calc(--spacing(14))]">
      <SidebarProvider className="flex min-h-screen flex-col">
        <SiteHeader />
        <div className="flex flex-1">
          <AppSidebar />
          <SidebarInset>
            <div className="flex flex-1 flex-col gap-4 p-4">
              <ChatInterface />
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}
