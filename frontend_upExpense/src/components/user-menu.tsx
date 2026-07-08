"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronDown,
  Clock,
  LogOut,
  Mail,
  Settings,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsDialog } from "@/components/settings-dialog";

export function UserMenu() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (ignore || !user) return;
      setUser(user);
    })();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (!user) {
    return <Skeleton className="h-8 w-8 rounded-full" />;
  }

  const email = user.email ?? null;
  const username =
    (user.user_metadata?.username as string | undefined) ??
    email?.split("@")[0] ??
    "me";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-9 gap-1 rounded-full px-1.5"
            aria-label="Account menu"
          >
            <Avatar className="size-7">
              <AvatarFallback className="bg-primary text-xs font-bold uppercase text-primary-foreground">
                {username[0]}
              </AvatarFallback>
            </Avatar>
            <ChevronDown className="size-3 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          // Trigger is 36px tall inside the 56px nav bar → 10px drops the
          // popup's top edge exactly to the bar's bottom border line.
          sideOffset={10}
          collisionPadding={8}
          className="w-64 max-w-[calc(100vw-1rem)] rounded-xl p-1.5"
        >
          <DropdownMenuLabel className="p-0">
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-2.5 py-2.5">
              <Avatar className="size-9">
                <AvatarFallback className="bg-primary text-sm font-bold uppercase text-primary-foreground">
                  {username[0]}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{username}</p>
                {email && (
                  <p className="truncate text-xs font-normal text-muted-foreground">
                    {email}
                  </p>
                )}
              </div>
            </div>
          </DropdownMenuLabel>
          <div className="py-1">
            <DropdownMenuItem
              className="gap-3 rounded-lg px-2.5 py-2"
              onSelect={() => setProfileOpen(true)}
            >
              <UserRound className="size-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-3 rounded-lg px-2.5 py-2"
              onSelect={() => setSettingsOpen(true)}
            >
              <Settings className="size-4" />
              Settings
            </DropdownMenuItem>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            className="mt-1 gap-3 rounded-lg px-2.5 py-2"
            disabled={signingOut}
            onSelect={(e) => {
              e.preventDefault();
              handleSignOut();
            }}
          >
            <LogOut className="size-4" />
            {signingOut ? "Logging out…" : "Log out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProfileDialog
        user={user}
        username={username}
        open={profileOpen}
        onOpenChange={setProfileOpen}
      />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}

function formatTimestamp(iso: string | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function ProfileDialog({
  user,
  username,
  open,
  onOpenChange,
}: {
  user: User;
  username: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const rows: {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
  }[] = [
    {
      icon: <Mail className="size-4" />,
      label: "Email",
      value: user.email ?? "—",
    },
    {
      icon: <ShieldCheck className="size-4" />,
      label: "Email status",
      value: user.email_confirmed_at ? (
        <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
          Verified
        </Badge>
      ) : (
        <Badge variant="outline">Unverified</Badge>
      ),
    },
    {
      icon: <CalendarDays className="size-4" />,
      label: "Member since",
      value: formatTimestamp(user.created_at),
    },
    {
      icon: <Clock className="size-4" />,
      label: "Last sign in",
      value: formatTimestamp(user.last_sign_in_at ?? undefined),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="gap-0 overflow-hidden p-0 sm:max-w-sm"
        showCloseButton={false}
      >
        {/* Cover band — avatar overlaps it below */}
        <div className="h-24 bg-gradient-to-br from-primary via-primary/80 to-primary/50" />
        <DialogClose asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute top-2 right-2 text-primary-foreground/80 hover:bg-white/15 hover:text-primary-foreground"
          >
            <X />
            <span className="sr-only">Close</span>
          </Button>
        </DialogClose>

        <div className="flex flex-col items-center px-6 pb-6">
          <Avatar className="-mt-10 size-20 shadow-lg ring-4 ring-background">
            <AvatarFallback className="bg-primary text-2xl font-bold uppercase text-primary-foreground">
              {username[0]}
            </AvatarFallback>
          </Avatar>

          <DialogHeader className="mt-3 items-center text-center">
            <DialogTitle className="text-lg">{username}</DialogTitle>
            <DialogDescription className="truncate">
              {user.email}
            </DialogDescription>
          </DialogHeader>

          <dl className="mt-5 w-full space-y-2">
            {rows.map((r) => (
              <div
                key={r.label}
                className="flex items-center gap-3 rounded-xl bg-muted/50 px-3 py-2.5"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground shadow-sm">
                  {r.icon}
                </span>
                <dt className="text-xs text-muted-foreground">{r.label}</dt>
                <dd className="ml-auto min-w-0 truncate text-sm font-medium">
                  {r.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </DialogContent>
    </Dialog>
  );
}
