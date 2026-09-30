import { PrismaClient, Prisma } from '@prisma/client';

export async function createCustomerNotification(
  tx: PrismaClient | Prisma.TransactionClient,
  email: string | null | undefined,
  type: string,
  title: string,
  message: string,
  orderId?: string,
) {
  if (!email) return;
  const customer = await tx.customerUser.findUnique({ where: { email }, select: { id: true } });
  if (!customer) return;
  await tx.customerNotification.create({ data: { customerId: customer.id, type, title, message, orderId: orderId ?? null } });
}
