import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { db } from './lib/db';
import { rateLimit } from './lib/rate-limit';

type UserRole = 'admin' | 'customer';
const DUMMY_PASSWORD_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.OYx2g8qQ6QxQyV9hV4vR8kV5m3Q5mK2';

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  providers: [
    Credentials({
      credentials: { email: {}, password: {}, role: {} },
      async authorize(c, request) {
        const email = String(c?.email || '').toLowerCase().trim();
        const password = String(c?.password || '');
        const role: UserRole = c?.role === 'admin' ? 'admin' : 'customer';
        if (!email || !password) return null;

        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
        const limited = await rateLimit(`${role}-login:${ip}`, 8, 600);
        if (process.env.NODE_ENV === 'production' && !limited.configured) return null;
        if (limited.limited) return null;

        if (role === 'admin') {
          const configuredEmail = String(process.env.ADMIN_EMAIL || '').toLowerCase().trim();
          const configuredPassword = process.env.ADMIN_PASSWORD || '';
          const admin = await db.adminUser.findUnique({ where: { email } });
          if (configuredEmail && configuredPassword && email === configuredEmail && password === configuredPassword) {
            const passwordHash = await bcrypt.hash(configuredPassword, 12);
            const synced = await db.adminUser.upsert({ where: { email: configuredEmail }, update: { passwordHash }, create: { email: configuredEmail, passwordHash } });
            return { id: synced.id, email: synced.email, name: 'Administrator', role: 'admin' };
          }
          const passwordHash = admin?.passwordHash || DUMMY_PASSWORD_HASH;
          const valid = await bcrypt.compare(password, passwordHash);
          if (!admin || !valid) return null;
          return { id: admin.id, email: admin.email, name: 'Administrator', role: 'admin' };
        }

        const customer = await db.customerUser.findUnique({ where: { email } });
        const passwordHash = customer?.passwordHash || DUMMY_PASSWORD_HASH;
        const valid = await bcrypt.compare(password, passwordHash);
        if (!customer || !valid) return null;
        return { id: customer.id, email: customer.email, name: customer.name, role: 'customer' };
      },
    }),
    Google,
  ],
  pages: { signIn: '/login' },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== 'google') return true;
      const email = String(user.email || '').toLowerCase().trim();
      const name = String(user.name || 'Zenvora Customer').trim().slice(0, 80) || 'Zenvora Customer';
      if (!email) return false;

      // Only accept Google's verified email claim for customer authentication.
      if (profile && 'email_verified' in profile && profile.email_verified !== true) return false;

      // Never let Google create a customer account using an existing admin email.
      const admin = await db.adminUser.findUnique({ where: { email } });
      if (admin) return false;

      const existing = await db.customerUser.findUnique({ where: { email } });
      const passwordHash = existing?.passwordHash || await bcrypt.hash(randomBytes(32).toString('hex'), 12);
      await db.customerUser.upsert({
        where: { email },
        update: { name },
        create: { email, name, passwordHash },
      });
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        if (account?.provider === 'google') {
          const email = String(user.email || '').toLowerCase().trim();
          const customer = email ? await db.customerUser.findUnique({ where: { email }, select: { id: true, name: true, email: true } }) : null;
          if (customer) {
            token.sub = customer.id;
            token.email = customer.email;
            token.name = customer.name;
            token.role = 'customer';
          }
        } else {
          token.role = (user as { role?: UserRole }).role;
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) (session.user as { role?: UserRole }).role = token.role;
      return session;
    },
  },
});
