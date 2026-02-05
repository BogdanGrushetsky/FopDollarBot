import TelegramBot from 'node-telegram-bot-api';
import { UsdService } from './UsdService';

interface UserNotificationState {
  userId: number;
  chatId: number;
  lastNotifiedPnL: number;
  lastNotifiedRate: number;
  lastNotificationTime: Date;
}

export class NotificationService {
  private static userStates: Map<number, UserNotificationState> = new Map();
  private static readonly MIN_PNL_CHANGE_PERCENT = 2; // Notify if P&L changes by 2% or more
  private static readonly MIN_NOTIFICATION_INTERVAL_HOURS = 6; // Don't spam more often than 6 hours

  /**
   * Register user for notifications
   */
  static registerUser(userId: number, chatId: number): void {
    if (!this.userStates.has(userId)) {
      this.userStates.set(userId, {
        userId,
        chatId,
        lastNotifiedPnL: 0,
        lastNotifiedRate: 0,
        lastNotificationTime: new Date(0) // Long time ago
      });
    }
  }

  /**
   * Check all registered users and send notifications if needed
   */
  static async checkAndNotify(bot: TelegramBot): Promise<void> {
    console.log(`🔔 Checking ${this.userStates.size} users for P&L notifications...`);

    for (const [userId, state] of this.userStates) {
      try {
        await this.checkUserPnL(bot, userId, state);
      } catch (error) {
        console.error(`Error checking P&L for user ${userId}:`, error);
      }
    }
  }

  /**
   * Check single user's P&L and notify if significant change
   */
  private static async checkUserPnL(
    bot: TelegramBot,
    userId: number,
    state: UserNotificationState
  ): Promise<void> {
    // Get current status
    const status = await UsdService.getStatus(userId);

    // Skip if user has no balance
    if (status.balanceUsd === 0) {
      return;
    }

    // Check if enough time has passed since last notification
    const hoursSinceLastNotification = 
      (Date.now() - state.lastNotificationTime.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceLastNotification < this.MIN_NOTIFICATION_INTERVAL_HOURS) {
      return;
    }

    // Calculate change percentage
    const pnlChange = state.lastNotifiedPnL !== 0
      ? Math.abs((status.unrealizedProfitUah - state.lastNotifiedPnL) / state.lastNotifiedPnL * 100)
      : 100; // First time always notify

    // Check if change is significant
    if (pnlChange >= this.MIN_PNL_CHANGE_PERCENT || state.lastNotifiedPnL === 0) {
      await this.sendPnLNotification(bot, state.chatId, status, state);
      
      // Update state
      state.lastNotifiedPnL = status.unrealizedProfitUah;
      state.lastNotifiedRate = status.currentMonobankRate;
      state.lastNotificationTime = new Date();
    }
  }

  /**
   * Send P&L notification to user
   */
  private static async sendPnLNotification(
    bot: TelegramBot,
    chatId: number,
    status: any,
    state: UserNotificationState
  ): Promise<void> {
    const profitEmoji = status.unrealizedProfitUah >= 0 ? '💰' : '📉';
    const profitText = status.unrealizedProfitUah >= 0 
      ? `<b>+${status.unrealizedProfitUah.toFixed(2)} UAH</b>`
      : `<b>${status.unrealizedProfitUah.toFixed(2)} UAH</b>`;

    const changeText = state.lastNotifiedPnL !== 0
      ? `\n📊 Change: ${(status.unrealizedProfitUah - state.lastNotifiedPnL).toFixed(2)} UAH`
      : '';

    const message = `
🔔 <b>P&L Update</b>

💵 USD Balance: $${status.balanceUsd.toFixed(2)}
💱 Monobank Rate: <b>${status.currentMonobankRate.toFixed(2)} UAH</b>
${profitEmoji} Unrealized P&L: ${profitText}${changeText}

━━━━━━━━━━━━━━━━
📋 Tax Base: ${status.taxBaseUah.toFixed(2)} UAH
💰 Current Value: ${status.currentValueUah.toFixed(2)} UAH
    `;

    try {
      await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
      console.log(`📤 Sent P&L notification to user ${state.userId}`);
    } catch (error) {
      console.error(`Failed to send notification to ${chatId}:`, error);
    }
  }

  /**
   * Get all registered user IDs
   */
  static getRegisteredUsers(): number[] {
    return Array.from(this.userStates.keys());
  }

  /**
   * Remove user from notifications
   */
  static unregisterUser(userId: number): void {
    this.userStates.delete(userId);
  }
}
