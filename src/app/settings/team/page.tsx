'use client';

import * as React from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { Layout } from '@/components/layout/Layout';
import { useOrgCtx } from '@/app/providers/org-context-provider';
import { InviteDialog } from '@/components/settings/InviteDialog';
import { MemberDetailModal } from '@/components/settings/MemberDetailModal';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Users,
  UserPlus,
  Loader2,
  ArrowLeft,
  Trash2,
  Edit,
} from 'lucide-react';
import { AppLink } from '@/components/navigation/AppLink';
import { useUser } from '@clerk/nextjs';

const ROLE_BADGES: Record<string, { label: string; className: string }> = {
  owner:           { label: 'Owner',          className: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300' },
  admin:           { label: 'Admin',           className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300' },
  'practice-admin':{ label: 'Practice Admin',  className: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-300' },
  provider:             { label: 'Provider',             className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300' },
};

function getInitials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return '?';
}

function formatJoinedDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Joined today';
  if (diffDays === 1) return 'Joined yesterday';
  if (diffDays < 30) return `Joined ${diffDays}d ago`;
  return `Joined ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export default function TeamPage() {
  const { orgContext, isLoading: orgLoading } = useOrgCtx();
  const { user } = useUser();
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [selectedMembershipId, setSelectedMembershipId] = React.useState<Id<'memberships'> | null>(null);
  const [memberToRemove, setMemberToRemove] = React.useState<{ id: Id<'memberships'>; name: string } | null>(null);
  const [invitationToCancel, setInvitationToCancel] = React.useState<{ id: Id<'invitations'>; email: string } | null>(null);

  const members = useQuery(
    api.memberships.getByOrgWithUserInfo,
    orgContext ? { orgId: orgContext.orgId as Id<'organizations'> } : 'skip'
  );

  const invitations = useQuery(
    api.invitations.getByOrg,
    orgContext ? { orgId: orgContext.orgId as Id<'organizations'> } : 'skip'
  );

  const deactivateMember = useAction(api.memberships.deactivateWithClerkSync);
  const cancelInvitation = useMutation(api.invitations.cancel);

  const handleRemoveMember = async (membershipId: Id<'memberships'>) => {
    setRemovingId(membershipId);
    try {
      await deactivateMember({ membershipId });
    } catch (error) {
      console.error('Failed to remove member:', error);
    } finally {
      setRemovingId(null);
      setMemberToRemove(null);
    }
  };

  const handleCancelInvitation = async (invitationId: Id<'invitations'>) => {
    try {
      await cancelInvitation({ invitationId });
    } catch (error) {
      console.error('Failed to cancel invitation:', error);
    } finally {
      setInvitationToCancel(null);
    }
  };

  if (orgLoading || members === undefined || invitations === undefined) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  const activeMembers = members?.filter((m) => m.status === 'active') || [];
  const pendingInvitations = invitations?.filter((i) => i.status === 'pending') || [];
  const totalSeats = activeMembers.length + pendingInvitations.length;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <AppLink
            href="/settings"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Settings
          </AppLink>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Team</h1>
              <p className="text-muted-foreground mt-1">
                {totalSeats} / {orgContext?.maxProviderSeats || 0} seats used
              </p>
            </div>
            {orgContext?.canManageTeam && (
              <button
                onClick={() => setInviteOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <UserPlus className="h-4 w-4" />
                Invite
              </button>
            )}
          </div>
        </div>

        {/* Active Members */}
        {activeMembers.length === 0 && pendingInvitations.length === 0 ? (
          <EmptyState
            icon={Users}
            title={
              orgContext?.role === 'practice-admin'
                ? 'No team members at your location yet'
                : 'Build your team'
            }
            description={
              orgContext?.role === 'practice-admin'
                ? 'As a Practice Admin, you can invite providers to your location.'
                : 'Invite team members to collaborate on patient care and manage your practice together.'
            }
            features={
              orgContext?.role !== 'practice-admin'
                ? [
                    'Invite providers, admins, and practice managers',
                    'Assign roles and permissions',
                    'Manage team access by location',
                    'Track team activity and performance',
                  ]
                : undefined
            }
            action={
              orgContext?.canManageTeam
                ? { label: 'Invite Team Member', onClick: () => setInviteOpen(true) }
                : undefined
            }
            size="large"
          />
        ) : (
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-3">
              <Users className="h-4 w-4" />
              Active ({activeMembers.length})
            </h2>
            {activeMembers.map((member) => {
              const role = member.role as keyof typeof ROLE_BADGES;
              const badge = ROLE_BADGES[role] || ROLE_BADGES.provider;
              const isCurrentUser = member.userId === user?.id;
              const isRemoving = removingId === member._id;
              const displayName = member.userName || member.userEmail || member.userId;

              return (
                <div
                  key={member._id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/30 transition-colors"
                >
                  {/* Initials avatar */}
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-primary">
                      {getInitials(member.userName, member.userEmail)}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">
                        {displayName}
                        {isCurrentUser && (
                          <span className="text-xs text-muted-foreground ml-1.5">(You)</span>
                        )}
                      </p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full border flex-shrink-0 ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {member.locationIds && member.locationIds.length > 0 && (
                        <span>{member.locationIds.length} location{member.locationIds.length !== 1 ? 's' : ''} · </span>
                      )}
                      {member.joinedAt ? formatJoinedDate(member.joinedAt) : null}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {orgContext?.canManageTeam && (
                      <button
                        onClick={() => setSelectedMembershipId(member._id)}
                        className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors"
                        title="Edit member"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                    )}
                    {orgContext?.canManageTeam && !isCurrentUser && (
                      <button
                        onClick={() => setMemberToRemove({ id: member._id, name: displayName })}
                        disabled={isRemoving}
                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors disabled:opacity-50"
                        title="Remove member"
                      >
                        {isRemoving
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Trash2 className="h-4 w-4" />
                        }
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pending Invitations */}
        {pendingInvitations.length > 0 && (
          <div className="space-y-2 mt-6">
            <h2 className="text-sm font-medium text-muted-foreground mb-3">
              Pending Invitations ({pendingInvitations.length})
            </h2>
            {pendingInvitations.map((invitation) => (
              <div
                key={invitation._id}
                className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-border"
              >
                <div className="h-9 w-9 rounded-full bg-muted/50 flex items-center justify-center flex-shrink-0">
                  <UserPlus className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{invitation.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Invited by {invitation.inviterName} · {new Date(invitation.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                    Pending
                  </span>
                  {orgContext?.canManageTeam && (
                    <button
                      onClick={() => setInvitationToCancel({ id: invitation._id, email: invitation.email })}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                      title="Cancel invitation"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Invite Dialog */}
        <InviteDialog
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          maxSeats={orgContext?.maxProviderSeats || 1}
          currentSeats={totalSeats}
        />

        {/* Member Detail Modal */}
        <MemberDetailModal
          open={!!selectedMembershipId}
          onClose={() => setSelectedMembershipId(null)}
          membershipId={selectedMembershipId}
          orgId={orgContext?.orgId as Id<'organizations'>}
          currentUserRole={orgContext?.role || 'provider'}
        />

        {/* Remove member confirmation */}
        <AlertDialog open={!!memberToRemove} onOpenChange={(open) => { if (!open) setMemberToRemove(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove team member?</AlertDialogTitle>
              <AlertDialogDescription>
                {memberToRemove?.name} will lose access to the organisation immediately. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => memberToRemove && handleRemoveMember(memberToRemove.id)}
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Cancel invitation confirmation */}
        <AlertDialog open={!!invitationToCancel} onOpenChange={(open) => { if (!open) setInvitationToCancel(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel invitation?</AlertDialogTitle>
              <AlertDialogDescription>
                The invitation to {invitationToCancel?.email} will be revoked and the link will no longer work.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => invitationToCancel && handleCancelInvitation(invitationToCancel.id)}
              >
                Cancel invitation
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
