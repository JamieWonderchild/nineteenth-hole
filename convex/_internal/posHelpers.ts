import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SaleItem = {
  productId?: Id<"posProducts">;
  productName: string;
  quantity: number;
  unitPricePence: number;
  subtotalPence: number;
};

export type RecordSaleArgs = {
  clubId: Id<"clubs">;
  memberId?: string;
  memberName?: string;
  chargeAccountMemberId?: Id<"clubMembers">;
  items: SaleItem[];
  currency: string;
  paymentMethod: string;
  notes?: string;
  shiftId?: Id<"posShifts">;
  locationId?: Id<"posLocations">;
  isGuest?: boolean;
  servedBy: string; // userId or "kiosk:<kioskId>"
};

// ── Shared sale-recording logic ───────────────────────────────────────────────
// Called by both pos.recordSale and posTabs.closeTab so the account-charge,
// stock-decrement, and posSales-insert logic lives in one place.

export async function recordSaleInternal(
  ctx: MutationCtx,
  args: RecordSaleArgs,
): Promise<Id<"posSales">> {
  const subtotalPence = args.items.reduce((s, i) => s + i.subtotalPence, 0);
  const now = new Date().toISOString();

  // Account charge — check and deduct atomically before writing the sale
  if (args.paymentMethod === "account") {
    if (!args.chargeAccountMemberId) throw new Error("Member account not specified");
    const member = await ctx.db.get(args.chargeAccountMemberId);
    if (!member) throw new Error("Member not found");
    const balance = member.accountBalance ?? 0;
    if (balance < subtotalPence) {
      throw new Error(
        `Insufficient balance (${(balance / 100).toFixed(2)} available, ${(subtotalPence / 100).toFixed(2)} needed)`,
      );
    }
    const newBalance = balance - subtotalPence;
    await ctx.db.patch(args.chargeAccountMemberId, { accountBalance: newBalance });

    const saleId = await ctx.db.insert("posSales", {
      clubId:        args.clubId,
      memberId:      member.userId,
      clubMemberId:  args.chargeAccountMemberId,
      memberName:    member.displayName,
      items:         args.items,
      subtotalPence,
      totalPence:    subtotalPence,
      currency:      args.currency,
      paymentMethod: "account",
      notes:         args.notes,
      servedBy:      args.servedBy,
      shiftId:       args.shiftId,
      locationId:    args.locationId,
      isGuest:       false,
      createdAt:     now,
    });

    await ctx.db.insert("memberAccountTransactions", {
      clubId:      args.clubId,
      memberId:    args.chargeAccountMemberId,
      userId:      member.userId,
      type:        "charge",
      amount:      -subtotalPence,
      balanceAfter: newBalance,
      description: args.items.map(i => `${i.quantity}× ${i.productName}`).join(", "),
      saleId,
      processedBy: args.servedBy,
      createdAt:   now,
    });

    await decrementStock(ctx, args.items, now);
    return saleId;
  }

  // All other payment methods
  const saleId = await ctx.db.insert("posSales", {
    clubId:        args.clubId,
    memberId:      args.memberId,
    memberName:    args.memberName,
    items:         args.items,
    subtotalPence,
    totalPence:    subtotalPence,
    currency:      args.currency,
    paymentMethod: args.paymentMethod,
    notes:         args.notes,
    servedBy:      args.servedBy,
    shiftId:       args.shiftId,
    locationId:    args.locationId,
    isGuest:       args.isGuest,
    createdAt:     now,
  });

  await decrementStock(ctx, args.items, now);
  return saleId;
}

// ── Stock decrement helper ────────────────────────────────────────────────────

async function decrementStock(ctx: MutationCtx, items: SaleItem[], now: string) {
  for (const item of items) {
    if (item.productId) {
      const product = await ctx.db.get(item.productId);
      if (product?.trackStock && product.stockCount != null) {
        await ctx.db.patch(item.productId, {
          stockCount: Math.max(0, product.stockCount - item.quantity),
          updatedAt: now,
        });
      }
    }
  }
}
