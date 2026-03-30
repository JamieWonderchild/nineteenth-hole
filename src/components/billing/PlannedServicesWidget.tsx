'use client'

import * as React from 'react'
import { useEffect, useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { Input } from '@/components/ui/input'
import { DollarSign, Trash2, AlertCircle, CheckCircle2, RotateCcw, Loader2, Plus, X } from 'lucide-react'
import { useBillingMatcher, type BillingCatalogItem } from '@/hooks/useBillingMatcher'
import { useUser } from '@clerk/nextjs'
import { AppLink } from '@/components/navigation/AppLink'
import { scoreEM, type EncounterType } from '@/lib/emScoring'
import { generateCode } from '@/components/billing/ManualServiceForm'

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
  encounterType?: EncounterType
  onItemsChange?: () => void
}

export function PlannedServicesWidget({
  encounterId,
  recordingId,
  orgId,
  facts,
  encounterType = 'outpatient',
  onItemsChange,
}: PlannedServicesWidgetProps) {
  const { user } = useUser()
  const [processedFacts, setProcessedFacts] = useState<Set<string>>(new Set())
  const [voidConfirming, setVoidConfirming] = useState(false)
  const [showAddService, setShowAddService] = useState(false)
  const [addName, setAddName] = useState('')
  const [addPrice, setAddPrice] = useState('')
  const [addSubmitting, setAddSubmitting] = useState(false)

  const createCatalogItem = useMutation(api.billingCatalog.createFromBilling)

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

    const result = scoreEM(facts, 'established', encounterType)
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

  const handleAddService = async () => {
    if (!user?.id || !orgId || !addName.trim()) return
    const priceNum = parseFloat(addPrice)
    if (isNaN(priceNum) || priceNum < 0) return
    setAddSubmitting(true)
    try {
      const catalogItemId = await createCatalogItem({
        userId: user.id,
        orgId,
        name: addName.trim(),
        code: generateCode(addName),
        category: 'other',
        basePrice: Math.round(priceNum * 100),
        taxable: false,
      })
      await createProspective({
        userId: user.id,
        encounterId,
        orgId,
        catalogItemId: catalogItemId as Id<'billingCatalog'>,
        description: addName.trim(),
        quantity: 1,
        unitPrice: Math.round(priceNum * 100),
        taxable: false,
        extractedFromFact: `manual-${Date.now()}`,
        confidence: 'high',
      })
      setAddName('')
      setAddPrice('')
      setShowAddService(false)
      onItemsChange?.()
    } catch (err) {
      console.error(err)
    } finally {
      setAddSubmitting(false)
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

  // ── Empty catalog ─────────────────────────────────────────────────────────
  if (!catalog || catalog.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <PanelHeader title="Planned Services" />
        <div className="flex flex-col items-center gap-1 py-4 text-muted-foreground">
          <AlertCircle className="h-5 w-5 opacity-40 mb-1" />
          <p className="text-xs">Set up your billing catalog first</p>
          {orgId && (
            <AppLink href="/billing?tab=catalog" className="text-xs text-primary hover:underline mt-1">
              Go to Billing Catalog
            </AppLink>
          )}
        </div>
      </div>
    )
  }

  // ── Billed state ──────────────────────────────────────────────────────────
  if (isFinalized) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
              Billed Services
            </p>
            {billedItems && billedItems.length > 0 && (
              <span className="rounded-full bg-green-500/10 px-1.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                {billedItems.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-green-600 dark:text-green-400">${total.toFixed(2)}</span>
            {voidConfirming ? (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">Void?</span>
                <button onClick={handleVoid} className="text-[10px] text-destructive hover:underline">Yes</button>
                <button onClick={() => setVoidConfirming(false)} className="text-[10px] text-muted-foreground hover:underline">No</button>
              </div>
            ) : (
              <button
                onClick={() => setVoidConfirming(true)}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5"
                title="Void invoice"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
        {invoiceMeta?.invoiceNumber && (
          <p className="text-[10px] text-muted-foreground mb-2 font-mono">{invoiceMeta.invoiceNumber}</p>
        )}
        {!billedItems || billedItems.length === 0 ? (
          <p className="text-xs text-muted-foreground py-1">No items on invoice</p>
        ) : (
          <div className="space-y-1">
            {billedItems.map((item) => <BillingItemRow key={item._id} item={item} readonly />)}
          </div>
        )}
      </div>
    )
  }

  // ── Planned state (pre-invoice) ────────────────────────────────────────────
  if (!prospectiveItems || prospectiveItems.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <PanelHeader title="Planned Services" />
        {isExtracting ? (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 py-1">
            <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />
            Analyzing for billable items…
          </p>
        ) : (
          <p className="text-xs text-muted-foreground py-1">
            No billable items found yet.
          </p>
        )}
        <AddServiceForm
          show={showAddService}
          onToggle={setShowAddService}
          name={addName} onName={setAddName}
          price={addPrice} onPrice={setAddPrice}
          onSubmit={handleAddService}
          submitting={addSubmitting}
        />
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5" />
            Planned Services
          </p>
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
            {prospectiveItems.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isExtracting && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          <span className="text-xs font-semibold text-green-600 dark:text-green-400">
            Est. ${total.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="space-y-1">
        {prospectiveItems.map((item) => (
          <BillingItemRow key={item._id} item={item} onDelete={handleDelete} />
        ))}
      </div>

      <AddServiceForm
        show={showAddService}
        onToggle={setShowAddService}
        name={addName} onName={setAddName}
        price={addPrice} onPrice={setAddPrice}
        onSubmit={handleAddService}
        submitting={addSubmitting}
      />
    </div>
  )
}

// ── Shared sub-components ──────────────────────────────────────────────────

function PanelHeader({ title }: { title: string }) {
  return (
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-3">
      <DollarSign className="h-3.5 w-3.5" />
      {title}
    </p>
  )
}

interface AddServiceFormProps {
  show: boolean
  onToggle: (v: boolean) => void
  name: string
  onName: (v: string) => void
  price: string
  onPrice: (v: string) => void
  onSubmit: () => void
  submitting: boolean
}

function AddServiceForm({ show, onToggle, name, onName, price, onPrice, onSubmit, submitting }: AddServiceFormProps) {
  return (
    <div className="mt-3 pt-3 border-t">
      {show ? (
        <div className="space-y-2">
          <Input
            autoFocus
            placeholder="Service name"
            value={name}
            onChange={e => onName(e.target.value)}
            className="h-7 text-xs"
            onKeyDown={e => { if (e.key === 'Escape') onToggle(false) }}
          />
          <div className="flex gap-1.5">
            <Input
              placeholder="Price ($)"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={e => onPrice(e.target.value)}
              className="h-7 text-xs"
              onKeyDown={e => { if (e.key === 'Enter') onSubmit() }}
            />
            <button
              disabled={submitting || !name.trim() || !price}
              onClick={onSubmit}
              className="h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 flex-shrink-0"
            >
              {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add'}
            </button>
            <button
              onClick={() => { onToggle(false); onName(''); onPrice('') }}
              className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground flex-shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => onToggle(true)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add service
        </button>
      )}
    </div>
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
      className="flex items-center justify-between py-1.5 group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex-1 min-w-0 mr-2">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-medium truncate">{item.description}</p>
          {item.confidence === 'high' && (
            <span className="text-[10px] rounded-full bg-primary/10 text-primary px-1.5 py-0.5 flex-shrink-0">high</span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Qty {item.quantity} · ${(item.unitPrice / 100).toFixed(2)} ea
        </p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="text-xs font-semibold">${itemTotal.toFixed(2)}</span>
        {!readonly && isHovered && onDelete && (
          <button
            onClick={() => onDelete(item._id)}
            className="text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  )
}
