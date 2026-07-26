export default ({ env }: { env: (key: string, fallback?: any) => any }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  app: { keys: env.array('APP_KEYS', ['iwage-key-1', 'iwage-key-2']) },
  url: env('STRAPI_URL', 'http://localhost:1337'),
});
