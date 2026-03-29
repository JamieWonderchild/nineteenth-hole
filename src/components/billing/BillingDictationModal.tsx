"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { CortiConsultation } from "@/components/encounter/CortiConsultation"
import { useMutation, useQuery } from "convex/react"
import { api } from 'convex/_generated/api'
import { useAuth } from "@clerk/nextjs"
import { useOrgContext } from "@/hooks/useOrgContext"
import { toast } from "@/hooks/use-toast"
import type { EncounterSession } from "@/types/corti"
import type { Id } from 'convex/_generated/dataModel'
import Fuse from "fuse.js"

interface SimpleFact {
  id: string
  text: string
  group: string
}

interface BillingCatalogItem {
  _id: string
  name: string
  code: string
  category: string
  basePrice: number
  taxable: boolean
  description?: string
}

interface BillingMatch {
  fact: SimpleFact
  bestMatch: BillingCatalogItem | null
  confidence: "high" | "medium" | "low"
  score: number
}

/**
 * Match billing facts to catalog items using Fuse.js
 */
function matchBillingFactsToCatalog(
  facts: SimpleFact[],
  catalog: BillingCatalogItem[]
): BillingMatch[] {
  if (facts.length === 0 || catalog.length === 0) {
    return []
  }

  const fuse = new Fuse(catalog, {
    keys: [
      { name: "name", weight: 0.5 },
      { name: "description", weight: 0.3 },
      { name: "code", weight: 0.2 },
    ],
    threshold: 0.6,
    includeScore: true,
    ignoreLocation: true,
    minMatchCharLength: 3,
  })

  return facts.map((fact) => {
    const results = fuse.search(fact.text)
    const topResult = results[0]

    const score = topResult?.score ?? 1
    let confidence: "high" | "medium" | "low" = "low"
    if (score < 0.3) confidence = "high"
    else if (score < 0.5) confidence = "medium"

    return {
      fact,
      bestMatch: topResult?.item || null,
      confidence,
      score,
    }
  })
}

interface BillingDictationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  encounterId: Id<"encounters">
  orgId?: Id<"organizations">
  onComplete?: () => void
}

export function BillingDictationModal({
  open,
  onOpenChange,
  encounterId,
  orgId,
  onComplete,
}: BillingDictationModalProps) {
  const { userId } = useAuth()
  const { orgContext } = useOrgContext()
  const createRetrospective = useMutation(api.billingItems.createRetrospective)
  const reconcile = useMutation(api.billingReconciliation.reconcile)
  const [isProcessing, setIsProcessing] = React.useState(false)

  // Fetch billing catalog for matching
  const effectiveOrgId = orgId || orgContext?.orgId
  const catalog = useQuery(
    api.billingCatalog.getByOrg,
    effectiveOrgId ? { orgId: effectiveOrgId as Id<"organizations"> } : "skip"
  )

  const handleSessionComplete = async (session: EncounterSession) => {
    if (!userId || !effectiveOrgId) {
      toast({
        title: "Authentication error",
        description: "Please sign in to save billing dictation",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)

    try {
      // Extract billing facts from the session
      const billingFacts = session.facts.filter((fact) =>
        fact.group?.startsWith("billing-")
      )

      if (billingFacts.length === 0) {
        toast({
          title: "No billing items detected",
          description: "Try describing the services performed more clearly",
          variant: "destructive",
        })
        setIsProcessing(false)
        return
      }

      // Match facts to catalog items using Fuse.js (inline matching, not hook)
      const matches = matchBillingFactsToCatalog(
        billingFacts.map(f => ({ id: f.id, text: f.text, group: f.group })),
        catalog || []
      )

      // Create retrospective billing items for each match
      const createdItems: Id<"billingItems">[] = []

      for (const match of matches) {
        try {
          const itemId = await createRetrospective({
            userId,
            encounterId,
            orgId: effectiveOrgId as Id<"organizations">,
            catalogItemId: match.bestMatch?._id as Id<"billingCatalog"> | undefined,
            description: match.bestMatch?.name || match.fact.text,
            quantity: 1, // Default to 1, provider can edit later
            unitPrice: match.bestMatch?.basePrice || 0,
            taxable: match.bestMatch?.taxable || false,
            extractedFromFact: match.fact.id,
            confidence: match.confidence,
          })
          createdItems.push(itemId)
        } catch (error) {
          console.error("Error creating retrospective item:", error)
          // Continue processing other items
        }
      }

      // Trigger reconciliation
      if (createdItems.length > 0) {
        try {
          const result = await reconcile({
            userId,
            encounterId,
            orgId: effectiveOrgId as Id<"organizations">,
          })

          toast({
            title: "Billing dictation complete",
            description: `Created ${createdItems.length} retrospective items. ${result.totalMissed > 0 ? `Found ${result.totalMissed} missed charges!` : ""}`,
          })
        } catch (error) {
          console.error("Error reconciling billing items:", error)
          toast({
            title: "Items created",
            description: `Created ${createdItems.length} retrospective items (reconciliation will run later)`,
          })
        }
      }

      // Close modal and notify parent
      onOpenChange(false)
      onComplete?.()
    } catch (error) {
      console.error("Error processing billing dictation:", error)
      toast({
        title: "Error processing dictation",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Billing Dictation</DialogTitle>
          <DialogDescription>
            Record what services you actually performed during this encounter.
            The system will compare this to your planned services to identify any missed charges.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {isProcessing ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                <p className="text-sm text-muted-foreground">Processing billing items...</p>
              </div>
            </div>
          ) : (
            <CortiConsultation
              onSessionComplete={handleSessionComplete}
              encounterId={encounterId}
              consultationType="sick-visit"
              isMobile={false}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
