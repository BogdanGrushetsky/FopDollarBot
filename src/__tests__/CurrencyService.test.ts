import { CurrencyService } from '../services/CurrencyService';
import { CurrencyCache } from '../models/CurrencyCache';
import axios from 'axios';

// Mock axios
jest.mock('axios');
// Mock CurrencyCache model
jest.mock('../models/CurrencyCache');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('CurrencyService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock cache to always return null (no cached data)
    (CurrencyCache.findOne as jest.Mock) = jest.fn().mockResolvedValue(null);
    // Mock save
    (CurrencyCache.prototype.save as jest.Mock) = jest.fn().mockResolvedValue({});
  });

  describe('getNbuRate', () => {
    it('should return NBU rate for date', async () => {
      const date = new Date('2026-02-01');
      
      // Mock NBU API response
      mockedAxios.get.mockResolvedValue({
        data: [{ cc: 'USD', rate: 40.5 }]
      });
      
      const rate = await CurrencyService.getNbuRate(date);
      
      expect(rate).toBeGreaterThan(0);
      expect(typeof rate).toBe('number');
    });

    it('should cache NBU rate', async () => {
      const date = new Date('2026-02-01');
      const mockRate = 40.5;
      
      // First call - no cache, API returns data
      (CurrencyCache.findOne as jest.Mock).mockResolvedValueOnce(null);
      mockedAxios.get.mockResolvedValue({
        data: [{ cc: 'USD', rate: mockRate }]
      });
      
      const rate1 = await CurrencyService.getNbuRate(date);
      
      // Second call - return cached data
      (CurrencyCache.findOne as jest.Mock).mockResolvedValueOnce({
        rate: mockRate,
        provider: 'nbu',
        currencyCode: 'USD',
        date: date
      });
      
      const rate2 = await CurrencyService.getNbuRate(date);
      
      expect(rate1).toBe(rate2);
    });
  });

  describe('getMonobankBuyRate', () => {
    it('should return Monobank rate for today', async () => {
      const today = new Date();
      
      // Mock Monobank API response
      mockedAxios.get.mockResolvedValue({
        data: [
          { currencyCodeA: 840, currencyCodeB: 980, rateBuy: 41.5 }
        ]
      });
      
      const rate = await CurrencyService.getMonobankBuyRate(today);
      
      expect(rate).toBeGreaterThan(0);
      expect(typeof rate).toBe('number');
    });

    it('should use NBU rate for past dates', async () => {
      const pastDate = new Date('2026-01-01');
      
      // Mock NBU API response (Monobank not available for past dates)
      mockedAxios.get.mockResolvedValue({
        data: [{ cc: 'USD', rate: 39.8 }]
      });
      
      const rate = await CurrencyService.getMonobankBuyRate(pastDate);
      
      expect(rate).toBeGreaterThan(0);
      expect(typeof rate).toBe('number');
    });
  });
});
