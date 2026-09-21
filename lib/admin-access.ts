import { auth } from '../auth';
import { db } from './db';

export const ADMIN_PERMISSIONS = [
  { key: 'products', label: 'Products', description: 'Create, edit and hide products' },
  { key: 'pricing', label: 'Pricing', description: 'Change selling and source prices' },
  { key: 'inventory', label: 'Inventory', description: 'Change stock quantities' },
  { key: 'images', label: 'Product images', description: 'Upload and manage product images' },
  { key: 'categories', label: 'Categories', description: 'Create and edit categories' },
  { key: 'orders', label: 'Orders', description: 'View and manage orders' },
  { key: 'payments', label: 'Payments', description: 'Verify or reject payments' },
  { key: 'customers', label: 'Customers', description: 'View customer information' },
  { key: 'settings', label: 'Settings', description: 'Change store settings' },
  { key: 'marketplaces', label: 'Marketplaces', description: 'Manage Amazon, Flipkart and Meesho integrations' },
] as const;

export type AdminPermission = typeof ADMIN_PERMISSIONS[number]['key'];

export async function getAdminAccess() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase().trim();
  if (session?.user?.role !== 'admin' || !email) return null;
  const user = await db.adminUser.findUnique({ where: { email }, select: { id: true, email: true, accessRole: true, permissions: true } });
  if (!user) return null;
  const permissions = Array.isArray(user.permissions) ? user.permissions.filter((p): p is string => typeof p === 'string') : [];
  return { ...user, permissions, isSuperAdmin: user.accessRole === 'SUPER_ADMIN' };
}

export async function requireAdminPermission(permission: AdminPermission) {
  const admin = await getAdminAccess();
  if (!admin) return null;
  if (admin.isSuperAdmin || admin.permissions.includes(permission)) return admin;
  return null;
}

export async function requireSuperAdmin() {
  const admin = await getAdminAccess();
  return admin?.isSuperAdmin ? admin : null;
}
