export default ({ env }: { env: (key: string, fallback?: any) => any }) => ({
  'users-permissions': {
    config: {
      jwtSecret: env('JWT_SECRET', 'iwage-jwt-secret-change-me'),
    },
  },
});
