'use client';

import { useState, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import { useOrgCtx } from '@/app/providers/org-context-provider';
import { AppLink } from '@/components/navigation/AppLink';
import {
  CheckCircle2,
  Circle,
  Sparkles,
  ChevronRight,
  X,
  RotateCcw,
  Stethoscope,
  Users,
  FileText,
  Building2,
} from 'lucide-react';
import type { Id } from 'convex/_generated/dataModel';

interface GettingStartedWidgetProps {
  onDismiss?: () => void;
}

interface Task {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  href: string;
  isComplete: (data: {
    patients: number;
    encounters: number;
    members: number;
    locations: number;
  }) => boolean;
}

const TASKS: Task[] = [
  {
    id: 'add-patient',
    label: 'Add your first patient',
    description: 'Start by creating a patient record',
    icon: Stethoscope,
    href: '/patient-records',
    isComplete: (data) => data.patients > 0,
  },
  {
    id: 'record-encounter',
    label: 'Record a encounter',
    description: 'Use AI to document your first visit',
    icon: FileText,
    href: '/encounter/new',
    isComplete: (data) => data.encounters > 0,
  },
  {
    id: 'invite-team',
    label: 'Invite team members',
    description: 'Add providers and staff to collaborate',
    icon: Users,
    href: '/settings/team',
    isComplete: (data) => data.members > 1, // Owner + at least 1 invite
  },
  {
    id: 'setup-locations',
    label: 'Set up locations',
    description: 'Configure your practice locations',
    icon: Building2,
    href: '/settings/locations',
    isComplete: (data) => data.locations > 1, // More than just default
  },
];

export function GettingStartedWidget({ onDismiss }: GettingStartedWidgetProps) {
  const { orgContext } = useOrgCtx();
  const [isExpanded, setIsExpanded] = useState(true);

  // Fetch data to determine task completion
  const patients = useQuery(
    api.patients.getPatientsByOrg,
    orgContext ? { orgId: orgContext.orgId as Id<'organizations'> } : 'skip'
  );

  const encounters = useQuery(
    api.encounters.getConsultationsByOrg,
    orgContext ? { orgId: orgContext.orgId as Id<'organizations'> } : 'skip'
  );

  const memberships = useQuery(
    api.memberships.getByOrg,
    orgContext ? { orgId: orgContext.orgId as Id<'organizations'> } : 'skip'
  );

  const locations = useQuery(
    api.locations.getByOrg,
    orgContext ? { orgId: orgContext.orgId as Id<'organizations'> } : 'skip'
  );

  // Calculate task completion
  const taskData = useMemo(() => ({
    patients: patients?.filter((p) => p.isActive).length || 0,
    encounters: encounters?.length || 0,
    members: memberships?.filter((m) => m.status === 'active').length || 0,
    locations: locations?.length || 0,
  }), [patients, encounters, memberships, locations]);

  const completedTasks = TASKS.filter((task) => task.isComplete(taskData));
  const incompleteTasks = TASKS.filter((task) => !task.isComplete(taskData));
  const progress = Math.round((completedTasks.length / TASKS.length) * 100);
  const allComplete = completedTasks.length === TASKS.length;

  if (!isExpanded) {
    return (
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full p-4 flex items-center justify-between hover:bg-accent transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="font-semibold">Getting Started</p>
              <p className="text-sm text-muted-foreground">
                {progress}% complete · {incompleteTasks.length} {incompleteTasks.length === 1 ? 'task' : 'tasks'} remaining
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg bg-gradient-to-br from-primary/5 to-transparent overflow-hidden">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">
                {allComplete ? 'All Set!' : 'Getting Started'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {allComplete
                  ? "You've completed all the essential tasks"
                  : `Complete these tasks to get the most out of [PRODUCT_NAME]`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsExpanded(false)}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
              title="Collapse"
            >
              <ChevronRight className="h-4 w-4 rotate-90" />
            </button>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="p-2 hover:bg-accent rounded-lg transition-colors"
                title="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Task List */}
        <div className="space-y-2">
          {TASKS.map((task) => {
            const Icon = task.icon;
            const isComplete = task.isComplete(taskData);

            return (
              <AppLink
                key={task.id}
                href={task.href}
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent transition-colors group"
              >
                <div className="flex-shrink-0">
                  {isComplete ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium ${
                      isComplete ? 'text-muted-foreground line-through' : ''
                    }`}
                  >
                    {task.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {task.description}
                  </p>
                </div>
                <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </AppLink>
            );
          })}
        </div>

        {/* All Complete Message */}
        {allComplete && (
          <div className="mt-4 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm text-green-700 dark:text-green-400">
              You're all set to use [PRODUCT_NAME] effectively. Start a new encounter or explore your patient records.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
