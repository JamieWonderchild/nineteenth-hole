'use client';

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from 'convex/_generated/api';
import { BillingCatalogDialog } from "@/components/billing/BillingCatalogDialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Plus,
  Edit,
  Archive,
  Package,
  Info,
  Settings,
} from "lucide-react";
import type { Id } from 'convex/_generated/dataModel';
import type { OrgContext } from '@/types/billing';
import { TaxSummaryBadge } from "@/components/billing/TaxSummaryBadge";
import { AppLink } from "@/components/navigation/AppLink";

type CatalogItem = {
  _id: Id<"billingCatalog">;
  name: string;
  code: string;
  category: string;
  basePrice: number;
  taxable: boolean;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

// Category colors
const CATEGORY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  exam: { bg: "bg-blue-500/10", text: "text-blue-500", label: "Exam" },
  procedure: { bg: "bg-purple-500/10", text: "text-purple-500", label: "Procedure" },
  lab: { bg: "bg-green-500/10", text: "text-green-500", label: "Lab" },
  medication: { bg: "bg-red-500/10", text: "text-red-500", label: "Medication" },
  supply: { bg: "bg-yellow-500/10", text: "text-yellow-500", label: "Supply" },
  imaging: { bg: "bg-cyan-500/10", text: "text-cyan-500", label: "Imaging" },
  hospitalization: { bg: "bg-orange-500/10", text: "text-orange-500", label: "Hospitalization" },
  other: { bg: "bg-gray-500/10", text: "text-gray-500", label: "Other" },
};

interface CatalogTabProps {
  orgContext: OrgContext | null;
  canManageTeam: boolean;
}

export function CatalogTab({ orgContext, canManageTeam }: CatalogTabProps) {
  const { user } = useUser();
  const orgId = orgContext?.orgId;

  const [showDialog, setShowDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  // Queries
  const catalogItems = useQuery(
    api.billingCatalog.getByOrg,
    orgId ? { orgId: orgId as unknown as Id<"organizations"> } : "skip"
  ) as CatalogItem[] | undefined;

  const organization = useQuery(
    api.organizations.getById,
    orgId ? { id: orgId as unknown as Id<"organizations"> } : "skip"
  );

  // Mutations
  const archiveItem = useMutation(api.billingCatalog.archive);

  // Group items by category
  const groupedItems = useMemo(() => {
    if (!catalogItems) return new Map<string, CatalogItem[]>();

    const groups = new Map<string, CatalogItem[]>();
    for (const item of catalogItems) {
      const existing = groups.get(item.category) || [];
      existing.push(item);
      groups.set(item.category, existing);
    }

    // Sort categories by number of items (descending)
    return new Map(
      Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length)
    );
  }, [catalogItems]);

  const handleArchive = async (itemId: Id<"billingCatalog">) => {
    if (!user) return;
    if (!confirm("Are you sure you want to archive this item?")) return;

    try {
      await archiveItem({ userId: user.id, id: itemId });
    } catch (err: any) {
      console.error("Error archiving item:", err);
      alert(err.message || "Failed to archive item");
    }
  };

  const handleEdit = (item: CatalogItem) => {
    setEditingItem(item);
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingItem(null);
  };

  return (
    <div className="space-y-6">
      {/* Catalog Items Header */}
      <div className="flex items-center justify-between pb-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Package className="h-5 w-5" />
            Catalog Items
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your services, procedures, and pricing
          </p>
        </div>
        {canManageTeam && (
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        )}
      </div>

      {/* Tax Configuration Info */}
      {organization && (
        <div className="mb-4 p-3 rounded-lg bg-muted/50 border border-border">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <Info className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Tax configuration:</span>
                <TaxSummaryBadge taxSettings={organization.taxSettings} />
              </div>
            </div>
            {canManageTeam && (
              <AppLink href="/settings/billing-preferences">
                <Button variant="ghost" size="sm">
                  <Settings className="h-3.5 w-3.5 mr-1.5" />
                  Configure
                </Button>
              </AppLink>
            )}
          </div>
        </div>
      )}

      {/* Catalog Items */}
      {catalogItems && catalogItems.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <EmptyState
            icon={Package}
            title="No catalog items yet"
            description="Create your first billable item to get started"
            features={[
              "Add services, procedures, and medications",
              "Set custom pricing and tax rules",
              "Organize items by category",
            ]}
            action={
              canManageTeam
                ? {
                    label: "Create First Item",
                    onClick: () => setShowDialog(true),
                  }
                : undefined
            }
          />
        </div>
      ) : (
        <Tabs value={activeCategory} onValueChange={setActiveCategory}>
          <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
            <TabsTrigger value="all">
              All ({catalogItems?.length || 0})
            </TabsTrigger>
            {Array.from(groupedItems.entries()).map(([category, items]) => {
              const categoryInfo = CATEGORY_COLORS[category] || CATEGORY_COLORS.other;
              return (
                <TabsTrigger key={category} value={category}>
                  <span className={`inline-flex items-center gap-1.5`}>
                    {categoryInfo.label} ({items.length})
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* All Items Tab */}
          <TabsContent value="all" className="mt-4">
            <div className="space-y-6">
              {Array.from(groupedItems.entries()).map(([category, items]) => {
                const categoryInfo = CATEGORY_COLORS[category] || CATEGORY_COLORS.other;
                return (
                  <div key={category}>
                    {/* Category Header */}
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${categoryInfo.bg} ${categoryInfo.text}`}
                      >
                        {categoryInfo.label}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {items.length} {items.length === 1 ? "item" : "items"}
                      </span>
                    </div>

                    {/* Items Grid */}
                    <div className="grid gap-3">
                      {items.map((item) => (
                        <div
                          key={item._id}
                          className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 hover:bg-accent/50 transition-colors group"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <h3 className="font-medium">{item.name}</h3>
                                <code className="px-2 py-0.5 rounded bg-muted text-xs font-mono text-muted-foreground">
                                  {item.code}
                                </code>
                                {item.taxable && (
                                  <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-500 text-xs">
                                    Taxable
                                  </span>
                                )}
                              </div>
                              {item.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {item.description}
                                </p>
                              )}
                              <p className="text-lg font-semibold mt-2">
                                ${(item.basePrice / 100).toFixed(2)}
                              </p>
                            </div>

                            {/* Actions */}
                            {canManageTeam && (
                              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handleEdit(item)}
                                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                                  title="Edit"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleArchive(item._id)}
                                  className="p-2 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors"
                                  title="Archive"
                                >
                                  <Archive className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* Individual Category Tabs */}
          {Array.from(groupedItems.entries()).map(([category, items]) => (
            <TabsContent key={category} value={category} className="mt-4">
              <div className="grid gap-3">
                {items.map((item) => (
                  <div
                    key={item._id}
                    className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 hover:bg-accent/50 transition-colors group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-medium">{item.name}</h3>
                          <code className="px-2 py-0.5 rounded bg-muted text-xs font-mono text-muted-foreground">
                            {item.code}
                          </code>
                          {item.taxable && (
                            <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-500 text-xs">
                              Taxable
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {item.description}
                          </p>
                        )}
                        <p className="text-lg font-semibold mt-2">
                          ${(item.basePrice / 100).toFixed(2)}
                        </p>
                      </div>

                      {/* Actions */}
                      {canManageTeam && (
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEdit(item)}
                            className="p-2 rounded-lg hover:bg-muted transition-colors"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleArchive(item._id)}
                            className="p-2 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors"
                            title="Archive"
                          >
                            <Archive className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}

      {!canManageTeam && catalogItems && catalogItems.length > 0 && (
        <div className="bg-muted/50 rounded-lg p-4 mt-4">
          <p className="text-sm text-muted-foreground">
            Contact your administrator to add, edit, or archive catalog items.
          </p>
        </div>
      )}

      {/* Dialog */}
      {showDialog && orgId && user && (
        <BillingCatalogDialog
          orgId={orgId as unknown as Id<"organizations">}
          userId={user.id}
          item={editingItem}
          onClose={handleCloseDialog}
          onSuccess={handleCloseDialog}
        />
      )}
    </div>
  );
}
