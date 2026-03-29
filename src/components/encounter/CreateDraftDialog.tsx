'use client'

import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Search, Loader2, Plus, Check, CalendarClock, UserPlus } from 'lucide-react'
import { useMutation, useQuery } from 'convex/react'
import { api } from 'convex/_generated/api'
import { useUser } from '@clerk/nextjs'
import { useOrgCtx } from '@/app/providers/org-context-provider'
import { useAppRouter } from '@/hooks/useAppRouter'
import { toast } from '@/hooks/use-toast'
import type { Id } from 'convex/_generated/dataModel'

interface CreateDraftDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialPatientId?: Id<'patients'>
  initialPatientName?: string
  initialReasonForVisit?: string
  initialAppointmentTime?: string
}

export function CreateDraftDialog({ open, onOpenChange, initialPatientId, initialPatientName, initialReasonForVisit, initialAppointmentTime }: CreateDraftDialogProps) {
  const { user } = useUser()
  const { orgContext } = useOrgCtx()
  const router = useAppRouter()

  const [patientSearch, setPatientSearch] = useState('')
  const [selectedPatientId, setSelectedPatientId] = useState<Id<'patients'> | null>(initialPatientId ?? null)
  const [selectedPatientName, setSelectedPatientName] = useState(initialPatientName ?? '')
  const [reasonForVisit, setReasonForVisit] = useState(initialReasonForVisit ?? '')
  const [appointmentTime, setAppointmentTime] = useState(initialAppointmentTime ?? '')
  const [isCreating, setIsCreating] = useState(false)

  const createDraft = useMutation(api.encounters.createDraftConsultation)
  const findOrCreatePatient = useMutation(api.patients.findOrCreatePatient)

  // Patient list
  const orgPatients = useQuery(
    api.patients.getPatientsByOrg,
    orgContext ? { orgId: orgContext.orgId as Id<'organizations'> } : 'skip'
  )
  const vetPatients = useQuery(
    api.patients.getPatientsByVet,
    !orgContext && user?.id ? { providerId: user.id } : 'skip'
  )
  const patients = orgPatients ?? vetPatients

  // Prior encounters for selected patient
  const priorConsultations = useQuery(
    api.encounters.getPriorConsultations,
    selectedPatientId ? { patientId: selectedPatientId } : 'skip'
  )

  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim() || !patients) return []
    const query = patientSearch.toLowerCase()
    return patients
      .filter((p) => p.name.toLowerCase().includes(query))
      .slice(0, 5)
  }, [patientSearch, patients])

  // Show "create new patient" option when search has text but no exact match
  const showCreateNew = useMemo(() => {
    if (!patientSearch.trim()) return false
    if (!patients) return true
    const exactMatch = patients.some(
      (p) => p.name.toLowerCase() === patientSearch.trim().toLowerCase()
    )
    return !exactMatch
  }, [patientSearch, patients])

  const handleSelectPatient = (patient: NonNullable<typeof patients>[number]) => {
    setSelectedPatientId(patient._id)
    setSelectedPatientName(patient.name)
    setPatientSearch('')
  }

  const handleClearPatient = () => {
    setSelectedPatientId(null)
    setSelectedPatientName('')
  }

  const handleCreate = async () => {
    if (!user?.id) return

    setIsCreating(true)
    try {
      let patientId = selectedPatientId

      // If no existing patient selected but search text entered, create a new patient
      if (!patientId && patientSearch.trim()) {
        const result = await findOrCreatePatient({
          providerId: user.id,
          orgId: orgContext?.orgId as Id<'organizations'> | undefined,
          name: patientSearch.trim(),
        })
        patientId = result.patientId
      }

      const encounterId = await createDraft({
        providerId: user.id,
        orgId: orgContext?.orgId as Id<'organizations'> | undefined,
        patientId: patientId ?? undefined,
        reasonForVisit: reasonForVisit || undefined,
        appointmentTime: appointmentTime || undefined,
      })

      onOpenChange(false)
      resetForm()
      router.push(`/encounter/${encounterId}`)
    } catch (error) {
      console.error('Failed to create draft:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create draft',
        variant: 'destructive',
      })
    } finally {
      setIsCreating(false)
    }
  }

  const resetForm = () => {
    setPatientSearch('')
    setSelectedPatientId(initialPatientId ?? null)
    setSelectedPatientName(initialPatientName ?? '')
    setReasonForVisit(initialReasonForVisit ?? '')
    setAppointmentTime(initialAppointmentTime ?? '')
  }

  const canCreate = selectedPatientId || patientSearch.trim()

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) resetForm()
        onOpenChange(val)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            New Draft Encounter
          </DialogTitle>
          <DialogDescription>
            Prep for an upcoming appointment. Select an existing patient or type a new name.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Patient Search */}
          <div className="space-y-2">
            <Label>Patient</Label>
            {selectedPatientId ? (
              <div className="flex items-center gap-2 p-2 bg-green-50 rounded text-sm text-green-700">
                <Check className="h-4 w-4" />
                <span>
                  <strong>{selectedPatientName}</strong>
                </span>
                <button
                  className="ml-auto text-green-600 hover:text-green-800 underline text-xs"
                  onClick={handleClearPatient}
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search or type new patient name..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {filteredPatients.length > 0 && (
                  <div className="border rounded-md overflow-hidden">
                    {filteredPatients.map((p) => (
                      <button
                        key={p._id}
                        className="w-full text-left px-3 py-2 hover:bg-accent text-sm border-b last:border-b-0"
                        onClick={() => handleSelectPatient(p)}
                      >
                        <span className="font-medium">{p.name}</span>
                        <span className="text-muted-foreground ml-2">
                          {p.age || ''}{p.sex ? ` · ${p.sex}` : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {showCreateNew && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <UserPlus className="h-3 w-3" />
                    &ldquo;{patientSearch.trim()}&rdquo; will be created as a new patient
                  </p>
                )}
              </>
            )}
          </div>

          {/* Reason for Visit */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Visit</Label>
            <Input
              id="reason"
              placeholder="e.g., Annual checkup, Limping on right hind leg"
              value={reasonForVisit}
              onChange={(e) => setReasonForVisit(e.target.value)}
            />
          </div>

          {/* Appointment Time */}
          <div className="space-y-2">
            <Label htmlFor="apptTime" className="flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" />
              Appointment Time
            </Label>
            <Input
              id="apptTime"
              type="datetime-local"
              value={appointmentTime}
              onChange={(e) => setAppointmentTime(e.target.value)}
            />
          </div>

          {/* Prior context preview */}
          {selectedPatientId && priorConsultations && priorConsultations.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Recent History</Label>
              <div className="space-y-1.5">
                {priorConsultations.slice(0, 2).map((c) => (
                  <div
                    key={c._id}
                    className="p-2 bg-muted rounded text-xs space-y-0.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {new Date(c.date).toLocaleDateString()}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {c.factCount} facts
                      </Badge>
                    </div>
                    {c.diagnosis && (
                      <p className="text-muted-foreground truncate">{c.diagnosis}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating || !canCreate}
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Create Draft
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
