"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Camera,
  ChevronDown,
  Clock,
  Loader2,
  LogOut,
  Mail,
  Settings,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB
const ACCEPTED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** Google-provided photo, if this account signed in with Google. */
function metadataAvatar(user: User): string | null {
  const meta = user.user_metadata ?? {};
  return (
    (meta.avatar_url as string | undefined) ??
    (meta.picture as string | undefined) ??
    null
  );
}

/** Storage path inside the avatars bucket for a public URL we uploaded. */
function storagePathFromUrl(url: string | null): string | null {
  if (!url) return null;
  const marker = `/${AVATAR_BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}

/** Avatar with image + letter fallback, reused at every size. */
function UserAvatar({
  src,
  letter,
  className,
  fallbackClassName,
}: {
  src: string | null;
  letter: string;
  className?: string;
  fallbackClassName?: string;
}) {
  return (
    <Avatar className={className}>
      {src && (
        <AvatarImage src={src} alt="" referrerPolicy="no-referrer" />
      )}
      <AvatarFallback className={fallbackClassName}>{letter}</AvatarFallback>
    </Avatar>
  );
}

export function UserMenu() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  // Custom uploaded avatar (profiles.avatar_url); null once loaded with none.
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
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

      const { data: profile } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", user.id)
        .single();
      if (!ignore) setCustomAvatar(profile?.avatar_url ?? null);
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
  const letter = username[0]?.toUpperCase() ?? "?";

  // Custom upload wins; otherwise fall back to the Google photo, then letter.
  const avatarUrl = customAvatar ?? metadataAvatar(user);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-9 gap-1 rounded-full px-1.5"
            aria-label="Account menu"
          >
            <UserAvatar
              src={avatarUrl}
              letter={letter}
              className="size-7"
              fallbackClassName="bg-primary text-xs font-bold uppercase text-primary-foreground"
            />
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
              <UserAvatar
                src={avatarUrl}
                letter={letter}
                className="size-9"
                fallbackClassName="bg-primary text-sm font-bold uppercase text-primary-foreground"
              />
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
        letter={letter}
        avatarUrl={avatarUrl}
        hasCustomAvatar={!!customAvatar}
        onCustomAvatarChange={setCustomAvatar}
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
  letter,
  avatarUrl,
  hasCustomAvatar,
  onCustomAvatarChange,
  open,
  onOpenChange,
}: {
  user: User;
  username: string;
  letter: string;
  avatarUrl: string | null;
  hasCustomAvatar: boolean;
  onCustomAvatarChange: (url: string | null) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;

    setError(null);
    const ext = ACCEPTED_TYPES[file.type];
    if (!ext) {
      setError("Use a PNG, JPG, or WebP image.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError("Image must be 2 MB or smaller.");
      return;
    }

    setBusy(true);
    const prevPath = storagePathFromUrl(hasCustomAvatar ? avatarUrl : null);
    const path = `${user.id}/${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setError(upErr.message);
      setBusy(false);
      return;
    }

    const publicUrl = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
      .data.publicUrl;

    const { error: dbErr } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", user.id);
    if (dbErr) {
      setError(dbErr.message);
      setBusy(false);
      return;
    }

    // Best-effort cleanup of the previous custom image.
    if (prevPath && prevPath !== path) {
      await supabase.storage.from(AVATAR_BUCKET).remove([prevPath]);
    }

    onCustomAvatarChange(publicUrl);
    setBusy(false);
  }

  async function handleRemove() {
    setError(null);
    setBusy(true);
    const prevPath = storagePathFromUrl(avatarUrl);

    const { error: dbErr } = await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", user.id);
    if (dbErr) {
      setError(dbErr.message);
      setBusy(false);
      return;
    }
    if (prevPath) {
      await supabase.storage.from(AVATAR_BUCKET).remove([prevPath]);
    }
    onCustomAvatarChange(null);
    setBusy(false);
  }

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
          <div className="relative -mt-10">
            <UserAvatar
              src={avatarUrl}
              letter={letter}
              className="size-20 shadow-lg ring-4 ring-background"
              fallbackClassName="bg-primary text-2xl font-bold uppercase text-primary-foreground"
            />
            {/* Change-photo button, bottom-right of the avatar */}
            <Button
              type="button"
              size="icon-sm"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              aria-label="Change profile photo"
              className="absolute -right-1 bottom-0 size-8 rounded-full shadow-md ring-2 ring-background"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Camera className="size-4" />
              )}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFile}
              className="hidden"
            />
          </div>

          <DialogHeader className="mt-3 items-center text-center">
            <DialogTitle className="text-lg">{username}</DialogTitle>
            <DialogDescription className="truncate">
              {user.email}
            </DialogDescription>
          </DialogHeader>

          {hasCustomAvatar && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={busy}
              className="mt-2 h-7 gap-1.5 text-xs text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
              Remove photo
            </Button>
          )}

          {error && (
            <p className="mt-3 w-full rounded-md bg-destructive/10 px-3 py-2 text-center text-xs text-destructive">
              {error}
            </p>
          )}

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
