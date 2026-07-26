export default ({ env }: { env: (key: string, fallback?: any) => any }) => ({
  auth: { secret: env('ADMIN_JWT_SECRET', 'iwage-admin-secret') },
  apiToken: { salt: env('API_TOKEN_SALT', 'iwage-api-salt') },
  transfer: { token: { salt: env('TRANSFER_TOKEN_SALT', 'iwage-transfer-salt') } },
});
