import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import connectDB from '@/lib/db';
import { User, AuditLog } from '@/lib/models';
import bcrypt from 'bcryptjs';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const callerId = session.user.id;

    await connectDB();
    const dbCaller = await User.findById(callerId);
    const callerRoles = dbCaller ? Array.from(dbCaller.roles).map(String) : (((session.user as any).roles as string[]) || []);
    const isCallerSuperAdmin = callerRoles.includes('superadmin');
    const isCallerHrAdmin = callerRoles.includes('hr_admin');

    if (!isCallerSuperAdmin && !isCallerHrAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    const targetUser = await User.findById(id);
    if (!targetUser) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    // Protection: If target is a superadmin, only a superadmin can modify them
    if (targetUser.roles.includes('superadmin') && !isCallerSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Only Superadmins can modify Superadmin accounts.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const updates: Record<string, any> = {};

    // 1. Active status toggle
    if (typeof body.active === 'boolean') {
      // Prevent self-deactivation
      if (targetUser._id.toString() === callerId && body.active === false) {
        return NextResponse.json(
          { error: 'You cannot deactivate your own administrative account.' },
          { status: 400 }
        );
      }

      // Prevent deactivating the last active superadmin
      if (targetUser.roles.includes('superadmin') && body.active === false) {
        const activeSuperAdminCount = await User.countDocuments({
          roles: 'superadmin',
          active: true,
          _id: { $ne: targetUser._id },
        });
        if (activeSuperAdminCount === 0) {
          return NextResponse.json(
            { error: 'Cannot deactivate the sole active Superadmin in the system.' },
            { status: 400 }
          );
        }
      }

      updates.active = body.active;
    }

    // 2. Password Reset
    if (body.password) {
      if (body.password.length < 6) {
        return NextResponse.json(
          { error: 'Password must be at least 6 characters long.' },
          { status: 400 }
        );
      }
      updates.passwordHash = await bcrypt.hash(body.password, 10);
      updates.failedLogins = 0;
      updates.lockedUntil = null;
    }

    // 3. Unlock account
    if (body.unlock) {
      updates.failedLogins = 0;
      updates.lockedUntil = null;
    }

    // 4. Name / Department / Location updates
    if (body.name?.trim()) updates.name = body.name.trim();
    if (body.department?.trim()) updates.department = body.department.trim();
    if (body.location?.trim()) updates.location = body.location.trim();

    // 5. Role updates (Only superadmin can promote/demote superadmin role)
    if (body.role) {
      if (!isCallerSuperAdmin) {
        return NextResponse.json(
          { error: 'Only Superadmins can modify administrator roles.' },
          { status: 403 }
        );
      }
      if (body.role === 'superadmin' && !targetUser.roles.includes('superadmin')) {
        targetUser.roles.push('superadmin');
        if (!targetUser.roles.includes('hr_admin')) targetUser.roles.push('hr_admin');
        updates.roles = targetUser.roles;
      } else if (body.role === 'hr_admin' && targetUser.roles.includes('superadmin')) {
        // Prevent demoting the last superadmin
        const superAdminCount = await User.countDocuments({
          roles: 'superadmin',
          active: true,
          _id: { $ne: targetUser._id },
        });
        if (superAdminCount === 0) {
          return NextResponse.json(
            { error: 'Cannot demote the sole active Superadmin.' },
            { status: 400 }
          );
        }
        updates.roles = targetUser.roles.filter((r) => r !== 'superadmin');
      }
    }

    const updated = await User.findByIdAndUpdate(id, { $set: updates }, { new: true }).select('-passwordHash');

    // Audit log
    await AuditLog.create({
      actorId: callerId,
      actorRole: isCallerSuperAdmin ? 'superadmin' : 'hr_admin',
      action: 'admin_updated',
      targetType: 'user',
      targetId: id,
      metadata: {
        targetStaffId: targetUser.staffId,
        updatedFields: Object.keys(updates),
      },
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (error: any) {
    console.error('Error updating admin:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const callerId = session.user.id;

    await connectDB();
    const dbCaller = await User.findById(callerId);
    const callerRoles = dbCaller ? Array.from(dbCaller.roles).map(String) : (((session.user as any).roles as string[]) || []);
    const isCallerSuperAdmin = callerRoles.includes('superadmin');

    // Only superadmins can delete or deactivate admin accounts completely
    if (!isCallerSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Only Superadmins can remove administrators.' },
        { status: 403 }
      );
    }

    if (id === callerId) {
      return NextResponse.json(
        { error: 'You cannot remove your own administrative account.' },
        { status: 400 }
      );
    }
    const targetUser = await User.findById(id);
    if (!targetUser) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    // Check if last superadmin
    if (targetUser.roles.includes('superadmin')) {
      const activeSuperAdminCount = await User.countDocuments({
        roles: 'superadmin',
        active: true,
        _id: { $ne: targetUser._id },
      });
      if (activeSuperAdminCount === 0) {
        return NextResponse.json(
          { error: 'Cannot delete the sole active Superadmin in the system.' },
          { status: 400 }
        );
      }
    }

    // Permanently remove administrator record
    await User.findByIdAndDelete(id);

    await AuditLog.create({
      actorId: callerId,
      actorRole: 'superadmin',
      action: 'admin_deleted',
      targetType: 'user',
      targetId: id,
      metadata: {
        deletedStaffId: targetUser.staffId,
        deletedName: targetUser.name,
        deletedEmail: targetUser.email,
        deletedRoles: targetUser.roles,
      },
    });

    return NextResponse.json({ success: true, message: 'Administrator permanently deleted.' });
  } catch (error: any) {
    console.error('Error removing admin:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
