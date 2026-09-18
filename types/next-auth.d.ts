import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User { role?: 'admin' | 'customer'; }
  interface Session { user: User & { role?: 'admin' | 'customer' }; }
}

declare module 'next-auth/jwt' {
  interface JWT { role?: 'admin' | 'customer'; }
}
