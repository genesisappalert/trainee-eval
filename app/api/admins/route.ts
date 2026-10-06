import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import connectDB from '@/lib/db';
import { User, AuditLog } from '@/lib/models';
import bcrypt from 'bcryptjs';

function generateAccessCode(): string {
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `SUP-${rand}`;
}

// GET: List all administrators (superadmins and hr_admins)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const callerId = session.user.id;
    const dbCaller = await User.findById(callerId);
    const callerRoles = dbCaller ? Array.from(dbCaller.roles).map(String) : (((session.user as any).roles as string[]) || []);
    const callerIsSuperAdmin = callerRoles.includes('superadmin');

    if (!callerRoles.includes('superadmin') && !callerRoles.includes('hr_admin')) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const admins = await User.find({
      roles: { $in: ['superadmin', 'hr_admin'] },
    })
      .select('-passwordHash')
      .sort({ createdAt: -1 });

    const formatted = admins.map((a) => ({
      _id: a._id.toString(),
      staffId: a.staffId,
      name: a.name,
      email: a.email,
      department: a.department,
      location: a.location,
      roles: a.roles,
      accessCode: a.accessCode || null,
      active: a.active,
      lockedUntil: a.lockedUntil,
      mustChangePassword: a.mustChangePassword,
      createdAt: a.createdAt,
    }));

    return NextResponse.json({
      admins: formatted,
      callerIsSuperAdmin: callerRoles.includes('superadmin'),
    });
  } catch (error: any) {
    console.error('Error fetching admins:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create a new Administrator or Superadmin
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const callerId = session.user.id;
    const dbCaller = await User.findById(callerId);
    const callerRoles = dbCaller ? Array.from(dbCaller.roles).map(String) : (((session.user as any).roles as string[]) || []);
    const isSuperAdmin = callerRoles.includes('superadmin');
    const isHrAdmin = callerRoles.includes('hr_admin');

    if (!isSuperAdmin && !isHrAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admin privileges required' }, { status: 403 });
    }

    const body = await request.json();

    const {
      staffId,
      name,
      email,
      department,
      location,
      role = 'hr_admin',
      password,
      isSupervisorAlso = false,
    } = body;

    // Validation
    if (!staffId || !name || !email || !password) {
      return NextResponse.json(
        { error: 'Staff ID, Full Name, Email, and Password are required.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    const normalizedRole = role === 'superadmin' ? 'superadmin' : 'hr_admin';

    // RBAC: Only Superadmins can create other Superadmins!
    if (normalizedRole === 'superadmin' && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Only Superadmins can create other Superadmins.' },
        { status: 403 }
      );
    }

    const cleanStaffId = staffId.trim().toUpperCase();
    const cleanEmail = email.trim().toLowerCase();

    // Check uniqueness
    const existing = await User.findOne({
      $or: [{ staffId: cleanStaffId }, { email: cleanEmail }],
    });

    if (existing) {
      const conflictField = existing.staffId === cleanStaffId ? 'Staff ID' : 'Email address';
      return NextResponse.json(
        { error: `An account with this ${conflictField} already exists.` },
        { status: 409 }
      );
    }

    // Prepare roles
    const assignedRoles: ('supervisor' | 'hr_admin' | 'hr_viewer' | 'superadmin')[] = [normalizedRole];
    if (normalizedRole === 'superadmin' && !assignedRoles.includes('hr_admin')) {
      // Superadmins also inherit HR admin privileges
      assignedRoles.push('hr_admin');
    }
    if (isSupervisorAlso && !assignedRoles.includes('supervisor')) {
      assignedRoles.push('supervisor');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const accessCode = isSupervisorAlso ? generateAccessCode() : null;

    const newUser = await User.create({
      staffId: cleanStaffId,
      name: name.trim(),
      email: cleanEmail,
      department: department?.trim() || 'Human Resources',
      location: location?.trim() || 'HQ Port Harcourt',
      roles: assignedRoles,
      accessCode,
      passwordHash,
      mustChangePassword: false,
      active: true,
    });

    // Record Audit Log
    await AuditLog.create({
      actorId: session.user.id,
      actorRole: isSuperAdmin ? 'superadmin' : 'hr_admin',
      action: normalizedRole === 'superadmin' ? 'superadmin_created' : 'hr_admin_created',
      targetType: 'user',
      targetId: newUser._id.toString(),
      metadata: {
        createdStaffId: newUser.staffId,
        createdName: newUser.name,
        createdEmail: newUser.email,
        assignedRoles,
        creatorStaffId: (session.user as any).staffId || session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        _id: newUser._id.toString(),
        staffId: newUser.staffId,
        name: newUser.name,
        email: newUser.email,
        department: newUser.department,
        location: newUser.location,
        roles: newUser.roles,
        accessCode: newUser.accessCode,
        active: newUser.active,
        createdAt: newUser.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Error creating admin:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
