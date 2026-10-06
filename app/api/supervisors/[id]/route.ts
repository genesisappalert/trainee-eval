import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import connectDB from '@/lib/db';
import { User, AuditLog } from '@/lib/models';
import bcrypt from 'bcryptjs';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userRoles = (session.user as any).roles || [];
    if (!userRoles.includes('hr_admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ error: 'Supervisor not found' }, { status: 404 });
    }

    if (action === 'regenerate_access_code') {
      const rand = Math.floor(100000 + Math.random() * 900000);
      const newCode = body.customCode?.trim().toUpperCase() || `SUP-${rand}`;
      user.accessCode = newCode;
      user.failedLogins = 0;
      user.lockedUntil = null;
      await user.save();

      await AuditLog.create({
        actorId: session.user.id,
        actorRole: 'hr_admin',
        action: 'supervisor_access_code_regenerated',
        targetType: 'user',
        targetId: user._id.toString(),
        metadata: { staffId: user.staffId, accessCode: newCode },
      });

      return NextResponse.json({
        success: true,
        message: 'Access code regenerated successfully',
        accessCode: newCode,
      });
    }

    if (action === 'reset_password') {
      const tempPassword = 'Genesis' + Math.floor(1000 + Math.random() * 9000) + '!';
      const passwordHash = await bcrypt.hash(tempPassword, 10);
      user.passwordHash = passwordHash;
      user.mustChangePassword = true;
      user.failedLogins = 0;
      user.lockedUntil = null;
      await user.save();

      await AuditLog.create({
        actorId: session.user.id,
        actorRole: 'hr_admin',
        action: 'supervisor_password_reset',
        targetType: 'user',
        targetId: user._id.toString(),
        metadata: { staffId: user.staffId },
      });

      return NextResponse.json({
        success: true,
        message: 'Password reset successfully',
        tempPassword,
      });
    }

    if (action === 'unlock') {
      user.failedLogins = 0;
      user.lockedUntil = null;
      await user.save();

      await AuditLog.create({
        actorId: session.user.id,
        actorRole: 'hr_admin',
        action: 'supervisor_unlocked',
        targetType: 'user',
        targetId: user._id.toString(),
      });

      return NextResponse.json({ success: true, message: 'Account unlocked' });
    }

    if (action === 'toggle_active') {
      user.active = !user.active;
      await user.save();

      await AuditLog.create({
        actorId: session.user.id,
        actorRole: 'hr_admin',
        action: user.active ? 'supervisor_activated' : 'supervisor_deactivated',
        targetType: 'user',
        targetId: user._id.toString(),
      });

      return NextResponse.json({ success: true, active: user.active });
    }

    // Update profile
    if (body.name) user.name = body.name.trim();
    if (body.department) user.department = body.department.trim();
    if (body.location) user.location = body.location.trim();
    await user.save();

    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    console.error('Error updating supervisor:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
