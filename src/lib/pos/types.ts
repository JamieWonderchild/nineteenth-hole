import type { Id } from "convex/_generated/dataModel";

export type PosProduct = {
  _id: Id<"posProducts">;
  name: string;
  pricePence: number;
  currency: string;
  categoryId?: Id<"posCategories">;
  stockCount?: number;
  trackStock?: boolean;
  isActive: boolean;
};

// productId may be "custom" for ad-hoc line items (till only)
export type BasketItem = {
  productId: Id<"posProducts"> | "custom";
  productName: string;
  quantity: number;
  unitPricePence: number;
  subtotalPence: number;
};
