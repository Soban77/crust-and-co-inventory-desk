import { z } from "zod";

const text = (max) => z.string().trim().max(max).optional().nullable().transform((value) => value || null);
const quantity = z.number().finite().min(0).max(1_000_000);

export const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128)
});

export const itemSchema = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(60),
  unit: z.string().trim().min(1).max(24),
  minimumStockLevel: quantity,
  currentQuantity: quantity.optional(),
  supplier: text(120),
  notes: text(1000)
});

export const transactionSchema = z.object({
  type: z.enum(["STOCK_IN", "STOCK_OUT", "ADJUSTMENT"]),
  quantity: z.number().finite().min(-1_000_000).max(1_000_000).refine((value) => value !== 0, "Quantity cannot be zero."),
  remarks: text(500)
}).superRefine((value, context) => {
  if (value.type !== "ADJUSTMENT" && value.quantity < 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["quantity"], message: "Use a positive quantity for stock in/out." });
  }
});
