import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { db } from './lib/db';
import { rateLimit } from './lib/rate-limit';

const DUMMY_PASSWORD_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.OYx2g8qQ6QxQyV9hV4vR8kV5m3Q5mK2';

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  providers: [Credentials({
    credentials: { email: {}, password: {}, role: {} },
    async authorize(c, request) {
      const email = String(c?.email || '').toLowerCase().trim();
      const password = String(c?.password || '');
      const role = String(c?.role || 'customer');
      if (!email || !password) return null;

      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
      const limited = await rateLimit(`${role}-login:${ip}`, 8, 600);
      if (process.env.NODE_ENV === 'production' && !limited.configured) return null;
      if (limited.limited) return null;

      if (role === 'admin') {
        const admin = await db.adminUser.findUnique({ where: { email } });
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
  })],
  pages: { signIn: '/login' },
  callbacks: {
    jwt({ token, user }) {
      if (user) token.role = (user as { role?: string }).role;
      return token;
    },
    session({ session, token }) {
      if (session.user) (session.user as { role?: string }).role = token.role as string | undefined;
      return session;
    },
  },
});