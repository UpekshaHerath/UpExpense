import { BottomNav, NavBar } from "@/components/nav-bar";
import { MotionProvider } from "@/components/motion-provider";
import { Tour } from "@/components/tour/tour";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MotionProvider>
      <div className="flex min-h-screen flex-col">
        <NavBar />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-24 pt-6">
          {children}
        </main>
        <BottomNav />
        {/* First-run walkthrough — self-mounting, runs once per account. */}
        <Tour />
      </div>
    </MotionProvider>
  );
}
