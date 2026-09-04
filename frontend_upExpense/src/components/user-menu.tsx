"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Camera,
  ChevronDown,
  Clock,
  Crop,
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
import { cn } from "@/lib/utils";
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
import {
  AvatarCropper,
  DEFAULT_CROP,
  type CropTransform,
} from "@/components/avatar-cropper";

const AVATAR_BUCKET = "avatars";
// The editor re-encodes to a small square, so the *input* can be generous —
// phone cameras routinely produce 5–8 MB shots.
const MAX_AVATAR_BYTES = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** The custom picture, its untouched source, and how it was framed. */
type AvatarState = {
  url: string | null;
  originalUrl: string | null;
  crop: CropTransform | null;
};

const EMPTY_AVATAR: AvatarState = { url: null, originalUrl: null, crop: null };

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
      {src && <AvatarImage src={src} alt="" referrerPolicy="no-referrer" />}
      <AvatarFallback className={fallbackClassName}>{letter}</AvatarFallback>
    </Avatar>
  );
}

export function UserMenu() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  // Custom uploaded avatar (profiles.avatar_*); empty once loaded with none.
  const [avatar, setAvatar] = useState<AvatarState>(EMPTY_AVATAR);
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

      const full = await supabase
        .from("profiles")
        .select("avatar_url, avatar_original_url, avatar_crop")
        .eq("id", user.id)
        .single();
      let profile: {
        avatar_url?: string | null;
        avatar_original_url?: string | null;
        avatar_crop?: CropTransform | null;
      } | null = full.data;
      // Migration 006 adds avatar_original_url/avatar_crop. Until it runs the
      // select 400s, so fall back to the 005 shape rather than dropping the
      // user's picture — reframing simply stays unavailable.
      if (full.error) {
        const legacy = await supabase
          .from("profiles")
          .select("avatar_url")
          .eq("id", user.id)
          .single();
        profile = legacy.data;
      }
      if (ignore) return;
      setAvatar({
        url: profile?.avatar_url ?? null,
        originalUrl: profile?.avatar_original_url ?? null,
        crop: (profile?.avatar_crop as CropTransform | null) ?? null,
      });
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
  const avatarUrl = avatar.url ?? metadataAvatar(user);

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
        displayAvatar={avatarUrl}
        avatar={avatar}
        onAvatarChange={setAvatar}
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
  displayAvatar,
  avatar,
  onAvatarChange,
  open,
  onOpenChange,
}: {
  user: User;
  username: string;
  letter: string;
  /** What the UI actually shows — custom upload, else the Google photo. */
  displayAvatar: string | null;
  avatar: AvatarState;
  onAvatarChange: (next: AvatarState) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // What the cropper is editing: a freshly picked file (we own the object
  // URL and must revoke it) or the stored original being reframed.
  const [editing, setEditing] = useState<{
    src: string;
    file: File | null;
    initial: CropTransform;
  } | null>(null);

  useEffect(() => {
    // Revoke the object URL of the previous session, never the current one.
    return () => {
      if (editing?.file) URL.revokeObjectURL(editing.src);
    };
  }, [editing]);

  function startEditing(file: File) {
    setError(null);
    if (!ACCEPTED_TYPES[file.type]) {
      setError("Use a PNG, JPG, or WebP image.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError("Image must be 10 MB or smaller.");
      return;
    }
    setEditing({
      src: URL.createObjectURL(file),
      file,
      initial: DEFAULT_CROP,
    });
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (file) startEditing(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) startEditing(file);
  }

  /** Reframe the stored original — always cuts from full resolution, so
   *  adjusting twice never compounds quality loss. */
  function startReadjust() {
    if (!avatar.originalUrl) return;
    setError(null);
    setEditing({
      src: avatar.originalUrl,
      file: null,
      initial: avatar.crop ?? DEFAULT_CROP,
    });
  }

  /** Upload the crop (and, for a new pick, its original), then repoint the
   *  profile row and bin the files it replaced. Throws so the cropper can
   *  surface the message inline. */
  async function saveCrop(cropped: Blob, transform: CropTransform) {
    const source = editing?.file ?? null;
    const stamp = Date.now();
    const storage = supabase.storage.from(AVATAR_BUCKET);

    const stalePaths = [storagePathFromUrl(avatar.url)];
    let originalUrl = avatar.originalUrl;
    let originalPath: string | null = null;

    if (source) {
      stalePaths.push(storagePathFromUrl(avatar.originalUrl));
      const ext = ACCEPTED_TYPES[source.type];
      originalPath = `${user.id}/original-${stamp}.${ext}`;
      const { error: upErr } = await storage.upload(originalPath, source, {
        upsert: true,
        contentType: source.type,
      });
      if (upErr) throw new Error(upErr.message);
      originalUrl = storage.getPublicUrl(originalPath).data.publicUrl;
    }

    // toBlob falls back to PNG where WebP encoding is unavailable.
    const cropExt = cropped.type === "image/png" ? "png" : "webp";
    const cropPath = `${user.id}/avatar-${stamp}.${cropExt}`;
    const { error: cropErr } = await storage.upload(cropPath, cropped, {
      upsert: true,
      contentType: cropped.type || "image/webp",
    });
    if (cropErr) throw new Error(cropErr.message);
    const publicUrl = storage.getPublicUrl(cropPath).data.publicUrl;

    const { error: dbErr } = await supabase
      .from("profiles")
      .update({
        avatar_url: publicUrl,
        avatar_original_url: originalUrl,
        avatar_crop: transform,
      })
      .eq("id", user.id);
    if (dbErr) {
      // Same pre-006 fallback as the initial load: keep the new picture even
      // when the columns that make it re-adjustable do not exist yet.
      const { error: legacyErr } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);
      if (legacyErr) throw new Error(legacyErr.message);
      originalUrl = null;
      // Nothing can reference the original we just uploaded — do not leave it.
      if (originalPath) stalePaths.push(originalPath);
    }

    // Best-effort cleanup of what we just replaced.
    const dead = stalePaths.filter(
      (p): p is string => !!p && p !== cropPath
    );
    if (dead.length) await storage.remove(dead);

    onAvatarChange({ url: publicUrl, originalUrl, crop: transform });
    setEditing(null);
  }

  async function handleRemove() {
    setError(null);
    setBusy(true);
    const dead = [
      storagePathFromUrl(avatar.url),
      storagePathFromUrl(avatar.originalUrl),
    ].filter((p): p is string => !!p);

    const { error: dbErr } = await supabase
      .from("profiles")
      .update({
        avatar_url: null,
        avatar_original_url: null,
        avatar_crop: null,
      })
      .eq("id", user.id);
    if (dbErr) {
      setError(dbErr.message);
      setBusy(false);
      return;
    }
    if (dead.length) {
      await supabase.storage.from(AVATAR_BUCKET).remove(dead);
    }
    onAvatarChange(EMPTY_AVATAR);
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

  const hasCustomAvatar = !!avatar.url;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-h-[calc(100dvh-1.5rem)] gap-0 overflow-y-auto overscroll-contain p-0 sm:max-w-sm"
          showCloseButton={false}
        >
          {/* Cover band — avatar overlaps it below */}
          <div className="h-24 shrink-0 bg-gradient-to-br from-primary via-primary/80 to-primary/50" />
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
            {/* Drop target on desktop; tap-through to the picker everywhere. */}
            <div
              className="relative -mt-10"
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                aria-label="Change profile photo"
                data-ripple-host
                className="group relative isolate block rounded-full focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {/* The camera badge hangs outside the button, so the wave is
                    clipped to this overlay rather than to the button. */}
                <span
                  aria-hidden
                  data-ripple-surface
                  className="ripple pointer-events-none absolute inset-0 -z-10 rounded-full"
                />
                <UserAvatar
                  src={displayAvatar}
                  letter={letter}
                  className={cn(
                    "size-20 shadow-lg ring-4 ring-background transition-shadow",
                    dragging && "ring-primary"
                  )}
                  fallbackClassName="bg-primary text-2xl font-bold uppercase text-primary-foreground"
                />
                <span
                  className={cn(
                    "absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity",
                    "group-hover:opacity-100 group-focus-visible:opacity-100",
                    dragging && "opacity-100"
                  )}
                >
                  <Camera className="size-5" />
                </span>
                {/* Explicit affordance for touch, where hover does not exist.
                    Inside the button so the badge is part of the tap target. */}
                <span
                  aria-hidden
                  className="absolute -right-1 bottom-0 flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-background"
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Camera className="size-4" />
                  )}
                </span>
              </button>
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

            {(avatar.originalUrl || hasCustomAvatar) && (
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                {avatar.originalUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={startReadjust}
                    disabled={busy}
                  >
                    <Crop />
                    Adjust
                  </Button>
                )}
                {hasCustomAvatar && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemove}
                    disabled={busy}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 />
                    Remove
                  </Button>
                )}
              </div>
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

      <AvatarCropper
        src={editing?.src ?? null}
        initial={editing?.initial ?? null}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onConfirm={saveCrop}
        title={editing?.file ? "Adjust your photo" : "Reframe your photo"}
      />
    </>
  );
}
