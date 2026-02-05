import mongoose, { Document, Schema } from 'mongoose';

export interface IUsdIncome extends Document {
  userId: number;
  amountUsd: number;
  remainingUsd: number;
  nbuRate: number;
  taxBaseUah: number;
  date: Date;
  createdAt: Date;
}

const UsdIncomeSchema = new Schema<IUsdIncome>({
  userId: { type: Number, required: true, index: true },
  amountUsd: { type: Number, required: true },
  remainingUsd: { type: Number, required: true },
  nbuRate: { type: Number, required: true },
  taxBaseUah: { type: Number, required: true },
  date: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const UsdIncome = mongoose.model<IUsdIncome>('UsdIncome', UsdIncomeSchema);
