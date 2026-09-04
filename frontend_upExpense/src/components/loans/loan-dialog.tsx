"use client";

import { useState } from "react";
import { Landmark, Tag, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { LoanSummary } from "@/lib/types";
import { createLoan, updateLoan, type LoanDraft } from "@/lib/loans";
import { formatMoney, formatMoneyCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ColorPicker } from "@/components/color-picker";
import { IconPicker } from "@/components/icon-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogMedia,
  DialogSection,
  DialogSectionHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

/**
 * Add / edit a loan. Same form both ways — editing only differs in that the
 * principal already has payments logged against it, which the form warns
 * about when the new principal would fall below what's been paid.
 */
export function LoanDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create mode. */
  editing: LoanSummary | null;
  onSaved: (loan: LoanSummary, isEdit: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Keyed by target: switching between "add" and a specific loan
            remounts the form, so its fields start from the right values
            without an effect syncing props into state. */}
        <LoanForm
          key={editing?.category_id ?? "new"}
          editing={editing}
          onSaved={onSaved}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function LoanForm({
  editing,
  onSaved,
  onClose,
}: {
  editing: LoanSummary | null;
  onSaved: (loan: LoanSummary, isEdit: boolean) => void;
  onClose: () => void;
}) {
  const supabase = createClient();

  const [name, setName] = useState(editing?.name ?? "");
  const [principal, setPrincipal] = useState(
    editing ? String(editing.principal) : ""
  );
  const [description, setDescription] = useState(editing?.description ?? "");
  const [icon, setIcon] = useState(editing?.icon ?? "");
  const [color, setColor] = useState(editing?.color ?? "#4a3aa7");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const label = name.trim();
    if (!label) {
      setError("Give the loan a name.");
      return;
    }
    const amount = parseFloat(principal);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a loan amount greater than 0.");
      return;
    }

    const draft: LoanDraft = {
      name: label,
      principal: amount,
      description: description.trim() || null,
      icon: icon || null,
      color,
    };

    setSaving(true);
    try {
      if (editing) {
        await updateLoan(supabase, editing.category_id, draft);
        onSaved(
          {
            ...editing,
            ...draft,
            remaining: Math.max(amount - editing.paid, 0),
          },
          true
        );
      } else {
        onSaved(await createLoan(supabase, draft), false);
      }
      onClose();
    } catch (err) {
      const dbError = err as { code?: string; message?: string };
      setError(
        dbError.code === "23505"
          ? `A category named "${label}" already exists.`
          : (dbError.message ?? "Could not save the loan.")
      );
    } finally {
      setSaving(false);
    }
  }

  const parsed = parseFloat(principal);
  const validAmount = Number.isFinite(parsed) && parsed > 0;
  const shrinksBelowPaid = !!editing && validAmount && parsed < editing.paid;

  return (
    <>
      <DialogHeader>
        <DialogMedia>
          <Landmark />
        </DialogMedia>
        <DialogTitle>{editing ? "Edit loan" : "Add a loan"}</DialogTitle>
        <DialogDescription>
          {editing
            ? "Payments already logged stay put."
            : "It becomes a chip on the expenses tab."}
        </DialogDescription>
      </DialogHeader>

      <form
        id="loan-form"
        onSubmit={handleSubmit}
        className="contents"
      >
        <DialogBody>
          <DialogSection>
            <DialogSectionHeader
              icon={<Wallet />}
              title="Total to repay"
              hint="The full amount you owe"
              action={
                validAmount ? (
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">
                    {formatMoneyCompact(parsed)}
                  </span>
                ) : undefined
              }
            />
            <div className="relative mt-3">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-muted-foreground">
                Rs.
              </span>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                aria-label="Total to repay, in rupees"
                autoFocus={!editing}
                className="h-12 bg-background pl-10 text-lg font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </div>
          </DialogSection>

          <DialogSection>
            <DialogSectionHeader
              icon={<Tag />}
              title="Label & look"
              hint="How the chip reads on the expenses tab"
            />

            <div className="mt-3 space-y-2">
              <div className="flex gap-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Car loan"
                  aria-label="Loan name"
                  autoFocus={!!editing}
                  className="min-w-0 flex-1 bg-background"
                />
                <IconPicker value={icon} onChange={setIcon} kind="loan" />
                <ColorPicker value={color} onChange={setColor} />
              </div>

              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
                aria-label="Loan description"
                className="bg-background"
              />
            </div>

            {/* The exact chip the expenses tab will render, live. Choosing an
                icon and a colour blind is the weak spot of this form. */}
            <div className="mt-3 flex items-center gap-2 border-t pt-3">
              <span className="shrink-0 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                Preview
              </span>
              <span
                className={cn(
                  "flex min-w-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-white",
                  !name.trim() && "opacity-60"
                )}
                style={{ backgroundColor: color }}
              >
                <span className="truncate">
                  {icon || "🏦"} {name.trim() || "Loan name"}
                </span>
                <span className="shrink-0 tabular-nums opacity-80">
                  {validAmount ? formatMoneyCompact(parsed) : "Rs 0"}
                </span>
              </span>
            </div>
          </DialogSection>

          {shrinksBelowPaid && (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              You&apos;ve already paid {formatMoney(editing.paid)} against this
              loan. Saving a smaller total marks it as cleared.
            </p>
          )}

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </DialogBody>
      </form>

      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" form="loan-form" size="lg" disabled={saving}>
          {saving ? "Saving…" : editing ? "Save changes" : "Add loan"}
        </Button>
      </DialogFooter>
    </>
  );
}
