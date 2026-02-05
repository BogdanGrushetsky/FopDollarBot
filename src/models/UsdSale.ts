import mongoose, { Document, Schema } from 'mongoose';

export interface IUsdSale extends Document {
  userId: number;
  amountUsd: number;
  sellDate: Date;
  monobankRate: number;
  sellUah: number;
  taxBaseUah: number;
  profit: number;
  createdAt: Date;
}

const UsdSaleSchema = new Schema<IUsdSale>({
  userId: { type: Number, required: true, index: true },
  amountUsd: { type: Number, required: true },
  sellDate: { type: Date, required: true },
  monobankRate: { type: Number, required: true },
  sellUah: { type: Number, required: true },
  taxBaseUah: { type: Number, required: true },
  profit: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const UsdSale = mongoose.model<IUsdSale>('UsdSale', UsdSaleSchema);
