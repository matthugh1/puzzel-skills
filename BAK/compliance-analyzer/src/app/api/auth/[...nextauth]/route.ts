import NextAuth, { type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getUserByEmailWithCredentials } from '@shared/database';
import bcrypt from 'bcryptjs';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        userId: { label: 'User ID', type: 'text' },
        sso: { label: 'SSO', type: 'text' },
      },
      async authorize(credentials) {
        console.log('[NextAuth] authorize called, sso:', credentials?.sso, 'userId:', credentials?.userId, 'email:', credentials?.email);
        
        // Support SSO flow (token-based from platform-core)
        if (credentials?.sso === 'true' && credentials?.userId && credentials?.email) {
          // SSO flow: trust the userId/email from platform-core token
          try {
            console.log('[NextAuth] SSO flow, fetching user:', credentials.email);
            const user = await getUserByEmailWithCredentials(credentials.email as string);
            console.log('[NextAuth] User found:', !!user, 'user.id:', user?.id, 'expected userId:', credentials.userId);
            
            if (!user || user.id !== credentials.userId) {
              console.error('[NextAuth] User mismatch or not found');
              return null;
            }
            
            console.log('[NextAuth] SSO authentication successful for user:', user.id);
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              image: user.image,
            };
          } catch (error) {
            console.error('[NextAuth] SSO authentication error:', error);
            return null;
          }
        }

        // Regular credentials flow
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const user = await getUserByEmailWithCredentials(credentials.email);

          if (!user || !user.passwordHash) {
            return null;
          }

          const isValid = await bcrypt.compare(
            credentials.password,
            user.passwordHash
          );

          if (!isValid) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
          };
        } catch (error) {
          console.error('Authentication error:', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user && user.id && user.email) {
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id && token.email) {
        (session.user as any).id = token.id as string;
        (session.user as any).email = token.email as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET,
  // Share cookies with platform-core for seamless authentication
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' 
        ? '__Secure-next-auth.session-token' 
        : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        // Note: In production, set domain to share across subdomains if needed
        // domain: '.yourdomain.com'
      },
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
