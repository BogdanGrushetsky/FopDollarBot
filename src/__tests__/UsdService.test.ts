import { UsdService } from '../services/UsdService';
import { UsdIncome } from '../models/UsdIncome';
import { UsdSale } from '../models/UsdSale';
import { CurrencyService } from '../services/CurrencyService';

// Mock моделей та сервісів
jest.mock('../models/UsdIncome');
jest.mock('../models/UsdSale');
jest.mock('../services/CurrencyService');

describe('UsdService', () => {
  const mockUserId = 123456;
  const mockDate = new Date('2026-02-01');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addUsd', () => {
    it('should add USD income with correct data', async () => {
      const amount = 100;
      const mockNbuRate = 40.5;

      (CurrencyService.getNbuRate as jest.Mock).mockResolvedValue(mockNbuRate);
      (UsdIncome.prototype.save as jest.Mock).mockResolvedValue({});
      (UsdIncome.find as jest.Mock).mockResolvedValue([
        { remainingUsd: amount }
      ]);

      const result = await UsdService.addUsd(mockUserId, amount, mockDate);

      expect(result.success).toBe(true);
      expect(result.amountUsd).toBe(amount);
      expect(result.nbuRate).toBe(mockNbuRate);
      expect(result.taxBaseUah).toBe(amount * mockNbuRate);
    });

    it('should handle API error', async () => {
      (CurrencyService.getNbuRate as jest.Mock).mockRejectedValue(
        new Error('API unavailable')
      );

      const result = await UsdService.addUsd(mockUserId, 100, mockDate);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Error');
    });
  });

  describe('sellUsd', () => {
    it('should sell USD using FIFO principle', async () => {
      const sellAmount = 50;
      const mockMonobankRate = 42.0;
      const mockIncome = {
        userId: mockUserId,
        amountUsd: 100,
        remainingUsd: 100,
        nbuRate: 40.0,
        taxBaseUah: 4000,
        save: jest.fn().mockResolvedValue({})
      };

      (CurrencyService.getMonobankBuyRate as jest.Mock).mockResolvedValue(mockMonobankRate);
      // Mock three find calls:
      // 1. getBalance() at start - returns array
      // 2. find() for FIFO list - returns query object with sort()
      // 3. getBalance() at end - returns array
      (UsdIncome.find as jest.Mock)
        .mockReturnValueOnce(Promise.resolve([mockIncome])) // balance check
        .mockReturnValueOnce({ // FIFO query with sort
          sort: jest.fn().mockResolvedValue([mockIncome])
        })
        .mockReturnValueOnce(Promise.resolve([{ ...mockIncome, remainingUsd: 50 }])); // balance after
      (UsdSale.prototype.save as jest.Mock).mockResolvedValue({});

      const result = await UsdService.sellUsd(mockUserId, sellAmount, mockDate);

      expect(result.success).toBe(true);
      expect(result.amountUsd).toBe(sellAmount);
      expect(result.sellUah).toBe(sellAmount * mockMonobankRate);
      // Verify that save was called on the income object
      expect(mockIncome.save).toHaveBeenCalled();
    });

    it('should reject sale with insufficient balance', async () => {
      (UsdIncome.find as jest.Mock).mockResolvedValue([
        { remainingUsd: 10 }
      ]);

      const result = await UsdService.sellUsd(mockUserId, 100, mockDate);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Insufficient USD');
    });

    it('should calculate profit/loss', async () => {
      const sellAmount = 100;
      const mockNbuRate = 40.0;
      const mockMonobankRate = 42.0;
      const mockIncome = {
        userId: mockUserId,
        amountUsd: 100,
        remainingUsd: 100,
        nbuRate: mockNbuRate,
        taxBaseUah: 4000,
        save: jest.fn().mockResolvedValue({})
      };

      (CurrencyService.getMonobankBuyRate as jest.Mock).mockResolvedValue(mockMonobankRate);
      // Mock three find calls with sort()
      (UsdIncome.find as jest.Mock)
        .mockReturnValueOnce(Promise.resolve([mockIncome])) // balance check
        .mockReturnValueOnce({ // FIFO query with sort
          sort: jest.fn().mockResolvedValue([mockIncome])
        })
        .mockReturnValueOnce(Promise.resolve([{ ...mockIncome, remainingUsd: 0 }])); // balance after
      (UsdSale.prototype.save as jest.Mock).mockResolvedValue({});

      const result = await UsdService.sellUsd(mockUserId, sellAmount, mockDate);

      const expectedProfit = (sellAmount * mockMonobankRate) - (sellAmount * mockNbuRate);
      expect(result.success).toBe(true);
      expect(result.profit).toBeCloseTo(expectedProfit, 2);
      // Verify that UsdSale was saved
      expect(UsdSale.prototype.save).toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('should return status with balance and unrealized P&L', async () => {
      const mockIncome = {
        remainingUsd: 100,
        amountUsd: 100,
        taxBaseUah: 4000
      };
      const mockMonobankRate = 42.0;

      (UsdIncome.find as jest.Mock).mockResolvedValue([mockIncome]);
      (CurrencyService.getCurrentMonobankBuyRate as jest.Mock).mockResolvedValue(mockMonobankRate);

      const result = await UsdService.getStatus(mockUserId);

      expect(result.balanceUsd).toBe(100);
      expect(result.taxBaseUah).toBe(4000);
      expect(result.currentValueUah).toBe(100 * mockMonobankRate);
      expect(result.unrealizedProfitUah).toBeGreaterThan(0);
    });

    it('should return zero balance for new user', async () => {
      (UsdIncome.find as jest.Mock).mockResolvedValue([]);
      (CurrencyService.getCurrentMonobankBuyRate as jest.Mock).mockResolvedValue(42.0);

      const result = await UsdService.getStatus(mockUserId);

      expect(result.balanceUsd).toBe(0);
      expect(result.taxBaseUah).toBe(0);
    });
  });

  describe('FIFO logic', () => {
    it('should sell USD from oldest batch first', async () => {
      const income1 = {
        userId: mockUserId,
        amountUsd: 50,
        remainingUsd: 50,
        nbuRate: 40.0,
        taxBaseUah: 2000,
        date: new Date('2026-01-01'),
        save: jest.fn().mockResolvedValue({})
      };
      const income2 = {
        userId: mockUserId,
        amountUsd: 100,
        remainingUsd: 100,
        nbuRate: 41.0,
        taxBaseUah: 4100,
        date: new Date('2026-01-15'),
        save: jest.fn().mockResolvedValue({})
      };

      (CurrencyService.getMonobankBuyRate as jest.Mock).mockResolvedValue(42.0);
      // Mock three find calls with sort()
      (UsdIncome.find as jest.Mock)
        .mockReturnValueOnce(Promise.resolve([income1, income2])) // balance check (150 total)
        .mockReturnValueOnce({ // FIFO query with sort
          sort: jest.fn().mockResolvedValue([income1, income2])
        })
        .mockReturnValueOnce(Promise.resolve([{ ...income1, remainingUsd: 0 }, { ...income2, remainingUsd: 75 }])); // balance after (75 remaining)
      (UsdSale.prototype.save as jest.Mock).mockResolvedValue({});

      await UsdService.sellUsd(mockUserId, 75, mockDate);

      // Verify that save was called on both income objects
      expect(income1.save).toHaveBeenCalled();
      expect(income2.save).toHaveBeenCalled();
      // First batch should have sold all 50
      // Second batch should have sold 25 (75 - 50 = 25)
    });
  });
});
