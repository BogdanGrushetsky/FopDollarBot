import mongoose, { Document, Schema } from 'mongoose';

export interface ICurrencyCache extends Document {
  provider: 'nbu' | 'monobank';
  currencyCode: string;
  date: Date;
  rate: number;
  cachedAt: Date;
  expiresAt: Date;
}

const CurrencyCacheSchema = new Schema<ICurrencyCache>({
  provider: { type: String, required: true, enum: ['nbu', 'monobank'] },
  currencyCode: { type: String, required: true },
  date: { type: Date, required: true },
  rate: { type: Number, required: true },
  cachedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true }
});

CurrencyCacheSchema.index({ provider: 1, currencyCode: 1, date: 1 }, { unique: true });
CurrencyCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const CurrencyCache = mongoose.model<ICurrencyCache>('CurrencyCache', CurrencyCacheSchema);
