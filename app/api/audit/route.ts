import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { auth } from '@/lib/auth';
import connectDB from '@/lib/db';
import { AuditLog, User } from '@/lib/models';

function formatHumanNarrative(
  log: any,
  actorName: string,
  targetName: string
): { actionLabel: string; summary: string; category: string } {
  const meta = log.metadata || {};

  switch (log.action) {
    case 'superadmin_created':
      return {
        actionLabel: 'Provisioned Superadmin',
        category: 'governance',
        summary: `Created Superadmin account for ${meta.createdName || targetName || 'Administrator'} (Staff ID: ${meta.createdStaffId || 'N/A'}${meta.createdEmail ? `, ${meta.createdEmail}` : ''}) with full system authority.`,
      };

    case 'hr_admin_created':
      return {
        actionLabel: 'Created HR Administrator',
        category: 'governance',
        summary: `Provisioned HR Administrator account for ${meta.createdName || targetName || 'Administrator'} (Staff ID: ${meta.createdStaffId || 'N/A'}).`,
      };

    case 'admin_created':
      return {
        actionLabel: 'Created Administrator',
        category: 'governance',
        summary: `Created administrative profile for ${meta.createdName || targetName || 'Administrator'} (Staff ID: ${meta.createdStaffId || 'N/A'}).`,
      };

    case 'admin_deleted':
      return {
        actionLabel: 'Permanently Deleted Admin',
        category: 'governance',
        summary: `Permanently removed administrator ${meta.deletedName || targetName || 'Account'} (Staff ID: ${meta.deletedStaffId || 'N/A'}) from the system.`,
      };

    case 'admin_deactivated':
      return {
        actionLabel: 'Deactivated Administrator',
        category: 'governance',
        summary: `Suspended administrative login access for ${targetName || meta.targetStaffId || 'Administrator'}.`,
      };

    case 'admin_updated': {
      const fields = Array.isArray(meta.updatedFields) ? meta.updatedFields : [];
      if (fields.includes('active')) {
        return {
          actionLabel: 'Changed Account Status',
          category: 'governance',
          summary: `Toggled active access status (Deactivated/Reactivated) for ${meta.targetStaffId || targetName}.`,
        };
      }
      if (fields.includes('passwordHash')) {
        return {
          actionLabel: 'Reset Admin Password',
          category: 'governance',
          summary: `Reset login credentials for ${meta.targetStaffId || targetName}.`,
        };
      }
      return {
        actionLabel: 'Updated Administrator',
        category: 'governance',
        summary: `Updated profile attributes (${fields.join(', ') || 'settings'}) for ${meta.targetStaffId || targetName}.`,
      };
    }

    case 'supervisors_bulk_created':
      return {
        actionLabel: 'Bulk Imported Supervisors',
        category: 'supervisors',
        summary: `Uploaded ${meta.count ?? 'multiple'} supervisor accounts via CSV import (${meta.errorsCount ?? 0} errors).`,
      };

    case 'supervisor_created':
      return {
        actionLabel: 'Created Supervisor',
        category: 'supervisors',
        summary: `Provisioned supervisor profile for ${meta.name || targetName} (Staff ID: ${meta.staffId || 'N/A'}). Generated access code.`,
      };

    case 'supervisor_code_regenerated':
      return {
        actionLabel: 'Regenerated Access Code',
        category: 'supervisors',
        summary: `Generated a fresh login access key for supervisor ${meta.staffId || targetName}.`,
      };

    case 'supervisor_sheet_submitted':
      return {
        actionLabel: 'Supervisor Appraisal Submitted',
        category: 'appraisal',
        summary: `Supervisor submitted official performance assessment rating. Overall score: ${meta.score ?? meta.overall ?? 'Recorded'}.`,
      };

    case 'supervisor_reassigned':
      return {
        actionLabel: 'Flagged for Reassignment',
        category: 'reassignment',
        summary: `Supervisor flagged appraisal as "Not Mine" and requested reassignment. Reason: ${meta.reason || 'Unspecified'}.`,
      };

    case 'supervisor_sheet_reopened':
      return {
        actionLabel: 'Reopened Supervisor Assessment',
        category: 'appraisal',
        summary: `HR unlocked supervisor evaluation sheet for updates. Reason: ${meta.reason || 'Revision needed'}.`,
      };

    case 'trainee_sheet_reopened':
      return {
        actionLabel: 'Reopened Trainee Submission',
        category: 'appraisal',
        summary: `HR unlocked self-appraisal form to allow trainee to revise their responses.`,
      };

    case 'trainee_link_reissued':
      return {
        actionLabel: 'Reissued Trainee Link',
        category: 'appraisal',
        summary: `Re-sent confidential appraisal form link to trainee ${meta.email ? `(${meta.email})` : ''}.`,
      };

    case 'cycle_created':
      return {
        actionLabel: 'Created Appraisal Cycle',
        category: 'cycle',
        summary: `Created and configured new appraisal cycle: "${meta.name || targetName}" (${meta.cohort || ''}).`,
      };

    case 'cycle_status_changed':
      return {
        actionLabel: 'Changed Cycle Status',
        category: 'cycle',
        summary: `Appraisal cycle status changed from "${meta.oldStatus || 'draft'}" to "${meta.newStatus || 'open'}".`,
      };

    case 'system_initialized':
      return {
        actionLabel: 'System Initialized',
        category: 'system',
        summary: `Platform initialized with Genesis MTP templates, rating criteria, and default admin configuration.`,
      };

    default: {
      const readable = log.action
        .split('_')
        .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(' ');
      return {
        actionLabel: readable,
        category: 'system',
        summary: `System action "${readable}" performed on ${log.targetType || 'record'}.`,
      };
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userRoles = (session.user as any).roles || [];
    if (!userRoles.includes('hr_admin') && !userRoles.includes('superadmin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const actionFilter = searchParams.get('action');

    const query: any = {};
    if (actionFilter) {
      query.action = actionFilter;
    }

    const rawLogs = await AuditLog.find(query)
      .populate('cycleId', 'name slug')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Collect IDs for User Lookups (both actor and targets)
    const userIdsToFetch = new Set<string>();
    const staffIdsToFetch = new Set<string>();

    for (const log of rawLogs as any[]) {
      if (log.actorId && mongoose.Types.ObjectId.isValid(String(log.actorId))) {
        userIdsToFetch.add(String(log.actorId));
      }
      if (log.metadata?.creatorStaffId) staffIdsToFetch.add(String(log.metadata.creatorStaffId));
      if (log.metadata?.targetStaffId) staffIdsToFetch.add(String(log.metadata.targetStaffId));
      if (log.metadata?.createdStaffId) staffIdsToFetch.add(String(log.metadata.createdStaffId));
      if (log.targetType === 'user' && log.targetId && mongoose.Types.ObjectId.isValid(String(log.targetId))) {
        userIdsToFetch.add(String(log.targetId));
      }
    }

    const [usersById, usersByStaffId] = await Promise.all([
      userIdsToFetch.size > 0
        ? User.find({ _id: { $in: Array.from(userIdsToFetch) } })
            .select('name staffId email roles')
            .lean()
        : [],
      staffIdsToFetch.size > 0
        ? User.find({ staffId: { $in: Array.from(staffIdsToFetch) } })
            .select('name staffId email roles')
            .lean()
        : [],
    ]);

    const userMap = new Map<string, any>();
    usersById.forEach((u: any) => userMap.set(u._id.toString(), u));
    usersByStaffId.forEach((u: any) => userMap.set(u.staffId, u));

    // Enrich logs into plain-English human readable records
    const enrichedLogs = (rawLogs as any[]).map((log) => {
      const meta = log.metadata || {};

      // 1. Resolve Actor
      let actorUser = null;
      if (log.actorId) {
        actorUser = userMap.get(String(log.actorId));
      }
      if (!actorUser && meta.creatorStaffId) {
        actorUser = userMap.get(String(meta.creatorStaffId));
      }

      const actorName =
        actorUser?.name ||
        (meta.creatorStaffId ? `Staff ${meta.creatorStaffId}` : null) ||
        (log.actorRole === 'superadmin'
          ? 'System Superadmin'
          : log.actorRole === 'hr_admin'
          ? 'HR Administrator'
          : 'System Process');

      const actorStaffId = actorUser?.staffId || meta.creatorStaffId || '';
      const actorRoleLabel =
        log.actorRole === 'superadmin'
          ? 'Superadmin'
          : log.actorRole === 'hr_admin'
          ? 'HR Admin'
          : log.actorRole === 'supervisor'
          ? 'Supervisor'
          : 'System';

      // 2. Resolve Target
      let targetName = '';
      if (log.targetType === 'user' && log.targetId) {
        const targetUser = userMap.get(String(log.targetId));
        if (targetUser) {
          targetName = `${targetUser.name} (${targetUser.staffId})`;
        }
      }

      if (!targetName) {
        if (meta.createdName && meta.createdStaffId) {
          targetName = `${meta.createdName} (${meta.createdStaffId})`;
        } else if (meta.deletedName && meta.deletedStaffId) {
          targetName = `${meta.deletedName} (${meta.deletedStaffId})`;
        } else if (meta.targetStaffId) {
          const u = userMap.get(meta.targetStaffId);
          targetName = u ? `${u.name} (${u.staffId})` : meta.targetStaffId;
        } else if (meta.name && meta.staffId) {
          targetName = `${meta.name} (${meta.staffId})`;
        } else if (log.targetType) {
          targetName = `${log.targetType.toUpperCase()}`;
        }
      }

      // 3. Format Human Narrative
      const { actionLabel, summary, category } = formatHumanNarrative(log, actorName, targetName);

      return {
        _id: log._id.toString(),
        createdAt: log.createdAt || log.at,
        rawAction: log.action,
        actionLabel,
        category,
        summary,
        actor: {
          name: actorName,
          staffId: actorStaffId,
          role: actorRoleLabel,
          email: actorUser?.email || '',
        },
        target: {
          type: log.targetType || 'System',
          label: targetName || 'System Record',
          id: log.targetId || '',
        },
        cycle: log.cycleId ? { name: log.cycleId.name, slug: log.cycleId.slug } : null,
        metadata: log.metadata || {},
      };
    });

    return NextResponse.json({ logs: enrichedLogs });
  } catch (error: any) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
