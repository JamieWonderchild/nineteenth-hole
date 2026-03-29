"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useQuery, useMutation } from "convex/react"
import { api } from 'convex/_generated/api'
import { useAuth } from "@clerk/nextjs"
import { toast } from "@/hooks/use-toast"
import type { Id } from 'convex/_generated/dataModel'
import {
  DollarSign,
  CheckCircle,
  AlertCircle,
  MinusCircle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Plus,
  Loader2,
} from "lucide-react"

interface BillingReconciliationPanelProps {
  encounterId: Id<"encounters">
  orgId: Id<"organizations">
}

const statusConfig = {
  matched: {
    icon: CheckCircle,
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    label: "Matched Services",
  },
  missed: {
    icon: AlertCircle,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    label: "Missed Charges",
  },
  overPlanned: {
    icon: MinusCircle,
    color: "text-gray-500",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-200",
    label: "Not Performed",
  },
}

export function BillingReconciliationPanel({
  encounterId,
  orgId,
}: BillingReconciliationPanelProps) {
  const { userId } = useAuth()
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["missed"]) // Default to showing missed charges
  )
  const [isReconciling, setIsReconciling] = useState(false)

  // Fetch reconciliation summary
  const summary = useQuery(api.billingReconciliation.getSummary, {
    encounterId,
  })

  // Mutations
  const reconcile = useMutation(api.billingReconciliation.reconcile)
  const addMissedItemToBill = useMutation(api.billingReconciliation.addMissedItemToBill)

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }

  const handleReReconcile = async () => {
    if (!userId) return

    setIsReconciling(true)
    try {
      const result = await reconcile({
        userId,
        encounterId,
        orgId,
      })

      toast({
        title: "Reconciliation complete",
        description: `Matched: ${result.totalMatched}, Missed: ${result.totalMissed}, Not performed: ${result.totalOverPlanned}`,
      })
    } catch (error) {
      console.error("Reconciliation error:", error)
      toast({
        title: "Reconciliation failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      })
    } finally {
      setIsReconciling(false)
    }
  }

  const handleAddToBill = async (retrospectiveItemId: Id<"billingItems">) => {
    if (!userId) return

    try {
      await addMissedItemToBill({
        userId,
        retrospectiveItemId,
        orgId,
      })

      toast({
        title: "Item added to bill",
        description: "The missed charge has been added to prospective billing",
      })
    } catch (error) {
      console.error("Add to bill error:", error)
      toast({
        title: "Failed to add item",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      })
    }
  }

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`
  }

  // Check if we have any retrospective items
  const hasRetrospective =
    summary && (summary.totalMatched > 0 || summary.totalMissed > 0)

  if (!hasRetrospective) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <DollarSign className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">
            No billing dictation recorded yet
          </p>
          <p className="text-xs text-muted-foreground">
            Record a billing dictation to compare planned vs. performed services
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Billing Reconciliation</h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReReconcile}
            disabled={isReconciling}
          >
            {isReconciling ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Reconciling...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Re-reconcile
              </>
            )}
          </Button>
        </div>

        {/* Savings Banner */}
        {summary && summary.savedAmount > 0 && (
          <div className="mb-6 p-4 rounded-lg border-2 border-amber-400 bg-amber-50">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="text-2xl font-bold text-amber-900">
                  Recovered {formatPrice(summary.savedAmount)}
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  {summary.totalMissed} item{summary.totalMissed !== 1 ? "s" : ""}{" "}
                  almost missed
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Reconciliation Sections */}
        <div className="space-y-4">
          {/* Matched Services */}
          {summary && summary.totalMatched > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection("matched")}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors border-l-4 border-l-green-500"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium">
                    {statusConfig.matched.label}
                  </span>
                  <Badge variant="outline">{summary.totalMatched}</Badge>
                </div>
                {expandedSections.has("matched") ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </button>

              {expandedSections.has("matched") && (
                <div className="border-t bg-muted/20">
                  <div className="divide-y">
                    {summary.matched.map((item, idx) => (
                      <div
                        key={`matched-${idx}`}
                        className="p-4 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium">{item.description}</p>
                            <p className="text-sm text-muted-foreground">
                              Qty: {item.quantity} × {formatPrice(item.unitPrice)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">
                              {formatPrice(item.unitPrice * item.quantity)}
                            </p>
                            <Badge variant="outline" className="mt-1">
                              {item.matchType === "exact" ? "Exact match" : "Fuzzy match"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Missed Charges */}
          {summary && summary.totalMissed > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection("missed")}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors border-l-4 border-l-amber-500"
              >
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  <span className="font-medium">
                    {statusConfig.missed.label}
                  </span>
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                    {summary.totalMissed}
                  </Badge>
                </div>
                {expandedSections.has("missed") ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </button>

              {expandedSections.has("missed") && (
                <div className="border-t bg-amber-50/50">
                  <div className="divide-y">
                    {summary.missed.map((item, idx) => (
                      <div
                        key={`missed-${idx}`}
                        className="p-4 hover:bg-amber-50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <p className="font-medium">{item.description}</p>
                            <p className="text-sm text-muted-foreground">
                              Qty: {item.quantity} × {formatPrice(item.unitPrice)}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <p className="font-semibold text-amber-900">
                              {formatPrice(item.totalPrice)}
                            </p>
                            <Button
                              size="sm"
                              onClick={() => handleAddToBill(item.retrospectiveId)}
                              className="gap-2"
                            >
                              <Plus className="h-4 w-4" />
                              Add to Bill
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Not Performed */}
          {summary && summary.totalOverPlanned > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection("overPlanned")}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors border-l-4 border-l-gray-300"
              >
                <div className="flex items-center gap-3">
                  <MinusCircle className="h-5 w-5 text-gray-500" />
                  <span className="font-medium">
                    {statusConfig.overPlanned.label}
                  </span>
                  <Badge variant="outline">{summary.totalOverPlanned}</Badge>
                </div>
                {expandedSections.has("overPlanned") ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </button>

              {expandedSections.has("overPlanned") && (
                <div className="border-t bg-muted/20">
                  <div className="divide-y">
                    {summary.overPlanned.map((item, idx) => (
                      <div
                        key={`overPlanned-${idx}`}
                        className="p-4 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-muted-foreground">
                              {item.description}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Qty: {item.quantity} × {formatPrice(item.unitPrice)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-muted-foreground">
                              {formatPrice(item.unitPrice * item.quantity)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Not performed
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Summary Footer */}
        {summary && (
          <div className="mt-6 pt-4 border-t">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="gap-1">
                  <CheckCircle className="h-3 w-3 text-green-600" />
                  {summary.totalMatched} matched
                </Badge>
                {summary.totalMissed > 0 && (
                  <Badge variant="outline" className="gap-1 bg-amber-50 text-amber-700 border-amber-300">
                    <AlertCircle className="h-3 w-3" />
                    {summary.totalMissed} missed
                  </Badge>
                )}
                {summary.totalOverPlanned > 0 && (
                  <Badge variant="outline" className="gap-1">
                    <MinusCircle className="h-3 w-3 text-gray-500" />
                    {summary.totalOverPlanned} not performed
                  </Badge>
                )}
              </div>
              {summary.savedAmount > 0 && (
                <p className="font-semibold text-amber-900">
                  Total recovered: {formatPrice(summary.savedAmount)}
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
