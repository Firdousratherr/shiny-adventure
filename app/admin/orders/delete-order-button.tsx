'use client';

export default function DeleteOrderButton({ orderNumber }: { orderNumber: string }) {
  return (
    <form
      action="/api/admin/orders/delete"
      method="post"
      onSubmit={(event) => {
        if (!window.confirm('Delete this order from the admin list? The order will be archived and retained for audit records.')) {
          event.preventDefault();
        }
      }}
      className="mt-4 border-t pt-4"
    >
      <input type="hidden" name="orderNumber" value={orderNumber} />
      <button type="submit" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100">
        Delete order
      </button>
    </form>
  );
}
