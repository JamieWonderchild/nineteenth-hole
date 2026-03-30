"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from 'convex/_generated/api';
import { Button } from "@/components/ui/button";
import { X, AlertCircle } from "lucide-react";
import type { Id } from 'convex/_generated/dataModel';

type CatalogItem = {
  _id: Id<"billingCatalog">;
  name: string;
  code: string;
  category: string;
  basePrice: number;
  taxable: boolean;
  description?: string;
};

interface BillingCatalogDialogProps {
  orgId: Id<"organizations">;
  userId: string;
  item?: CatalogItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

const CATEGORIES = [
  { value: "em", label: "E&M (Evaluation & Management)" },
  { value: "exam", label: "Exam" },
  { value: "procedure", label: "Procedure" },
  { value: "critical-care", label: "Critical Care" },
  { value: "observation", label: "Observation" },
  { value: "lab", label: "Lab" },
  { value: "medication", label: "Medication" },
  { value: "supply", label: "Supply" },
  { value: "imaging", label: "Imaging" },
  { value: "hospitalization", label: "Hospitalization" },
  { value: "other", label: "Other" },
];

export function BillingCatalogDialog({
  orgId,
  userId,
  item,
  onClose,
  onSuccess,
}: BillingCatalogDialogProps) {
  const isEdit = !!item;

  const [name, setName] = useState(item?.name || "");
  const [code, setCode] = useState(item?.code || "");
  const [category, setCategory] = useState(item?.category || "exam");
  const [price, setPrice] = useState(
    item ? (item.basePrice / 100).toFixed(2) : ""
  );
  const [taxable, setTaxable] = useState(item?.taxable ?? true);
  const [description, setDescription] = useState(item?.description || "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDuplicateCode, setIsDuplicateCode] = useState(false);

  const createItem = useMutation(api.billingCatalog.create);
  const updateItem = useMutation(api.billingCatalog.update);

  // Fetch all catalog items to check for duplicate codes
  const catalogItems = useQuery(
    api.billingCatalog.getByOrg,
    { orgId }
  );

  // Check for duplicate code as user types
  useEffect(() => {
    if (!code.trim() || !catalogItems) {
      setIsDuplicateCode(false);
      return;
    }

    const uppercaseCode = code.trim().toUpperCase();
    const duplicate = catalogItems.find(
      (catalogItem) =>
        catalogItem.code === uppercaseCode &&
        (!isEdit || catalogItem._id !== item?._id) // Exclude current item when editing
    );

    setIsDuplicateCode(!!duplicate);
  }, [code, catalogItems, isEdit, item?._id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Validate
      if (!name.trim()) {
        throw new Error("Name is required");
      }
      if (!code.trim()) {
        throw new Error("Code is required");
      }
      if (isDuplicateCode) {
        throw new Error("This code is already in use");
      }
      if (!price || parseFloat(price) < 0) {
        throw new Error("Price must be greater than or equal to 0");
      }

      // Convert price to cents
      const basePrice = Math.round(parseFloat(price) * 100);

      if (isEdit && item) {
        await updateItem({
          userId,
          id: item._id,
          name: name.trim(),
          code: code.trim().toUpperCase(),
          category,
          basePrice,
          taxable,
          description: description.trim() || undefined,
        });
      } else {
        await createItem({
          userId,
          orgId,
          name: name.trim(),
          code: code.trim().toUpperCase(),
          category,
          basePrice,
          taxable,
          description: description.trim() || undefined,
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Error saving catalog item:", err);
      setError(err.message || "Failed to save item");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">
            {isEdit ? "Edit Catalog Item" : "Add Catalog Item"}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="e.g., Comprehensive Exam, CBC Panel"
              required
            />
          </div>

          {/* Code */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className={`w-full px-3 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 font-mono ${
                isDuplicateCode
                  ? "border-red-500 focus:ring-red-500/50"
                  : "border-border focus:ring-primary/50"
              }`}
              placeholder="e.g., EXAM-001, LAB-CBC"
              required
            />
            {isDuplicateCode && (
              <div className="flex items-center gap-2 mt-2 text-sm text-red-500">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>
                  This code is already in use. Please choose a different code.
                </span>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1.5">
              Unique identifier for this service (automatically uppercased)
            </p>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              required
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Price <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full pl-7 pr-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          {/* Taxable */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="taxable"
              checked={taxable}
              onChange={(e) => setTaxable(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <label htmlFor="taxable" className="text-sm font-medium">
              Taxable item
            </label>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              placeholder="Additional details about this item..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isDuplicateCode}
              className="flex-1"
            >
              {isSubmitting
                ? "Saving..."
                : isEdit
                ? "Update Item"
                : "Create Item"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
