'use client';

import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  PlusCircle,
  Play,
  Clock,
  User,
  ExternalLink,
} from 'lucide-react';
import { useQuery, useMutation } from 'convex/react';
import { api } from 'convex/_generated/api';
import { useAuth } from '@clerk/nextjs';
import { useOrgCtx } from '@/app/providers/org-context-provider';
import { useAppRouter } from '@/hooks/useAppRouter';
import { toast } from '@/hooks/use-toast';
import { BillingGuard } from '@/components/billing/BillingGuard';
import { Id } from 'convex/_generated/dataModel';
import { cn } from '@/lib/utils';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const APPOINTMENT_TYPES = [
  { value: 'new-patient', label: 'New Patient' },
  { value: 'follow-up', label: 'Follow-up' },
  { value: 'telehealth', label: 'Telehealth' },
  { value: 'procedure', label: 'Procedure' },
  { value: 'other', label: 'Other' },
];

const TYPE_COLORS: Record<string, string> = {
  'new-patient': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
  'follow-up': 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800',
  'telehealth': 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800',
  'procedure': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
  'other': 'bg-muted text-muted-foreground border-border',
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  scheduled: { label: 'Scheduled', className: 'bg-muted text-muted-foreground' },
  confirmed: { label: 'Confirmed', className: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' },
  'in-progress': { label: 'In Progress', className: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' },
  completed: { label: 'Completed', className: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' },
  cancelled: { label: 'Cancelled', className: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' },
  'no-show': { label: 'No Show', className: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400' },
};

function toLocalDateString(date: Date): string {
  return date.toLocaleDateString('en-CA'); // YYYY-MM-DD in local timezone
}

function formatDisplayDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const today = toLocalDateString(new Date());
  const tomorrow = toLocalDateString(new Date(Date.now() + 86400000));
  if (dateStr === today) return 'Today';
  if (dateStr === tomorrow) return 'Tomorrow';
  return `${DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

export default function SchedulePage() {
  const router = useAppRouter();
  const { userId } = useAuth();
  const { orgContext } = useOrgCtx();

  const today = toLocalDateString(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);

  // Booking form state
  const [patientName, setPatientName] = useState('');
  const [apptTime, setApptTime] = useState('');
  const [apptType, setApptType] = useState('follow-up');
  const [apptReason, setApptReason] = useState('');
  const [apptDuration, setApptDuration] = useState('30');
  const [booking, setBooking] = useState(false);

  const appointments = useQuery(
    api.appointments.getByOrgAndDate,
    orgContext ? { orgId: orgContext.orgId as Id<'organizations'>, date: selectedDate } : 'skip'
  );

  const orgPatients = useQuery(
    api.patients.getPatientsByOrg,
    orgContext ? { orgId: orgContext.orgId as Id<'organizations'> } : 'skip'
  );

  const createAppointment = useMutation(api.appointments.create);
  const createDraft = useMutation(api.encounters.createDraftConsultation);
  const linkEncounter = useMutation(api.appointments.linkEncounter);

  function navigate(days: number) {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const next = new Date(y, m - 1, d + days);
    setSelectedDate(toLocalDateString(next));
  }

  async function handleBook() {
    if (!patientName.trim() || !orgContext || !userId) return;
    setBooking(true);
    try {
      // Try to match patient by name
      const matched = orgPatients?.find(
        (p) => p.name.toLowerCase() === patientName.trim().toLowerCase()
      );

      await createAppointment({
        orgId: orgContext.orgId as Id<'organizations'>,
        providerId: userId,
        patientId: matched?._id as Id<'patients'> | undefined,
        patientName: patientName.trim(),
        scheduledDate: selectedDate,
        scheduledTime: apptTime || undefined,
        duration: apptDuration ? Number(apptDuration) : undefined,
        type: apptType,
        reason: apptReason.trim() || undefined,
      });

      toast({ title: 'Appointment booked', description: `${patientName} on ${formatDisplayDate(selectedDate)}` });
      setBookingOpen(false);
      setPatientName('');
      setApptTime('');
      setApptReason('');
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to book appointment.', variant: 'destructive' });
    } finally {
      setBooking(false);
    }
  }

  async function handleStartEncounter(appt: { _id: Id<'appointments'>; patientId?: Id<'patients'>; patientName: string; reason?: string; scheduledTime?: string }) {
    if (!orgContext || !userId) return;
    setStartingId(appt._id);
    try {
      const encounterId = await createDraft({
        providerId: userId,
        orgId: orgContext.orgId as Id<'organizations'>,
        patientId: appt.patientId,
        reasonForVisit: appt.reason,
        appointmentTime: appt.scheduledTime,
      });
      await linkEncounter({ appointmentId: appt._id, encounterId });
      router.push(`/encounter/${encounterId}`);
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to start encounter.', variant: 'destructive' });
      setStartingId(null);
    }
  }

  const isToday = selectedDate === today;

  return (
    <Layout>
      <BillingGuard feature="Schedule">
        <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">

          {/* Header */}
          <div className="flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-lg">
                <CalendarDays className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-2xl font-bold leading-none">Schedule</h1>
            </div>
            <Button onClick={() => setBookingOpen(true)} className="w-full sm:w-auto">
              <PlusCircle className="w-4 h-4 mr-2" />
              Book Appointment
            </Button>
          </div>

          {/* Date navigation */}
          <div className="flex items-center justify-between">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">{formatDisplayDate(selectedDate)}</h2>
              {!isToday && (
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setSelectedDate(today)}>
                  Today
                </Button>
              )}
            </div>

            <Button variant="outline" size="icon" onClick={() => navigate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Appointments */}
          {appointments === undefined ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin h-8 w-8 border-4 border-gray-200 rounded-full border-t-primary" />
            </div>
          ) : appointments.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <CalendarDays className="h-12 w-12 text-muted-foreground/30 mx-auto" />
              <p className="text-muted-foreground font-medium">No appointments {isToday ? 'today' : 'on this day'}</p>
              <p className="text-sm text-muted-foreground/60">
                <button onClick={() => setBookingOpen(true)} className="text-primary hover:underline">
                  Book one now
                </button>
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {appointments.map((appt) => {
                const typeColor = TYPE_COLORS[appt.type] ?? TYPE_COLORS.other;
                const statusCfg = STATUS_CONFIG[appt.status] ?? STATUS_CONFIG.scheduled;
                const isStarting = startingId === appt._id;
                const isActive = appt.status === 'in-progress' || appt.status === 'completed' || appt.status === 'cancelled' || appt.status === 'no-show';

                return (
                  <Card key={appt._id} className={cn(appt.status === 'cancelled' && 'opacity-50')}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        {/* Time column */}
                        <div className="w-14 shrink-0 text-center">
                          {appt.scheduledTime ? (
                            <>
                              <p className="text-sm font-semibold tabular-nums">{appt.scheduledTime}</p>
                              {appt.duration && (
                                <p className="text-[10px] text-muted-foreground mt-0.5">{appt.duration}m</p>
                              )}
                            </>
                          ) : (
                            <Clock className="h-4 w-4 text-muted-foreground mx-auto mt-0.5" />
                          )}
                        </div>

                        {/* Divider */}
                        <div className="w-px self-stretch bg-border shrink-0" />

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <User className="h-4 w-4 text-primary" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold truncate">{appt.patientName}</p>
                                {appt.reason && (
                                  <p className="text-xs text-muted-foreground truncate mt-0.5">{appt.reason}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 ${typeColor}`}>
                                {APPOINTMENT_TYPES.find(t => t.value === appt.type)?.label ?? appt.type}
                              </Badge>
                              <Badge variant="secondary" className={`text-[10px] px-1.5 py-0.5 ${statusCfg.className}`}>
                                {statusCfg.label}
                              </Badge>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 mt-3">
                            {appt.encounterId ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1.5"
                                onClick={() => router.push(`/encounter/${appt.encounterId}`)}
                              >
                                <ExternalLink className="h-3 w-3" />
                                View Encounter
                              </Button>
                            ) : !isActive && (
                              <Button
                                size="sm"
                                className="h-7 text-xs gap-1.5"
                                disabled={isStarting}
                                onClick={() => handleStartEncounter({
                                  _id: appt._id,
                                  patientId: appt.patientId as Id<'patients'> | undefined,
                                  patientName: appt.patientName,
                                  reason: appt.reason,
                                  scheduledTime: appt.scheduledTime,
                                })}
                              >
                                <Play className="h-3 w-3" />
                                {isStarting ? 'Starting…' : 'Start Encounter'}
                              </Button>
                            )}
                            {appt.patientId && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-muted-foreground"
                                onClick={() => router.push(`/patient-records/${appt.patientId}`)}
                              >
                                View Patient
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

        </div>

        {/* Book Appointment Dialog */}
        <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Book Appointment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Patient name</label>
                <Input
                  placeholder="Full name"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Time</label>
                  <Input
                    type="time"
                    value={apptTime}
                    onChange={(e) => setApptTime(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Duration (min)</label>
                  <Input
                    type="number"
                    value={apptDuration}
                    onChange={(e) => setApptDuration(e.target.value)}
                    placeholder="30"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Type</label>
                <Select value={apptType} onValueChange={setApptType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {APPOINTMENT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Reason <span className="text-muted-foreground font-normal">(optional)</span></label>
                <Input
                  placeholder="Chief complaint or reason for visit"
                  value={apptReason}
                  onChange={(e) => setApptReason(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                onClick={handleBook}
                disabled={!patientName.trim() || booking}
              >
                {booking ? 'Booking…' : `Book for ${formatDisplayDate(selectedDate)}`}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </BillingGuard>
    </Layout>
  );
}
