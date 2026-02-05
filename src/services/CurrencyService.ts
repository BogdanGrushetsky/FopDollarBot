import axios from 'axios';
import { CurrencyCache } from '../models/CurrencyCache';

interface NbuRate {
  r030: number;
  txt: string;
  rate: number;
  cc: string;
  exchangedate: string;
}

interface MonobankRate {
  currencyCodeA: number;
  currencyCodeB: number;
  date: number;
  rateSell?: number;
  rateBuy?: number;
  rateCross?: number;
}

export class CurrencyService {
  private static readonly NBU_API = 'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange';
  private static readonly MONOBANK_API = 'https://api.monobank.ua/bank/currency';
  private static readonly USD_CODE_NBU = 'USD';
  private static readonly USD_CODE_MONO = 840; // ISO 4217 code for USD
  private static readonly UAH_CODE_MONO = 980; // ISO 4217 code for UAH
  private static readonly CACHE_DURATION_DAYS = 180; // 6 months for historical data
  private static readonly MONOBANK_CACHE_HOURS = 6; // 6 hours for current day (4 times per day)

  /**
   * Get NBU rate USD→UAH for specific date (with cache)
   */
  static async getNbuRate(date: Date): Promise<number> {
    const dateOnly = this.getDateOnly(date);
    
    // Try to get from cache
    const cached = await CurrencyCache.findOne({
      provider: 'nbu',
      currencyCode: this.USD_CODE_NBU,
      date: dateOnly,
      expiresAt: { $gt: new Date() }
    });

    if (cached) {
      console.log(`💾 NBU rate from cache: ${cached.rate} (${dateOnly.toISOString().split('T')[0]})`);
      return cached.rate;
    }

    // Get from API
    try {
      const dateStr = this.formatDateForNbu(dateOnly);
      const response = await axios.get<NbuRate[]>(this.NBU_API, {
        params: {
          json: '',
          date: dateStr
        }
      });

      const usdRate = response.data.find((rate: NbuRate) => rate.cc === this.USD_CODE_NBU);
      
      if (!usdRate) {
        throw new Error(`USD rate not found for date ${dateStr}`);
      }

      // Save to cache
      await this.saveToCacheNbu(dateOnly, usdRate.rate);
      
      console.log(`🌐 NBU rate from API: ${usdRate.rate} (${dateOnly.toISOString().split('T')[0]})`);
      return usdRate.rate;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`NBU rate fetch error: ${(error as Error).message}`);
      }
      throw error;
    }
  }

  /**
   * Get Monobank USD→UAH buy rate (when user sells USD to bank) with cache
   */
  static async getMonobankBuyRate(date: Date): Promise<number> {
    const dateOnly = this.getDateOnly(date);
    const today = this.getDateOnly(new Date());

    // If date is not today, use NBU as fallback
    if (dateOnly.getTime() !== today.getTime()) {
      console.log(`Date ${dateOnly.toISOString().split('T')[0]} is not today, using NBU rate`);
      return await this.getNbuRate(dateOnly);
    }

    // Try to get from cache
    const cached = await CurrencyCache.findOne({
      provider: 'monobank',
      currencyCode: 'USD',
      date: dateOnly,
      expiresAt: { $gt: new Date() }
    });

    if (cached) {
      console.log(`💾 Monobank rate from cache: ${cached.rate}`);
      return cached.rate;
    }

    // Get from API
    try {
      const response = await axios.get<MonobankRate[]>(this.MONOBANK_API);

      const usdRate = response.data.find(
        (rate: MonobankRate) => rate.currencyCodeA === this.USD_CODE_MONO && 
                rate.currencyCodeB === this.UAH_CODE_MONO
      );

      if (!usdRate || !usdRate.rateBuy) {
        throw new Error('USD buy rate not found in Monobank');
      }

      // Save to cache
      await this.saveToCacheMonobank(dateOnly, usdRate.rateBuy);

      console.log(`🌐 Monobank rate from API: ${usdRate.rateBuy}`);
      return usdRate.rateBuy;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // If Monobank unavailable, use NBU
        console.log('Monobank unavailable, using NBU rate');
        return await this.getNbuRate(dateOnly);
      }
      throw error;
    }
  }

  /**
   * Get current Monobank rate for unrealized P&L calculation
   */
  static async getCurrentMonobankBuyRate(): Promise<number> {
    return await this.getMonobankBuyRate(new Date());
  }

  /**
   * Save NBU rate to cache
   */
  private static async saveToCacheNbu(date: Date, rate: number): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.CACHE_DURATION_DAYS);

    await CurrencyCache.findOneAndUpdate(
      {
        provider: 'nbu',
        currencyCode: this.USD_CODE_NBU,
        date
      },
      {
        rate,
        cachedAt: new Date(),
        expiresAt
      },
      { upsert: true, new: true }
    );
  }

  /**
   * Save Monobank rate to cache
   */
  private static async saveToCacheMonobank(date: Date, rate: number): Promise<void> {
    const expiresAt = new Date();
    const today = this.getDateOnly(new Date());
    const dateOnly = this.getDateOnly(date);
    
    // For today's rate, cache for 6 hours (4 updates per day)
    // For historical data, cache for 180 days
    if (dateOnly.getTime() === today.getTime()) {
      expiresAt.setHours(expiresAt.getHours() + this.MONOBANK_CACHE_HOURS);
    } else {
      expiresAt.setDate(expiresAt.getDate() + this.CACHE_DURATION_DAYS);
    }

    await CurrencyCache.findOneAndUpdate(
      {
        provider: 'monobank',
        currencyCode: 'USD',
        date
      },
      {
        rate,
        cachedAt: new Date(),
        expiresAt
      },
      { upsert: true, new: true }
    );
  }

  /**
   * Format date for NBU API (YYYYMMDD)
   */
  private static formatDateForNbu(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  /**
   * Get date without time
   */
  private static getDateOnly(date: Date): Date {
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);
    return dateOnly;
  }
}

