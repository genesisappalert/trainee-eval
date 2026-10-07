import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import connectDB from '@/lib/db';
import { User, Appraisal, AuditLog, Cycle } from '@/lib/models';
import bcrypt from 'bcryptjs';

function generateAccessCode(): string {
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `SUP-${rand}`;
}

// GET: List all supervisors
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const supervisors = await User.find({ roles: 'supervisor' })
      .select('-passwordHash')
      .sort({ name: 1 });

    // Count assigned trainees per supervisor
    const enriched = await Promise.all(
      supervisors.map(async (s) => {
        const assignedCount = await Appraisal.countDocuments({
          supervisorId: s._id,
          voidedAt: null,
        });
        const completedCount = await Appraisal.countDocuments({
          supervisorId: s._id,
          status: { $in: ['complete', 'printed'] },
          voidedAt: null,
        });

        return {
          _id: s._id.toString(),
          staffId: s.staffId,
          name: s.name,
          email: s.email,
          department: s.department,
          location: s.location,
          accessCode: s.accessCode || null,
          active: s.active,
          lockedUntil: s.lockedUntil,
          mustChangePassword: s.mustChangePassword,
          assignedCount,
          completedCount,
          createdAt: s.createdAt,
        };
      })
    );

    return NextResponse.json({ supervisors: enriched });
  } catch (error: any) {
    console.error('Error fetching supervisors:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Add new supervisor or bulk upload
export async function POST(request: NextRequest) {
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
    const body = await request.json();

    // Check if bulk upload
    if (Array.isArray(body.supervisors)) {
      const createdList: any[] = [];
      const errors: any[] = [];

      for (const [idx, item] of body.supervisors.entries()) {
        try {
          if (!item.staffId || !item.name || !item.email) {
            errors.push({ row: idx + 1, error: 'Staff ID, Name, and Email are required' });
            continue;
          }

          const existing = await User.findOne({
            $or: [{ staffId: item.staffId.trim().toUpperCase() }, { email: item.email.trim().toLowerCase() }],
          });
          if (existing) {
            errors.push({ row: idx + 1, staffId: item.staffId, error: 'Supervisor already exists' });
            continue;
          }

          const tempPassword = item.password || 'Genesis' + Math.floor(1000 + Math.random() * 9000) + '!';
          const passwordHash = await bcrypt.hash(tempPassword, 10);
          const accessCode = item.accessCode?.trim().toUpperCase() || generateAccessCode();

          const user = await User.create({
            staffId: item.staffId.trim().toUpperCase(),
            name: item.name.trim(),
            email: item.email.trim().toLowerCase(),
            department: item.department || '',
            location: item.location || '',
            roles: ['supervisor'],
            accessCode,
            passwordHash,
            mustChangePassword: false,
            active: true,
          });

          createdList.push({
            staffId: user.staffId,
            name: user.name,
            email: user.email,
            accessCode: user.accessCode,
          });
        } catch (e: any) {
          errors.push({ row: idx + 1, error: e.message });
        }
      }

      if (createdList.length > 0) {
        const createdUsers = await User.find({ staffId: { $in: createdList.map((c) => c.staffId) } }).select('_id');
        if (createdUsers.length > 0) {
          await Cycle.updateMany(
            { status: { $in: ['open', 'draft'] } },
            { $addToSet: { supervisorIds: { $each: createdUsers.map((u) => u._id) } } }
          );
        }
      }

      await AuditLog.create({
        actorId: session.user.id,
        actorRole: 'hr_admin',
        action: 'supervisors_bulk_created',
        targetType: 'user',
        targetId: 'bulk',
        metadata: { count: createdList.length, errorsCount: errors.length },
      });

      return NextResponse.json({
        success: true,
        created: createdList,
        errors,
      });
    }

    // Single supervisor creation
    const { staffId, name, email, department, location, password, customAccessCode } = body;
    if (!staffId || !name || !email) {
      return NextResponse.json({ error: 'Staff ID, Name, and Email are required.' }, { status: 400 });
    }

    const cleanStaffId = staffId.trim().toUpperCase();
    const cleanEmail = email.trim().toLowerCase();

    const existing = await User.findOne({
      $or: [{ staffId: cleanStaffId }, { email: cleanEmail }],
    });
    if (existing) {
      return NextResponse.json({ error: 'A user with this Staff ID or Email already exists.' }, { status: 400 });
    }

    const tempPassword = password || 'Genesis' + Math.floor(1000 + Math.random() * 9000) + '!';
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const accessCode = customAccessCode?.trim().toUpperCase() || generateAccessCode();

    const newUser = await User.create({
      staffId: cleanStaffId,
      name: name.trim(),
      email: cleanEmail,
      department: department || '',
      location: location || '',
      roles: ['supervisor'],
      accessCode,
      passwordHash,
      mustChangePassword: false,
      active: true,
    });

    await Cycle.updateMany(
      { status: { $in: ['open', 'draft'] } },
      { $addToSet: { supervisorIds: newUser._id } }
    );

    await AuditLog.create({
      actorId: session.user.id,
      actorRole: 'hr_admin',
      action: 'supervisor_created',
      targetType: 'user',
      targetId: newUser._id.toString(),
      metadata: { staffId: cleanStaffId, email: cleanEmail, accessCode },
    });

    return NextResponse.json({
      success: true,
      user: {
        _id: newUser._id.toString(),
        staffId: newUser.staffId,
        name: newUser.name,
        email: newUser.email,
        accessCode: newUser.accessCode,
      },
    });
  } catch (error: any) {
    console.error('Error creating supervisor:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
