import AuthentikProvider from 'next-auth/providers/authentik';

export const REQUIRED_AUTH_ENV = [
  'AUTHENTIK_CLIENT_ID',
  'AUTHENTIK_CLIENT_SECRET',
  'AUTHENTIK_ISSUER',
  'NEXTAUTH_URL',
  'NEXTAUTH_SECRET',
];

export function configuredEnv(name) {
  return process.env[name] || `missing-${name.toLowerCase().replaceAll('_', '-')}`;
}

export function getMissingAuthEnvironment() {
  return REQUIRED_AUTH_ENV.filter(name => !process.env[name]);
}

export function assertAuthConfigured() {
  const missing = getMissingAuthEnvironment();

  if (missing.length > 0) {
    throw new Error(`Missing required auth environment variable(s): ${missing.join(', ')}`);
  }
}

export const authOptions = {
  providers: [
    AuthentikProvider({
      clientId: configuredEnv('AUTHENTIK_CLIENT_ID'),
      clientSecret: configuredEnv('AUTHENTIK_CLIENT_SECRET'),
      issuer: configuredEnv('AUTHENTIK_ISSUER'),
    }),
  ],
  secret: configuredEnv('NEXTAUTH_SECRET'),
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth/signin',
  },
};
