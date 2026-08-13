import { BottomNav, NavBar } from "@/components/nav-bar";
import { MotionProvider } from "@/components/motion-provider";
import { Tour } from "@/components/tour/tour";
import { ToastProvider } from "@/components/ui/toast";
import { RewardProvider } from "@/components/rewards/rewards";
import { StreakProvider } from "@/components/streak/streak";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MotionProvider>
      {/* Rewards sit inside toasts: an over-budget milestone degrades to one. */}
      <ToastProvider>
        <RewardProvider>
          {/* Streaks claim milestones, so they sit inside the reward engine. */}
          <StreakProvider>
            <div className="flex min-h-screen flex-col">
              <NavBar />
              <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-24 pt-6">
                {children}
              </main>
              <BottomNav />
              {/* First-run walkthrough — self-mounting, runs once per account. */}
              <Tour />
            </div>
          </StreakProvider>
        </RewardProvider>
      </ToastProvider>
    </MotionProvider>
  );
}
