"use client";

import { useState } from "react";
import { PiggyBank, Tag, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { SavingSummary } from "@/lib/types";
import { createSaving, updateSaving, type SavingDraft } from "@/lib/savings";
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
import {
  MoneyPrefix,
  moneyInputPadding,
  useCurrency,
} from "@/components/currency";

/**
 * Add / edit a savings pot. The mirror of LoanDialog, with one difference
 * that shapes the whole form: the target is optional. "Emergency fund" with
 * no number is a perfectly good pot, so the amount field must never block a
 * save.
 */
export function SavingDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create mode. */
  editing: SavingSummary | null;
  onSaved: (pot: SavingSummary, isEdit: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Keyed by target: switching between "add" and a specific pot
            remounts the form, so its fields start from the right values
            without an effect syncing props into state. */}
        <SavingForm
          key={editing?.category_id ?? "new"}
          editing={editing}
          onSaved={onSaved}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function SavingForm({
  editing,
  onSaved,
  onClose,
}: {
  editing: SavingSummary | null;
  onSaved: (pot: SavingSummary, isEdit: boolean) => void;
  onClose: () => void;
}) {
  const supabase = createClient();

  const [name, setName] = useState(editing?.name ?? "");
  const { currency } = useCurrency();
  const [target, setTarget] = useState(
    editing?.target != null ? String(editing.target) : ""
  );
  const [description, setDescription] = useState(editing?.description ?? "");
  const [icon, setIcon] = useState(editing?.icon ?? "");
  const [color, setColor] = useState(editing?.color ?? "#0f9d76");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const label = name.trim();
    if (!label) {
      setError("Give the pot a name.");
      return;
    }

    // Blank is a real answer here — it means "no goal, just save".
    const raw = target.trim();
    let goal: number | null = null;
    if (raw) {
      const parsed = parseFloat(raw);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setError("Enter a target greater than 0, or leave it blank.");
        return;
      }
      goal = parsed;
    }

    const draft: SavingDraft = {
      name: label,
      target: goal,
      description: description.trim() || null,
      icon: icon || null,
      color,
    };

    setSaving(true);
    try {
      if (editing) {
        await updateSaving(supabase, editing.category_id, draft);
        onSaved({ ...editing, ...draft }, true);
      } else {
        onSaved(await createSaving(supabase, draft), false);
      }
      onClose();
    } catch (err) {
      const dbError = err as { code?: string; message?: string };
      setError(
        dbError.code === "23505"
          ? `A category named "${label}" already exists.`
          : (dbError.message ?? "Could not save the pot.")
      );
    } finally {
      setSaving(false);
    }
  }

  const parsed = parseFloat(target);
  const validTarget = Number.isFinite(parsed) && parsed > 0;
  const belowBalance = !!editing && validTarget && parsed < editing.balance;

  return (
    <>
      <DialogHeader>
        <DialogMedia>
          <PiggyBank />
        </DialogMedia>
        <DialogTitle>{editing ? "Edit pot" : "Add a savings pot"}</DialogTitle>
        <DialogDescription>
          {editing
            ? "Money already put aside stays put."
            : "It becomes a chip on the expenses tab."}
        </DialogDescription>
      </DialogHeader>

      <form id="saving-form" onSubmit={handleSubmit} className="contents">
        <DialogBody>
          <DialogSection>
            <DialogSectionHeader
              icon={<Target />}
              title="Target"
              hint="Optional — leave blank to just save"
              action={
                validTarget ? (
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">
                    {formatMoneyCompact(parsed)}
                  </span>
                ) : undefined
              }
            />
            <div className="relative mt-3">
              <MoneyPrefix symbol={currency.symbol} />
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                placeholder="No target"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                aria-label={`Savings target, in ${currency.name} (optional)`}
                autoFocus={!editing}
                style={{ paddingLeft: moneyInputPadding(currency.symbol) }}
                className="h-12 bg-background text-lg font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
                  placeholder="Emergency fund"
                  aria-label="Pot name"
                  autoFocus={!!editing}
                  className="min-w-0 flex-1 bg-background"
                />
                <IconPicker value={icon} onChange={setIcon} kind="saving" />
                <ColorPicker value={color} onChange={setColor} />
              </div>

              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
                aria-label="Pot description"
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
                  {icon || "🐷"} {name.trim() || "Pot name"}
                </span>
                <span className="shrink-0 tabular-nums opacity-80">
                  {editing ? formatMoneyCompact(editing.balance) : formatMoneyCompact(0)}
                </span>
              </span>
            </div>
          </DialogSection>

          {belowBalance && (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              You&apos;ve already put {formatMoney(editing.balance)} in this
              pot. A smaller target counts as reached straight away.
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
        <Button type="submit" form="saving-form" size="lg" disabled={saving}>
          {saving ? "Saving…" : editing ? "Save changes" : "Add pot"}
        </Button>
      </DialogFooter>
    </>
  );
}
