"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Category, CategoryKind } from "@/lib/types";
import { useHash } from "@/lib/use-hash";
import { ColorPicker } from "@/components/color-picker";
import { IconPicker } from "@/components/icon-picker";
import { ListSkeleton } from "@/components/skeletons";
import { LoansPanel } from "@/components/loans/loans-panel";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/** Tab state lives in the URL hash; "expense" is the bare-URL default. */
const KIND_TO_HASH: Record<CategoryKind, string> = {
  expense: "",
  income: "income",
  loan: "loans",
};

const HASH_TO_KIND: Record<string, CategoryKind> = {
  income: "income",
  loans: "loan",
};

/** The non-deletable fallback category each kind reassigns orphans to. */
const FALLBACK_NAME: Record<CategoryKind, string> = {
  expense: "Other",
  income: "Other Income",
  // A loan's payments are expenses, so they fall back to the expense side.
  loan: "Other",
};

export default function CategoriesPage() {
  const supabase = createClient();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Which side we're managing lives in the URL hash, so the tab is
  // deep-linkable and survives a back-navigation. A hash rather than a search
  // param keeps this page free of a Suspense boundary.
  const hash = useHash();
  const kind = HASH_TO_KIND[hash] ?? "expense";

  // Add form
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#2a78d6");
  const [newIcon, setNewIcon] = useState("");

  // Inline edit
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#2a78d6");
  const [editIcon, setEditIcon] = useState("");

  // Pending delete (drives the confirm dialog)
  const [deleting, setDeleting] = useState<Category | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const { data } = await supabase
        .from("categories")
        .select("*")
        .order("name");
      if (ignore) return;
      if (data) setCategories(data);
      setLoading(false);
    })();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const name = newName.trim();
    if (!name) return;

    const { data, error: dbError } = await supabase
      .from("categories")
      .insert({ name, color: newColor, icon: newIcon || null, kind })
      .select()
      .single();

    if (dbError) {
      setError(
        dbError.code === "23505"
          ? `A category named "${name}" already exists.`
          : dbError.message
      );
      return;
    }
    setCategories((prev) =>
      [...prev, data].sort((a, b) => a.name.localeCompare(b.name))
    );
    setNewName("");
    setNewIcon("");
  }

  async function handleSaveEdit(cat: Category) {
    setError(null);
    const name = editName.trim();
    if (!name) return;

    const icon = editIcon || null;
    const { error: dbError } = await supabase
      .from("categories")
      .update({ name, color: editColor, icon })
      .eq("id", cat.id);

    if (dbError) {
      setError(dbError.message);
      return;
    }
    setCategories((prev) =>
      prev
        .map((c) =>
          c.id === cat.id ? { ...c, name, color: editColor, icon } : c
        )
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    setEditId(null);
  }

  async function confirmDelete() {
    if (!deleting) return;
    const cat = deleting;
    setDeleting(null);
    setError(null);

    const fallbackName = FALLBACK_NAME[cat.kind];
    const other = categories.find(
      (c) => c.kind === cat.kind && c.name === fallbackName && c.id !== cat.id
    );
    if (!other) {
      setError(
        `Cannot delete: no "${fallbackName}" category to reassign to.`
      );
      return;
    }

    // PRD CAT-4: reassign entries to the fallback before deleting — never orphan.
    const table = cat.kind === "income" ? "incomes" : "expenses";
    const { error: moveError } = await supabase
      .from(table)
      .update({ category_id: other.id })
      .eq("category_id", cat.id);
    if (moveError) {
      setError(moveError.message);
      return;
    }

    const { error: delError } = await supabase
      .from("categories")
      .delete()
      .eq("id", cat.id);
    if (delError) {
      setError(delError.message);
      return;
    }
    setCategories((prev) => prev.filter((c) => c.id !== cat.id));
  }

  const shown = categories.filter((c) => c.kind === kind);
  // Loan payments are expenses, so a deleted loan reassigns them here.
  const fallbackExpenseId =
    categories.find((c) => c.kind === "expense" && c.name === "Other")?.id ??
    null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Categories</h1>
        <Tabs
          value={kind}
          onValueChange={(v) => {
            setError(null);
            setEditId(null);
            // Assigning the hash fires `hashchange`, which re-renders us.
            window.location.hash = KIND_TO_HASH[v as CategoryKind];
          }}
        >
          <TabsList data-tour="category-kind">
            <TabsTrigger value="expense">Expense</TabsTrigger>
            <TabsTrigger value="income">Income</TabsTrigger>
            <TabsTrigger value="loan">Loans</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {kind === "loan" ? (
        <LoansPanel fallbackCategoryId={fallbackExpenseId} />
      ) : (
        <>
      <Card data-tour="category-form">
        <CardContent>
          <form onSubmit={handleAdd} className="flex flex-wrap items-center gap-2">
            <Input
              type="text"
              placeholder={
                kind === "income" ? "New income source" : "New category name"
              }
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="min-w-0 flex-1"
            />
            <IconPicker value={newIcon} onChange={setNewIcon} kind={kind} />
            <ColorPicker value={newColor} onChange={setNewColor} />
            <Button type="submit">Add</Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <ListSkeleton rows={6} />
      ) : (
        <Card className="py-0" data-tour="category-list">
          <ul className="divide-y">
            {shown.map((cat) => (
              <li
                key={cat.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3"
              >
                {editId === cat.id ? (
                  <>
                    <IconPicker
                      value={editIcon}
                      onChange={setEditIcon}
                      kind={cat.kind}
                    />
                    <ColorPicker value={editColor} onChange={setEditColor} />
                    <Input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSaveEdit(cat);
                        }
                        if (e.key === "Escape") setEditId(null);
                      }}
                      className="h-8 min-w-0 flex-1"
                    />
                    <Button size="sm" onClick={() => handleSaveEdit(cat)}>
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditId(null)}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base"
                      style={{ backgroundColor: `${cat.color}22` }}
                    >
                      {cat.icon ?? "🏷️"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {cat.name}
                    </span>
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: cat.color }}
                      aria-hidden
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setEditId(cat.id);
                        setEditName(cat.name);
                        setEditColor(cat.color);
                        setEditIcon(cat.icon ?? "");
                      }}
                      aria-label={`Edit ${cat.name}`}
                      className="text-muted-foreground"
                    >
                      <Pencil />
                    </Button>
                    {cat.name !== FALLBACK_NAME[cat.kind] && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleting(cat)}
                        aria-label={`Delete ${cat.name}`}
                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

        </>
      )}

      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &quot;{deleting?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Its entries will be moved to the &quot;
              {deleting ? FALLBACK_NAME[deleting.kind] : "Other"}&quot;
              category. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
