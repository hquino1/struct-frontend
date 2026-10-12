export type View = 'System architecture' | 'Dependencies' | 'Function calls' | 'Database schema' | 'API interactions' | 'Cloud infrastructure' | 'CI/CD workflows';
export type GraphNode = { id: string; name: string; tech: string; type: 'frontend' | 'service' | 'data' | 'external'; files: number; description: string; path: string; };
export const architectureNodes: GraphNode[] = [
  { id: 'web', name: 'Web Application', tech: 'Next.js · TypeScript', type: 'frontend', files: 86, description: 'The customer-facing storefront. Handles product discovery, shopping carts, and the checkout experience.', path: 'apps/web/src/app.tsx' },
  { id: 'admin', name: 'Admin Dashboard', tech: 'React · Vite', type: 'frontend', files: 42, description: 'Internal workspace for managing products, customers, and order fulfillment.', path: 'apps/admin/src/main.tsx' },
  { id: 'api', name: 'API Gateway', tech: 'Node.js · Express', type: 'service', files: 24, description: 'Central entry point for client requests. Routes traffic, validates authentication, and orchestrates services.', path: 'services/api/src/index.ts' },
  { id: 'auth', name: 'Auth Service', tech: 'JWT · Passport.js', type: 'service', files: 12, description: 'Manages user identity, session tokens, and authorization across the platform.', path: 'services/auth/src/auth.ts' },
  { id: 'orders', name: 'Order Service', tech: 'Node.js · TypeScript', type: 'service', files: 31, description: 'Coordinates order creation, inventory checks, and payment processing.', path: 'services/orders/src/orders.ts' },
  { id: 'db', name: 'PostgreSQL', tech: 'PostgreSQL · Prisma', type: 'data', files: 8, description: 'Primary relational store for customers, product inventory, and order history.', path: 'packages/database/schema.prisma' },
  { id: 'cache', name: 'Redis Cache', tech: 'Redis · ioredis', type: 'data', files: 5, description: 'Low-latency cache for sessions and frequently accessed product data.', path: 'packages/cache/src/redis.ts' },
  { id: 'stripe', name: 'Stripe', tech: 'Payments API', type: 'external', files: 6, description: 'External payment provider handling checkout sessions and payment webhooks.', path: 'services/payments/src/stripe.ts' },
];
export const edges: [number, number, string][] = [[0,2,'HTTPS'],[1,2,'REST'],[2,3,'JWT'],[2,5,'SQL'],[2,6,'Cache'],[3,6,'Session'],[2,4,'Internal'],[4,5,'Prisma'],[4,7,'Webhook']];
export const views: View[] = ['System architecture','Dependencies','Function calls','Database schema','API interactions','Cloud infrastructure','CI/CD workflows'];
const alternateNames: Partial<Record<View, [string,string][]>> = {
  Dependencies: [['web','next / react'],['admin','vite / react'],['api','express'],['auth','passport / jsonwebtoken'],['orders','zod'],['db','@prisma/client'],['cache','ioredis'],['stripe','stripe-node']],
  'Function calls': [['web','submitCheckout()'],['admin','updateOrder()'],['api','handleRequest()'],['auth','verifyToken()'],['orders','createOrder()'],['db','prisma.order.create()'],['cache','cache.get()'],['stripe','checkout.create()']],
  'Database schema': [['web','Customers'],['admin','Products'],['api','Orders'],['auth','Sessions'],['orders','Order items'],['db','Addresses'],['cache','Inventory'],['stripe','Payments']],
  'API interactions': [['web','Storefront client'],['admin','Admin client'],['api','/api/v1'],['auth','/auth/token'],['orders','/orders'],['db','/products'],['cache','/sessions'],['stripe','/webhooks/stripe']],
  'Cloud infrastructure': [['web','Vercel · Storefront'],['admin','Vercel · Admin'],['api','AWS · Load balancer'],['auth','ECS · Auth'],['orders','ECS · Orders'],['db','RDS · PostgreSQL'],['cache','ElastiCache'],['stripe','Stripe Cloud']],
  'CI/CD workflows': [['web','Pull request'],['admin','Main branch'],['api','Install & build'],['auth','Lint & typecheck'],['orders','Unit tests'],['db','DB migrations'],['cache','Integration tests'],['stripe','Deploy production']],
};
export function nodesForView(view: View): GraphNode[] { return architectureNodes.map((node, index) => ({ ...node, name: alternateNames[view]?.[index]?.[1] ?? node.name })); }
export const insights = [
  { title: 'A well-connected core', text: 'API Gateway connects 6 components and serves as the central entry point to your system.', kind: 'Architecture', icon: 'network' },
  { title: 'Circular dependency detected', text: 'Auth Service and API Gateway share a dependency. Consider extracting a shared interface.', kind: 'Attention', icon: 'warning' },
  { title: 'Clear service boundaries', text: 'Your frontend and data layers are well separated, making this system easier to maintain.', kind: 'Best practice', icon: 'check' },
];
