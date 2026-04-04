'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, PlusCircle, Play, ExternalLink, User } from 'lucide-react';
import { useQuery, useMutation } from 'convex/react';
import { api } from 'convex/_generated/api';
import { useAuth } from '@clerk/nextjs';
import { useOrgCtx } from '@/app/providers/org-context-provider';
import { useAppRouter } from '@/hooks/useAppRouter';
import { toast } from '@/hooks/use-toast';
import { BillingGuard } from '@/components/billing/BillingGuard';
import { Id } from 'convex/_generated/dataModel';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useIsMobile';

// ─── Calendar constants ────────────────────────────────────────────────────────
const START_HOUR = 7;
const END_HOUR = 20;
const SLOT_HEIGHT = 48; // px per 30 min
const HOUR_HEIGHT = SLOT_HEIGHT * 2;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const APPT_TYPES = [
  { value: 'new-patient', label: 'New Patient' },
  { value: 'follow-up',   label: 'Follow-up'   },
  { value: 'telehealth',  label: 'Telehealth'   },
  { value: 'procedure',   label: 'Procedure'    },
  { value: 'other',       label: 'Other'        },
];

const TYPE_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  'new-patient': { bg: 'bg-blue-100 dark:bg-blue-900/50',    text: 'text-blue-900 dark:text-blue-100',    border: 'border-blue-300 dark:border-blue-700'    },
  'follow-up':   { bg: 'bg-emerald-100 dark:bg-emerald-900/50', text: 'text-emerald-900 dark:text-emerald-100', border: 'border-emerald-300 dark:border-emerald-700' },
  'telehealth':  { bg: 'bg-violet-100 dark:bg-violet-900/50',   text: 'text-violet-900 dark:text-violet-100',   border: 'border-violet-300 dark:border-violet-700'   },
  'procedure':   { bg: 'bg-amber-100 dark:bg-amber-900/50',   text: 'text-amber-900 dark:text-amber-100',   border: 'border-amber-300 dark:border-amber-700'   },
  'other':       { bg: 'bg-muted',                             text: 'text-muted-foreground',               border: 'border-border'                            },
};

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Scheduled', confirmed: 'Confirmed', 'in-progress': 'In Progress',
  completed: 'Completed', cancelled: 'Cancelled', 'no-show': 'No Show',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toLocalDate(d: Date): string { return d.toLocaleDateString('en-CA'); }

function getWeekDates(anchor: string): string[] {
  const [y, m, d] = anchor.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dow = date.getDay();
  const mon = new Date(date);
  mon.setDate(date.getDate() - (dow === 0 ? 6 : dow - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const nd = new Date(mon); nd.setDate(mon.getDate() + i); return toLocalDate(nd);
  });
}

function formatHour(h: number): string {
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function getApptPos(time: string, duration: number) {
  const [h, m] = time.split(':').map(Number);
  const mins = (h - START_HOUR) * 60 + m;
  return { top: (mins / 30) * SLOT_HEIGHT, height: Math.max((duration / 30) * SLOT_HEIGHT, 22) };
}

function currentTimeTop(): number | null {
  const now = new Date();
  const h = now.getHours(), m = now.getMinutes();
  if (h < START_HOUR || h >= END_HOUR) return null;
  return ((h - START_HOUR) * 60 + m) / 30 * SLOT_HEIGHT;
}

function weekLabel(dates: string[]): string {
  const [ay, am, ad] = dates[0].split('-').map(Number);
  const [, bm, bd] = dates[6].split('-').map(Number);
  if (am === bm) return `${MONTHS[am - 1]} ${ad}–${bd}, ${ay}`;
  return `${MONTHS_SHORT[am - 1]} ${ad} – ${MONTHS_SHORT[bm - 1]} ${bd}, ${ay}`;
}

type Appt = {
  _id: Id<'appointments'>;
  patientId?: Id<'patients'>;
  patientName: string;
  scheduledDate: string;
  scheduledTime?: string;
  duration?: number;
  type: string;
  reason?: string;
  status: string;
  encounterId?: Id<'encounters'>;
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SchedulePage() {
  const router = useAppRouter();
  const { userId } = useAuth();
  const { orgContext } = useOrgCtx();
  const isMobile = useIsMobile();
  const gridRef = useRef<HTMLDivElement>(null);

  const today = toLocalDate(new Date());
  const [anchor, setAnchor] = useState(today);
  const [timeTop, setTimeTop] = useState<number | null>(currentTimeTop);
  const [selectedAppt, setSelectedAppt] = useState<Appt | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookDate, setBookDate] = useState(today);
  const [bookTime, setBookTime] = useState('');
  const [startingId, setStartingId] = useState<string | null>(null);

  // Booking form
  const [bName, setBName] = useState('');
  const [bType, setBType] = useState('follow-up');
  const [bReason, setBReason] = useState('');
  const [bDuration, setBDuration] = useState('30');
  const [booking, setBooking] = useState(false);

  // Tick current time
  useEffect(() => {
    const id = setInterval(() => setTimeTop(currentTimeTop()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Auto-scroll to current time on mount
  useEffect(() => {
    if (!gridRef.current) return;
    const top = currentTimeTop();
    if (top !== null) gridRef.current.scrollTop = Math.max(0, top - 160);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const weekDates = useMemo(
    () => (isMobile ? [anchor] : getWeekDates(anchor)),
    [anchor, isMobile]
  );

  const appts = useQuery(
    api.appointments.getByOrgAndDateRange,
    orgContext
      ? { orgId: orgContext.orgId as Id<'organizations'>, startDate: weekDates[0], endDate: weekDates[weekDates.length - 1] }
      : 'skip'
  );

  const orgPatients = useQuery(
    api.patients.getPatientsByOrg,
    orgContext ? { orgId: orgContext.orgId as Id<'organizations'> } : 'skip'
  );

  const createAppt    = useMutation(api.appointments.create);
  const createDraft   = useMutation(api.encounters.createDraftConsultation);
  const linkEncounter = useMutation(api.appointments.linkEncounter);
  const updateStatus  = useMutation(api.appointments.updateStatus);

  const byDate = useMemo(() => {
    const map = new Map<string, Appt[]>();
    weekDates.forEach(d => map.set(d, []));
    appts?.forEach(a => {
      const arr = map.get(a.scheduledDate) ?? [];
      arr.push(a as Appt);
      map.set(a.scheduledDate, arr);
    });
    return map;
  }, [appts, weekDates]);

  function navigate(delta: number) {
    const [y, m, d] = anchor.split('-').map(Number);
    setAnchor(toLocalDate(new Date(y, m - 1, d + delta)));
  }

  function openBooking(date: string, time: string) {
    setBookDate(date); setBookTime(time);
    setBName(''); setBReason('');
    setBookingOpen(true);
  }

  function handleColClick(date: string, e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const mins = Math.round(relY / SLOT_HEIGHT) * 30;
    const h = START_HOUR + Math.floor(mins / 60);
    const m = mins % 60;
    if (h < START_HOUR || h >= END_HOUR) return;
    openBooking(date, `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }

  async function handleBook() {
    if (!bName.trim() || !orgContext || !userId) return;
    setBooking(true);
    try {
      const matched = orgPatients?.find(p => p.name.toLowerCase() === bName.trim().toLowerCase());
      await createAppt({
        orgId: orgContext.orgId as Id<'organizations'>,
        providerId: userId,
        patientId: matched?._id as Id<'patients'> | undefined,
        patientName: bName.trim(),
        scheduledDate: bookDate,
        scheduledTime: bookTime || undefined,
        duration: bDuration ? Number(bDuration) : undefined,
        type: bType,
        reason: bReason.trim() || undefined,
      });
      toast({ title: 'Appointment booked' });
      setBookingOpen(false);
    } catch {
      toast({ title: 'Error', description: 'Failed to book appointment.', variant: 'destructive' });
    } finally {
      setBooking(false);
    }
  }

  async function handleStart(appt: Appt) {
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
    } catch {
      toast({ title: 'Error', description: 'Failed to start encounter.', variant: 'destructive' });
      setStartingId(null);
    }
  }

  async function handleStatus(appt: Appt, status: string) {
    await updateStatus({ appointmentId: appt._id, status });
    setSelectedAppt(null);
    toast({ title: status === 'no-show' ? 'Marked as no-show' : 'Appointment cancelled' });
  }

  return (
    <Layout>
      <BillingGuard feature="Schedule">
        {/* Full-viewport calendar – no padding from Layout's main */}
        <div className="flex flex-col h-screen overflow-hidden">

          {/* ── Top bar ──────────────────────────────────────────────── */}
          <div className="shrink-0 flex items-center justify-between px-4 sm:px-5 h-14 border-b bg-background z-10">
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg border overflow-hidden">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none border-r" onClick={() => navigate(isMobile ? -1 : -7)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none" onClick={() => navigate(isMobile ? 1 : 7)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <h2 className="text-sm sm:text-base font-semibold ml-1">
                {isMobile
                  ? (anchor === today ? 'Today' : (() => { const [y,m,d]=anchor.split('-').map(Number); return `${DAYS_SHORT[new Date(y,m-1,d).getDay()]} ${MONTHS_SHORT[m-1]} ${d}`; })())
                  : weekLabel(weekDates)
                }
              </h2>
              {anchor !== today && (
                <Button variant="outline" size="sm" className="h-7 text-xs ml-1" onClick={() => setAnchor(today)}>
                  Today
                </Button>
              )}
            </div>
            <Button size="sm" className="gap-1.5" onClick={() => openBooking(isMobile ? anchor : today, '')}>
              <PlusCircle className="h-3.5 w-3.5" />
              Book
            </Button>
          </div>

          {/* ── Calendar body ─────────────────────────────────────────── */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">

            {/* Day column headers */}
            <div className="shrink-0 flex border-b bg-background">
              <div className="w-12 sm:w-14 shrink-0" /> {/* gutter */}
              {weekDates.map(date => {
                const [y, m, d] = date.split('-').map(Number);
                const dow = new Date(y, m - 1, d).getDay();
                const isToday = date === today;
                return (
                  <div
                    key={date}
                    className="flex-1 flex flex-col items-center py-2 border-l border-border/40 first:border-l-0 select-none cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => openBooking(date, '')}
                  >
                    <span className={cn('text-[10px] font-semibold uppercase tracking-wider', isToday ? 'text-primary' : 'text-muted-foreground')}>
                      {DAYS_SHORT[dow]}
                    </span>
                    <div className={cn(
                      'mt-1 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold tabular-nums',
                      isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'
                    )}>
                      {d}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Scrollable time grid */}
            <div ref={gridRef} className="flex-1 overflow-y-auto overflow-x-hidden">
              <div className="flex relative" style={{ height: `${HOURS.length * HOUR_HEIGHT}px` }}>

                {/* Time gutter */}
                <div className="w-12 sm:w-14 shrink-0 relative select-none">
                  {HOURS.map(h => (
                    <div key={h} style={{ height: HOUR_HEIGHT }} className="relative border-b border-border/20">
                      <span className="absolute top-0 right-2 -translate-y-2.5 text-[10px] text-muted-foreground tabular-nums">
                        {formatHour(h)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {weekDates.map(date => {
                  const isToday = date === today;
                  const timed   = (byDate.get(date) ?? []).filter(a => a.scheduledTime);
                  const untimed = (byDate.get(date) ?? []).filter(a => !a.scheduledTime);

                  return (
                    <div
                      key={date}
                      className={cn(
                        'flex-1 relative border-l border-border/40 first:border-l-0',
                        isToday && 'bg-primary/[0.018]'
                      )}
                      onClick={e => handleColClick(date, e)}
                    >
                      {/* Grid lines */}
                      {HOURS.map(h => (
                        <div key={h} style={{ height: HOUR_HEIGHT }} className="border-b border-border/25">
                          <div className="h-1/2 border-b border-dashed border-border/15" />
                        </div>
                      ))}

                      {/* Current time indicator */}
                      {isToday && timeTop !== null && (
                        <div
                          className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                          style={{ top: timeTop }}
                        >
                          <div className="w-2 h-2 rounded-full bg-red-500 shrink-0 -ml-1 shadow" />
                          <div className="flex-1 h-px bg-red-500 opacity-80" />
                        </div>
                      )}

                      {/* Untimed appointments (banner at top) */}
                      {untimed.map(appt => {
                        const s = TYPE_STYLE[appt.type] ?? TYPE_STYLE.other;
                        return (
                          <div
                            key={appt._id}
                            className={cn('absolute top-1 left-1 right-1 z-10 rounded px-1.5 py-0.5 text-[10px] font-semibold truncate cursor-pointer border', s.bg, s.text, s.border)}
                            onClick={e => { e.stopPropagation(); setSelectedAppt(appt); }}
                          >
                            {appt.patientName}
                          </div>
                        );
                      })}

                      {/* Timed appointments */}
                      {timed.map(appt => {
                        const { top, height } = getApptPos(appt.scheduledTime!, appt.duration ?? 30);
                        const s = TYPE_STYLE[appt.type] ?? TYPE_STYLE.other;
                        return (
                          <div
                            key={appt._id}
                            className={cn(
                              'absolute left-1 right-1 z-10 rounded border px-1.5 py-1 cursor-pointer overflow-hidden transition-opacity',
                              s.bg, s.text, s.border,
                              appt.status === 'cancelled' && 'opacity-40'
                            )}
                            style={{ top, height }}
                            onClick={e => { e.stopPropagation(); setSelectedAppt(appt); }}
                          >
                            <p className="text-[11px] font-semibold leading-tight truncate">{appt.patientName}</p>
                            {height > 38 && appt.reason && (
                              <p className="text-[10px] leading-tight truncate opacity-70 mt-0.5">{appt.reason}</p>
                            )}
                            {height > 54 && appt.scheduledTime && (
                              <p className="text-[10px] opacity-60 mt-0.5 tabular-nums">{appt.scheduledTime}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── Appointment detail dialog ──────────────────────────────── */}
        <Dialog open={!!selectedAppt} onOpenChange={() => setSelectedAppt(null)}>
          {selectedAppt && (() => {
            const s = TYPE_STYLE[selectedAppt.type] ?? TYPE_STYLE.other;
            const [y, m, d] = selectedAppt.scheduledDate.split('-').map(Number);
            const dateLabel = `${DAYS_SHORT[new Date(y,m-1,d).getDay()]} ${MONTHS_SHORT[m-1]} ${d}`;
            const canAct = !['cancelled','no-show','completed'].includes(selectedAppt.status);
            return (
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <DialogTitle className="leading-snug">{selectedAppt.patientName}</DialogTitle>
                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        <Badge variant="outline" className={cn('text-xs border', s.bg, s.text, s.border)}>
                          {APPT_TYPES.find(t => t.value === selectedAppt.type)?.label ?? selectedAppt.type}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">{STATUS_LABEL[selectedAppt.status] ?? selectedAppt.status}</Badge>
                      </div>
                    </div>
                  </div>
                </DialogHeader>

                <div className="text-sm space-y-1.5 pt-1">
                  <p className="text-muted-foreground tabular-nums">
                    {dateLabel}
                    {selectedAppt.scheduledTime && ` · ${selectedAppt.scheduledTime}`}
                    {selectedAppt.duration && ` · ${selectedAppt.duration}m`}
                  </p>
                  {selectedAppt.reason && <p>{selectedAppt.reason}</p>}
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  {selectedAppt.encounterId ? (
                    <Button onClick={() => { router.push(`/encounter/${selectedAppt.encounterId}`); setSelectedAppt(null); }}>
                      <ExternalLink className="h-4 w-4 mr-2" /> View Encounter
                    </Button>
                  ) : canAct && (
                    <Button disabled={startingId === selectedAppt._id} onClick={() => handleStart(selectedAppt)}>
                      <Play className="h-4 w-4 mr-2" />
                      {startingId === selectedAppt._id ? 'Starting…' : 'Start Encounter'}
                    </Button>
                  )}

                  {selectedAppt.patientId && (
                    <Button variant="outline" onClick={() => { router.push(`/patient-records/${selectedAppt.patientId}`); setSelectedAppt(null); }}>
                      View Patient Record
                    </Button>
                  )}

                  {canAct && (
                    <div className="flex gap-2 pt-1">
                      <Button variant="ghost" size="sm" className="flex-1 text-xs text-muted-foreground" onClick={() => handleStatus(selectedAppt, 'no-show')}>No Show</Button>
                      <Button variant="ghost" size="sm" className="flex-1 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => handleStatus(selectedAppt, 'cancelled')}>Cancel</Button>
                    </div>
                  )}
                </div>
              </DialogContent>
            );
          })()}
        </Dialog>

        {/* ── Booking dialog ─────────────────────────────────────────── */}
        <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Book Appointment</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Patient</label>
                <Input
                  list="patient-list"
                  placeholder="Patient name"
                  value={bName}
                  onChange={e => setBName(e.target.value)}
                  autoFocus
                />
                <datalist id="patient-list">
                  {orgPatients?.map(p => <option key={p._id} value={p.name} />)}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Date</label>
                  <Input type="date" value={bookDate} onChange={e => setBookDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Time</label>
                  <Input type="time" value={bookTime} onChange={e => setBookTime(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Type</label>
                  <Select value={bType} onValueChange={setBType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {APPT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Duration (min)</label>
                  <Input type="number" value={bDuration} onChange={e => setBDuration(e.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Reason <span className="text-muted-foreground font-normal">(optional)</span></label>
                <Input placeholder="Chief complaint / reason for visit" value={bReason} onChange={e => setBReason(e.target.value)} />
              </div>

              <Button className="w-full" onClick={handleBook} disabled={!bName.trim() || booking}>
                {booking ? 'Booking…' : 'Confirm Appointment'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </BillingGuard>
    </Layout>
  );
}
