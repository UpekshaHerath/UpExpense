"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LoanSummary } from "@/lib/types";
import { createLoan, updateLoan, type LoanDraft } from "@/lib/loans";
import { formatMoney } from "@/lib/format";
import { ColorPicker } from "@/components/color-picker";
import { IconPicker } from "@/components/icon-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Add / edit a loan. Same form both ways — editing only differs in that the
 * principal already has payments logged against it, which the footer warns
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
  const shrinksBelowPaid =
    !!editing && Number.isFinite(parsed) && parsed < editing.paid;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? "Edit loan" : "Add a loan"}</DialogTitle>
        <DialogDescription>
          {editing
            ? "Update the loan's details. Payments already logged stay put."
            : "Track something you owe. It becomes a chip on the expenses tab — log an installment and the balance drops."}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="loan-name">Name</Label>
          <div className="flex gap-2">
            <Input
              id="loan-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Car loan"
              autoFocus
              className="min-w-0 flex-1"
            />
            <IconPicker value={icon} onChange={setIcon} kind="loan" />
            <ColorPicker value={color} onChange={setColor} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="loan-amount">Total to repay</Label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-muted-foreground">
              Rs.
            </span>
            <Input
              id="loan-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
              className="h-11 pl-10 text-lg font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="loan-note">Description (optional)</Label>
          <Input
            id="loan-note"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="36 months, 12% — Bank of Ceylon"
          />
        </div>

        {shrinksBelowPaid && (
          <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
            You&apos;ve already paid {formatMoney(editing.paid)} against this
            loan. Saving a smaller total marks it as cleared.
          </p>
        )}

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Add loan"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
