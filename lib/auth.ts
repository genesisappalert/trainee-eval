import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import connectDB from './db';
import { User } from './models';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: 'Staff Login',
      credentials: {
        accessCode: { label: 'Access Code', type: 'text' },
        staffId: { label: 'Staff ID', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        await connectDB();

        // Flow A: Supervisor Access Code
        if (credentials?.accessCode) {
          const rawCode = String(credentials.accessCode).trim().toUpperCase();
          if (!rawCode) return null;

          const user = await User.findOne({
            accessCode: rawCode,
            active: true,
          });

          if (!user) return null;

          if (user.lockedUntil && user.lockedUntil > new Date()) {
            return null;
          }

          if (user.failedLogins > 0 || user.lockedUntil) {
            await User.updateOne(
              { _id: user._id },
              { $set: { failedLogins: 0, lockedUntil: null } }
            );
          }

          const rolesList = Array.from(user.roles || []).map(String);
          return {
            id: user._id.toString(),
            name: String(user.name),
            email: String(user.email),
            staffId: String(user.staffId),
            roles: rolesList,
            mustChangePassword: false,
          };
        }

        // Flow B: Staff ID + Password (for HR Admins)
        if (!credentials?.staffId || !credentials?.password) return null;

        const user = await User.findOne({
          staffId: String(credentials.staffId).trim().toUpperCase(),
          active: true,
        });

        if (!user) return null;

        // Check lockout (S-3: 15 minute lockout after 5 failures)
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValid) {
          const updates: Record<string, unknown> = {
            failedLogins: user.failedLogins + 1,
          };
          if (user.failedLogins + 1 >= 5) {
            updates.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
          }
          await User.updateOne({ _id: user._id }, { $set: updates });
          return null;
        }

        // Reset failed logins on success
        await User.updateOne(
          { _id: user._id },
          { $set: { failedLogins: 0, lockedUntil: null } }
        );

        const rolesList = Array.from(user.roles || []).map(String);
        return {
          id: user._id.toString(),
          name: String(user.name),
          email: String(user.email),
          staffId: String(user.staffId),
          roles: rolesList,
          mustChangePassword: Boolean(user.mustChangePassword),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.staffId = (user as any).staffId;
        token.roles = Array.isArray((user as any).roles) ? [...(user as any).roles] : [];
        token.mustChangePassword = (user as any).mustChangePassword;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as unknown as Record<string, unknown>).staffId = token.staffId;
        (session.user as unknown as Record<string, unknown>).roles = Array.isArray(token.roles) ? [...token.roles] : [];
        (session.user as unknown as Record<string, unknown>).mustChangePassword = token.mustChangePassword;

        // Fetch fresh roles from DB if available so promoted roles reflect immediately
        try {
          if (token.id) {
            await connectDB();
            const dbUser = await User.findById(token.id).select('roles');
            if (dbUser?.roles) {
              (session.user as unknown as Record<string, unknown>).roles = Array.from(dbUser.roles).map(String);
            }
          }
        } catch {
          // Fall back to token.roles if DB connection fails
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // S-4: 8 hours
  },
});
