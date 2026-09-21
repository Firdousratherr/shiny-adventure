const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const db = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
    throw new Error('Refusing to run seed in production. Set ALLOW_PRODUCTION_SEED=true only for an intentional seed operation.');
  }

  const email = String(process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email || !password) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required');
  if (password.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters');

  const passwordHash = await bcrypt.hash(password, 12);
  await db.adminUser.upsert({ where: { email }, update: { passwordHash }, create: { email, passwordHash } });

  const categories = await Promise.all([
    { name: 'Electronics', slug: 'electronics' },
    { name: 'Home & Kitchen', slug: 'home-kitchen' },
    { name: 'Lifestyle', slug: 'lifestyle' },
  ].map((c) => db.category.upsert({ where: { slug: c.slug }, update: { name: c.name }, create: c })));

  const products = [
    ['Wireless Earbuds', 'wireless-earbuds', 'Compact wireless earbuds for everyday listening.', 1299, 25, 0],
    ['Fast Charging Cable', 'fast-charging-cable', 'Durable charging cable for compatible devices.', 499, 40, 0],
    ['Kitchen Storage Set', 'kitchen-storage-set', 'Reusable storage containers for an organized kitchen.', 799, 20, 1],
    ['LED Desk Lamp', 'led-desk-lamp', 'Adjustable LED desk lamp for study and work.', 999, 18, 1],
    ['Travel Organizer Pouch', 'travel-organizer-pouch', 'Compact organizer pouch for travel essentials.', 599, 30, 2],
  ];
  for (const [name, slug, description, sellingPrice, stock, categoryIndex] of products) {
    await db.product.upsert({
      where: { slug },
      update: { name, description, sellingPrice, stock, categoryId: categories[categoryIndex].id, status: 'ACTIVE', featured: true },
      create: { name, slug, description, sellingPrice, stock, categoryId: categories[categoryIndex].id, status: 'ACTIVE', featured: true },
    });
  }

  await db.orderCounter.upsert({ where: { id: 1 }, update: {}, create: { id: 1, value: 0 } });
  const settings = {
    storeName: 'Zenvora',
    storeDescription: 'Everyday products for Indian shoppers',
    upiId: '',
    upiDisplayName: 'Zenvora',
    freeShippingThreshold: '999',
    flatDeliveryCharge: '79',
    supportEmail: '',
    supportPhone: '',
    whatsappNumber: '',
  };
  for (const [key, value] of Object.entries(settings)) await db.settings.upsert({ where: { key }, update: { value }, create: { key, value } });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => db.$disconnect());
