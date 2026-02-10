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
      console.log(`✅ Registered user ${userId} (chat ${chatId}) for P&L notifications`);
    }
  }

  /**
   * Test notification for a specific user (ignores time interval)
   */
  static async testNotification(bot: TelegramBot, userId: number, chatId: number): Promise<void> {
    console.log(`🧪 Testing notification for user ${userId}...`);
    
    // Get user state or create new
    let state = this.userStates.get(userId);
    if (!state) {
      state = {
        userId,
        chatId,
        lastNotifiedPnL: 0,
        lastNotifiedRate: 0,
        lastNotificationTime: new Date(0)
      };
      this.userStates.set(userId, state);
    }
    
    // Get current status
    const status = await UsdService.getStatus(userId);
    
    if (status.balanceUsd === 0) {
      await bot.sendMessage(chatId, 
        '⚠️ <b>Test Notification</b>\n\n' +
        'You have no USD balance. Add income using /add_usd to start receiving P&L notifications.',
        { parse_mode: 'HTML' }
      );
      return;
    }
    
    // Send test notification
    await this.sendPnLNotification(bot, chatId, status, state);
    
    // Update state
    state.lastNotifiedPnL = status.unrealizedProfitUah;
    state.lastNotifiedRate = status.currentMonobankRate;
    state.lastNotificationTime = new Date();
    
    console.log(`✅ Test notification sent to user ${userId}`);
  }

  /**
   * Check all registered users and send notifications if needed
   */
  static async checkAndNotify(bot: TelegramBot): Promise<void> {
    const registeredCount = this.userStates.size;
    console.log(`🔔 [${new Date().toLocaleString('uk-UA')}] Checking ${registeredCount} users for P&L notifications...`);
    
    if (registeredCount === 0) {
      console.log('⚠️ No users registered for notifications yet');
      return;
    }

    for (const [userId, state] of this.userStates) {
      try {
        console.log(`  📊 Checking user ${userId}...`);
        await this.checkUserPnL(bot, userId, state);
      } catch (error) {
        console.error(`  ❌ Error checking P&L for user ${userId}:`, error);
      }
    }
    
    console.log(`✅ P&L check completed`);
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
      console.log(`    ⏭️ User ${userId} has no USD balance, skipping`);
      return;
    }

    // Check if enough time has passed since last notification
    const hoursSinceLastNotification = 
      (Date.now() - state.lastNotificationTime.getTime()) / (1000 * 60 * 60);
    
    console.log(`    ⏱️ Hours since last notification: ${hoursSinceLastNotification.toFixed(1)}`);
    
    if (hoursSinceLastNotification < this.MIN_NOTIFICATION_INTERVAL_HOURS) {
      console.log(`    ⏭️ Too soon to notify (need ${this.MIN_NOTIFICATION_INTERVAL_HOURS} hours)`);
      return;
    }

    // Send notification (no percentage threshold check)
    console.log(`    📤 Sending P&L notification to user ${userId}`);
    await this.sendPnLNotification(bot, state.chatId, status, state);
    
    // Update state
    state.lastNotifiedPnL = status.unrealizedProfitUah;
    state.lastNotifiedRate = status.currentMonobankRate;
    state.lastNotificationTime = new Date();
    console.log(`    ✅ Notification sent and state updated`);
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
