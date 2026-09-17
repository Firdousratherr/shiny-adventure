import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { db } from './lib/db';
import { rateLimit } from './lib/rate-limit';

// A fixed bcrypt hash keeps unknown-user and known-user failures closer in cost.
const DUMMY_PASSWORD_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.OYx2g8qQ6QxQyV9hV4vR8kV5m3Q5mK2';

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  providers: [Credentials({
    credentials: { email: {}, password: {} },
    async authorize(c, request) {
      const email = String(c?.email || '').toLowerCase().trim();
      const password = String(c?.password || '');
      if (!email || !password) return null;

      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip')
        || 'unknown';
      const limited = await rateLimit(`admin-login:${ip}`, 8, 600);
      if (process.env.NODE_ENV === 'production' && !limited.configured) return null;
      if (limited.limited) return null;

      const admin = await db.adminUser.findUnique({ where: { email } });
      const passwordHash = admin?.passwordHash || DUMMY_PASSWORD_HASH;
      const valid = await bcrypt.compare(password, passwordHash);
      if (!admin || !valid) return null;
      return { id: admin.id, email: admin.email };
    },
  })],
  pages: { signIn: '/admin/login' },
});
