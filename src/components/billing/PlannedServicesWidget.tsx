'use client'

import * as React from 'react'
import { useEffect, useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, Trash2, AlertCircle, CheckCircle2, RotateCcw, Loader2 } from 'lucide-react'
import { useBillingMatcher, type BillingCatalogItem } from '@/hooks/useBillingMatcher'
import { useUser } from '@clerk/nextjs'
import { AppLink } from '@/components/navigation/AppLink'
import { scoreEM } from '@/lib/emScoring'

interface SimpleFact {
  id: string
  text: string
  group: string
}

interface BillingItem {
  _id: Id<'billingItems'>
  encounterId: Id<'encounters'>
  orgId: Id<'organizations'>
  catalogItemId?: Id<'billingCatalog'>
  description: string
  quantity: number
  unitPrice: number
  taxable: boolean
  phase: string
  recordingId?: Id<'recordings'>
  reconciliationStatus?: string
  linkedItemId?: Id<'billingItems'>
  extractedFromFact?: string
  manuallyAdded: boolean
  confidence?: string
  invoicedAt?: string
  createdAt: string
  updatedAt: string
}

interface PlannedServicesWidgetProps {
  encounterId: Id<'encounters'>
  recordingId?: Id<'recordings'>
  orgId?: Id<'organizations'>
  facts: SimpleFact[]
  onItemsChange?: () => void
}

export function PlannedServicesWidget({
  encounterId,
  recordingId,
  orgId,
  facts,
  onItemsChange,
}: PlannedServicesWidgetProps) {
  const { user } = useUser()
  const [processedFacts, setProcessedFacts] = useState<Set<string>>(new Set())
  const [voidConfirming, setVoidConfirming] = useState(false)

  // Queries
  const catalog = useQuery(
    api.billingCatalog.getByOrg,
    orgId ? { orgId } : 'skip'
  ) as BillingCatalogItem[] | undefined

  // All items for this encounter — filter client-side based on invoice status
  const allItems = useQuery(
    api.billingItems.getByConsultation,
    { encounterId }
  ) as BillingItem[] | undefined

  const invoiceMeta = useQuery(api.invoices.getInvoiceMetadata, { encounterId })

  const recordings = useQuery(
    api.recordings.getByConsultation,
    { encounterId }
  )

  const isExtracting = recordings?.some(
    r => r.billingExtractionStatus === 'processing'
  ) || false

  const isFinalized = invoiceMeta?.status === 'finalized'

  // Prospective items for pre-invoice display + auto-creation logic
  const prospectiveItems = allItems?.filter(i => i.phase === 'prospective')
  // Invoiced items for post-invoice display
  const billedItems = allItems?.filter(i => !!i.invoicedAt)

  const displayItems = isFinalized ? billedItems : prospectiveItems

  // Mutations
  const createProspective = useMutation(api.billingItems.createProspective)
  const removeItem = useMutation(api.billingItems.remove)
  const voidInvoice = useMutation(api.invoices.voidInvoice)

  // Fuzzy match billing facts to catalog
  const matches = useBillingMatcher(facts, catalog)

  // Auto-create items for high-confidence matches (only when no invoice yet)
  useEffect(() => {
    if (isFinalized) return
    if (!user?.id || !orgId || !catalog || matches.length === 0) return

    const highConfidenceMatches = matches.filter(
      (match) => match.confidence === 'high' && match.bestMatch
    )

    highConfidenceMatches.forEach(async (match) => {
      const factKey = `${match.fact.id}-${match.bestMatch!._id}`
      if (processedFacts.has(factKey)) return

      const existingItem = prospectiveItems?.find(
        (item) => item.extractedFromFact === match.fact.id
      )
      if (existingItem) {
        setProcessedFacts((prev) => new Set(prev).add(factKey))
        return
      }

      try {
        await createProspective({
          userId: user.id,
          encounterId,
          orgId,
          recordingId,
          catalogItemId: match.bestMatch!._id as Id<'billingCatalog'>,
          description: match.bestMatch!.name,
          quantity: 1,
          unitPrice: match.bestMatch!.basePrice,
          taxable: match.bestMatch!.taxable,
          extractedFromFact: match.fact.id,
          confidence: match.confidence,
        })
        setProcessedFacts((prev) => new Set(prev).add(factKey))
        onItemsChange?.()
      } catch (error) {
        console.error('Failed to create billing item:', error)
      }
    })
  }, [
    isFinalized,
    matches,
    user?.id,
    orgId,
    encounterId,
    recordingId,
    catalog,
    prospectiveItems,
    processedFacts,
    createProspective,
    onItemsChange,
  ])

  // Auto-create E&M visit complexity code from MDM scoring
  useEffect(() => {
    if (isFinalized) return
    if (!user?.id || !orgId || !catalog || facts.length === 0) return
    if (processedFacts.has('em-scoring')) return

    const existingEM = prospectiveItems?.find(
      (item) => item.extractedFromFact === 'em-scoring'
    )
    if (existingEM) {
      setProcessedFacts((prev) => new Set(prev).add('em-scoring'))
      return
    }

    const result = scoreEM(facts)
    const catalogItem = catalog.find(
      (item) => item.code === result.code
    )
    if (!catalogItem) return

    setProcessedFacts((prev) => new Set(prev).add('em-scoring'))
    createProspective({
      userId: user.id,
      encounterId,
      orgId,
      recordingId,
      catalogItemId: catalogItem._id as Id<'billingCatalog'>,
      description: catalogItem.name,
      quantity: 1,
      unitPrice: catalogItem.basePrice,
      taxable: catalogItem.taxable,
      extractedFromFact: 'em-scoring',
      confidence: 'high',
    }).then(() => onItemsChange?.()).catch(console.error)
  }, [
    isFinalized,
    facts,
    catalog,
    prospectiveItems,
    processedFacts,
    user?.id,
    orgId,
    encounterId,
    recordingId,
    createProspective,
    onItemsChange,
  ])

  const total = React.useMemo(() => {
    if (!displayItems) return 0
    return displayItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) / 100
  }, [displayItems])

  const handleDelete = async (itemId: Id<'billingItems'>) => {
    if (!user?.id) return
    try {
      await removeItem({ userId: user.id, id: itemId })
      onItemsChange?.()
    } catch (error) {
      console.error('Failed to delete billing item:', error)
    }
  }

  const handleVoid = async () => {
    try {
      await voidInvoice({ encounterId })
      setVoidConfirming(false)
    } catch (error) {
      console.error('Failed to void invoice:', error)
    }
  }

  // Empty catalog
  if (!catalog || catalog.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Planned Services
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Set up your billing catalog first</p>
            {orgId && (
              <AppLink href="/billing?tab=catalog">
                <Button variant="link" size="sm" className="mt-2">
                  Go to Billing Catalog
                </Button>
              </AppLink>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // ── Billed state (invoice finalized) ──────────────────────────────────────
  if (isFinalized) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Billed Services
              {billedItems && <Badge variant="secondary">{billedItems.length}</Badge>}
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                ${total.toFixed(2)}
              </div>
              {voidConfirming ? (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">Void invoice?</span>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={handleVoid}
                  >
                    Yes, void
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setVoidConfirming(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setVoidConfirming(true)}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Redo
                </Button>
              )}
            </div>
          </div>
          {invoiceMeta?.invoiceNumber && (
            <p className="text-xs text-muted-foreground mt-1">
              {invoiceMeta.invoiceNumber}
            </p>
          )}
        </CardHeader>
        <CardContent>
          {!billedItems || billedItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No items on invoice</p>
          ) : (
            <div className="space-y-2">
              {billedItems.map((item) => (
                <BillingItemRow
                  key={item._id}
                  item={item}
                  readonly
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // ── Planned state (pre-invoice) ────────────────────────────────────────────

  if (!prospectiveItems || prospectiveItems.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Planned Services
          </CardTitle>
          {isExtracting && (
            <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              Analyzing encounter for billable items…
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-sm">
              {isExtracting ? 'Extracting services from encounter...' : 'No billable items found'}
            </p>
            <p className="text-xs mt-1">
              {isExtracting
                ? 'Items are automatically detected from clinical facts'
                : 'Items are extracted automatically after each recording'}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Planned Services
            <Badge variant="secondary">{prospectiveItems.length}</Badge>
          </CardTitle>
          <div className="text-sm font-semibold text-green-600 dark:text-green-400">
            Est. ${total.toFixed(2)}
          </div>
        </div>
        {isExtracting && (
          <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            Analyzing encounter for additional billable items…
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {prospectiveItems.map((item) => (
            <BillingItemRow
              key={item._id}
              item={item}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

interface BillingItemRowProps {
  item: BillingItem
  onDelete?: (id: Id<'billingItems'>) => void
  readonly?: boolean
}

function BillingItemRow({ item, onDelete, readonly }: BillingItemRowProps) {
  const [isHovered, setIsHovered] = useState(false)
  const itemTotal = (item.unitPrice * item.quantity) / 100

  return (
    <div
      className="flex items-start justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-medium truncate">{item.description}</p>
          {item.confidence && (
            <Badge
              variant={
                item.confidence === 'high'
                  ? 'default'
                  : item.confidence === 'medium'
                  ? 'secondary'
                  : 'outline'
              }
              className="text-xs"
            >
              {item.confidence}
            </Badge>
          )}
          {item.manuallyAdded && (
            <Badge variant="outline" className="text-xs">
              Manual
            </Badge>
          )}
          {item.phase === 'retrospective' && (
            <Badge variant="outline" className="text-xs">
              Added
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>Qty: {item.quantity}</span>
          <span>${(item.unitPrice / 100).toFixed(2)} ea</span>
          {item.taxable && (
            <Badge variant="outline" className="text-xs">
              Taxable
            </Badge>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 ml-4">
        <div className="text-sm font-semibold text-right min-w-[60px]">
          ${itemTotal.toFixed(2)}
        </div>
        {!readonly && isHovered && onDelete && (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onDelete(item._id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
