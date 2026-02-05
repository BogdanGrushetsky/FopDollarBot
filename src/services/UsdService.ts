import { UsdIncome } from '../models/UsdIncome';
import { UsdSale } from '../models/UsdSale';
import { CurrencyService } from './CurrencyService';

export interface AddUsdResult {
  success: boolean;
  message: string;
  amountUsd: number;
  nbuRate: number;
  taxBaseUah: number;
  newBalance: number;
}

export interface SellUsdResult {
  success: boolean;
  message: string;
  amountUsd: number;
  monobankRate: number;
  sellUah: number;
  taxBaseUah: number;
  profit: number;
  newBalance: number;
}

export interface StatusResult {
  balanceUsd: number;
  taxBaseUah: number;
  currentValueUah: number;
  unrealizedProfitUah: number;
  currentMonobankRate: number;
}

export class UsdService {
  /**
   * Add USD income
   */
  static async addUsd(userId: number, amountUsd: number, date: Date): Promise<AddUsdResult> {
    try {
      // Get NBU rate for date
      const nbuRate = await CurrencyService.getNbuRate(date);
      
      // Calculate tax base
      const taxBaseUah = amountUsd * nbuRate;

      // Create income record
      const income = new UsdIncome({
        userId,
        amountUsd,
        remainingUsd: amountUsd, // Initially all amount is available
        nbuRate,
        taxBaseUah,
        date
      });

      await income.save();

      // Calculate new balance
      const newBalance = await this.getBalance(userId);

      return {
        success: true,
        message: `✅ Added $${amountUsd.toFixed(2)}\nNBU rate: ${nbuRate.toFixed(2)} UAH\nTax base: ${taxBaseUah.toFixed(2)} UAH`,
        amountUsd,
        nbuRate,
        taxBaseUah,
        newBalance
      };
    } catch (error) {
      return {
        success: false,
        message: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        amountUsd: 0,
        nbuRate: 0,
        taxBaseUah: 0,
        newBalance: 0
      };
    }
  }

  /**
   * Sell USD using FIFO principle
   */
  static async sellUsd(userId: number, amountUsd: number, sellDate: Date): Promise<SellUsdResult> {
    try {
      // Check balance
      const balance = await this.getBalance(userId);
      
      if (balance < amountUsd) {
        return {
          success: false,
          message: `❌ Insufficient USD. Your balance: $${balance.toFixed(2)}`,
          amountUsd: 0,
          monobankRate: 0,
          sellUah: 0,
          taxBaseUah: 0,
          profit: 0,
          newBalance: balance
        };
      }

      // Get Monobank rate for sell date
      const monobankRate = await CurrencyService.getMonobankBuyRate(sellDate);

      // Get incomes by FIFO (oldest first with remaining balance)
      const incomes = await UsdIncome.find({
        userId,
        remainingUsd: { $gt: 0 }
      }).sort({ date: 1 });

      let remainingToSell = amountUsd;
      let totalTaxBase = 0;
      const updatedIncomes: Array<{ income: typeof incomes[0], soldAmount: number }> = [];

      // Deduct USD by FIFO
      for (const income of incomes) {
        if (remainingToSell <= 0) break;

        const amountToSellFromThis = Math.min(income.remainingUsd, remainingToSell);
        const taxBaseForThis = (amountToSellFromThis / income.amountUsd) * income.taxBaseUah;

        totalTaxBase += taxBaseForThis;
        remainingToSell -= amountToSellFromThis;

        updatedIncomes.push({
          income,
          soldAmount: amountToSellFromThis
        });
      }

      // Update balances in database
      for (const { income, soldAmount } of updatedIncomes) {
        income.remainingUsd -= soldAmount;
        await income.save();
      }

      // Calculate profit/loss
      const sellUah = amountUsd * monobankRate;
      const profit = sellUah - totalTaxBase;

      // Save sale record
      const sale = new UsdSale({
        userId,
        amountUsd,
        sellDate,
        monobankRate,
        sellUah,
        taxBaseUah: totalTaxBase,
        profit
      });

      await sale.save();

      // Calculate new balance
      const newBalance = await this.getBalance(userId);

      const profitText = profit >= 0 ? `💰 Profit: ${profit.toFixed(2)} UAH` : `📉 Loss: ${Math.abs(profit).toFixed(2)} UAH`;

      return {
        success: true,
        message: `✅ Sold $${amountUsd.toFixed(2)}\nMonobank rate: ${monobankRate.toFixed(2)} UAH\nReceived: ${sellUah.toFixed(2)} UAH\nTax base: ${totalTaxBase.toFixed(2)} UAH\n${profitText}`,
        amountUsd,
        monobankRate,
        sellUah,
        taxBaseUah: totalTaxBase,
        profit,
        newBalance
      };
    } catch (error) {
      return {
        success: false,
        message: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        amountUsd: 0,
        monobankRate: 0,
        sellUah: 0,
        taxBaseUah: 0,
        profit: 0,
        newBalance: 0
      };
    }
  }

  /**
   * Get current status
   */
  static async getStatus(userId: number): Promise<StatusResult> {
    // Get all incomes with remaining balance
    const incomes = await UsdIncome.find({
      userId,
      remainingUsd: { $gt: 0 }
    });

    // Calculate USD balance and tax base
    let balanceUsd = 0;
    let taxBaseUah = 0;

    for (const income of incomes) {
      balanceUsd += income.remainingUsd;
      // Tax base proportional to remaining amount
      const taxBaseForRemaining = (income.remainingUsd / income.amountUsd) * income.taxBaseUah;
      taxBaseUah += taxBaseForRemaining;
    }

    // Get current Monobank rate
    const currentMonobankRate = await CurrencyService.getCurrentMonobankBuyRate();

    // Calculate current value and unrealized P&L
    const currentValueUah = balanceUsd * currentMonobankRate;
    const unrealizedProfitUah = currentValueUah - taxBaseUah;

    return {
      balanceUsd,
      taxBaseUah,
      currentValueUah,
      unrealizedProfitUah,
      currentMonobankRate
    };
  }

  /**
   * Get current USD balance
   */
  static async getBalance(userId: number): Promise<number> {
    const incomes = await UsdIncome.find({
      userId,
      remainingUsd: { $gt: 0 }
    });

    return incomes.reduce((sum: number, income) => sum + income.remainingUsd, 0);
  }
}
