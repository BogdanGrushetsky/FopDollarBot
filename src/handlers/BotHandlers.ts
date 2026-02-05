import TelegramBot from 'node-telegram-bot-api';
import { UsdService } from '../services/UsdService';

export class BotHandlers {
  /**
   * Main menu with inline buttons
   */
  static getMainMenuKeyboard(): TelegramBot.InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          { text: '➡️ Add USD', callback_data: 'add_usd' },
          { text: '💰 Sell USD', callback_data: 'sell_usd' }
        ],
        [
          { text: '📊 Status', callback_data: 'status' }
        ],
        [
          { text: '❓ Довідка', callback_data: 'help' }
        ]
      ]
    };
  }

  /**
   * Back to main menu button
   */
  static getBackToMenuKeyboard(): TelegramBot.InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [{ text: '🏠 Головне меню', callback_data: 'main_menu' }]
      ]
    };
  }

  /**
   * Handle /start command
   */
  static handleStart(bot: TelegramBot, chatId: number): void {
    const welcomeMessage = `
👋 <b>Welcome to FOP Dollar Bot!</b>

I will help you track your USD income with Ukrainian tax requirements.

<b>🎯 What I can do:</b>
• Record USD income at NBU exchange rate
• Calculate tax base
• Sell USD at Monobank rate
• Calculate profit/loss using FIFO
• Show unrealized P&L

Choose an action below:
    `;
    
    bot.sendMessage(chatId, welcomeMessage, {
      parse_mode: 'HTML',
      reply_markup: this.getMainMenuKeyboard()
    });
  }

  /**
   * Handle add_usd callback
   */
  static handleAddUsdCallback(bot: TelegramBot, chatId: number): void {
    const message = `
➡️ <b>Add USD Income</b>

To add income use the command:
<code>/add_usd &lt;amount&gt; &lt;YYYY-MM-DD&gt;</code>

<b>Example:</b>
<code>/add_usd 100 2026-02-01</code>

The bot will automatically:
✓ Get NBU rate for the date
✓ Calculate tax base
✓ Increase your USD balance
    `;

    bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      reply_markup: this.getBackToMenuKeyboard()
    });
  }

  /**
   * Handle sell_usd callback
   */
  static handleSellUsdCallback(bot: TelegramBot, chatId: number): void {
    const message = `
💰 <b>Sell USD</b>

To sell use the command:
<code>/sell_usd &lt;amount&gt; &lt;YYYY-MM-DD&gt;</code>

<b>Example:</b>
<code>/sell_usd 50 2026-02-04</code>

The bot will automatically:
✓ Check balance
✓ Get Monobank rate for the date
✓ Deduct USD using FIFO principle
✓ Calculate profit/loss
    `;

    bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      reply_markup: this.getBackToMenuKeyboard()
    });
  }

  /**
   * Handle /help command
   */
  static handleHelp(bot: TelegramBot, chatId: number): void {
    const helpMessage = `
❓ <b>Help</b>

<b>📋 Main Commands:</b>

<b>/add_usd &lt;amount&gt; &lt;date&gt;</b>
Add USD income
<i>Example: /add_usd 100 2026-02-01</i>

<b>/sell_usd &lt;amount&gt; &lt;date&gt;</b>
Sell USD
<i>Example: /sell_usd 50 2026-02-04</i>

<b>/status</b>
Show current balance and statistics

<b>/start</b>
Main menu

<b>💡 How it works:</b>

<b>Tax Base</b> - fixed at NBU rate on USD receipt date and never changes.

<b>Sale</b> - occurs at Monobank rate. Uses FIFO method (oldest USD sold first).

<b>Profit/Loss</b> = (Sale amount in UAH) - (Tax base of sold USD)

<b>Unrealized P&L</b> - shows potential result if all USD sold today.
    `;

    bot.sendMessage(chatId, helpMessage, {
      parse_mode: 'HTML',
      reply_markup: this.getBackToMenuKeyboard()
    });
  }

  /**
   * Handle /add_usd command
   */
  static async handleAddUsd(bot: TelegramBot, msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    if (!userId) {
      bot.sendMessage(chatId, '❌ Не вдалося ідентифікувати користувача');
      return;
    }

    const args = msg.text?.split(' ').slice(1);
    
    if (!args || args.length < 2) {
      bot.sendMessage(chatId,
        '❌ <b>Incorrect format</b>\n\n' +
        'Usage: <code>/add_usd &lt;amount&gt; &lt;YYYY-MM-DD&gt;</code>\n' +
        'Example: <code>/add_usd 100 2026-02-01</code>',
        { 
          parse_mode: 'HTML',
          reply_markup: this.getBackToMenuKeyboard()
        }
      );
      return;
    }

    const amount = parseFloat(args[0]);
    const dateStr = args[1];

    // Validate amount
    if (isNaN(amount) || amount <= 0) {
      bot.sendMessage(chatId, '❌ Amount must be a positive number', {
        reply_markup: this.getBackToMenuKeyboard()
      });
      return;
    }

    // Validate date
    const date = this.parseDate(dateStr);
    if (!date) {
      bot.sendMessage(chatId, 
        '❌ Incorrect date format\n\n' +
        'Use format: <code>YYYY-MM-DD</code>\n' +
        'Example: <code>2026-02-01</code>',
        { 
          parse_mode: 'HTML',
          reply_markup: this.getBackToMenuKeyboard()
        }
      );
      return;
    }

    if (date > new Date()) {
      bot.sendMessage(chatId, '❌ Дата не може бути в майбутньому', {
        reply_markup: this.getBackToMenuKeyboard()
      });
      return;
    }

    // Execute add USD
    const loadingMsg = await bot.sendMessage(chatId, '⏳ Getting NBU rate...');
    
    const result = await UsdService.addUsd(userId, amount, date);
    
    await bot.deleteMessage(chatId, loadingMsg.message_id);
    
    if (result.success) {
      const message = `
✅ <b>Income added</b>

💵 Amount: <b>$${result.amountUsd.toFixed(2)}</b>
📅 Date: ${date.toISOString().split('T')[0]}
📈 NBU rate: <b>${result.nbuRate.toFixed(2)} UAH</b>
💼 Tax base: <b>${result.taxBaseUah.toFixed(2)} UAH</b>

━━━━━━━━━━━━━━━━
💰 Your balance: <b>$${result.newBalance.toFixed(2)}</b>
      `;
      
      bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        reply_markup: this.getBackToMenuKeyboard()
      });
    } else {
      bot.sendMessage(chatId, `❌ ${result.message}`, {
        reply_markup: this.getBackToMenuKeyboard()
      });
    }
  }

  /**
   * Handle /sell_usd command
   */
  static async handleSellUsd(bot: TelegramBot, msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    if (!userId) {
      bot.sendMessage(chatId, '❌ Не вдалося ідентифікувати користувача');
      return;
    }

    const args = msg.text?.split(' ').slice(1);
    
    if (!args || args.length < 2) {
      bot.sendMessage(chatId,
        '❌ <b>Incorrect format</b>\n\n' +
        'Usage: <code>/sell_usd &lt;amount&gt; &lt;YYYY-MM-DD&gt;</code>\n' +
        'Example: <code>/sell_usd 50 2026-02-04</code>',
        { 
          parse_mode: 'HTML',
          reply_markup: this.getBackToMenuKeyboard()
        }
      );
      return;
    }

    const amount = parseFloat(args[0]);
    const dateStr = args[1];

    // Validate amount
    if (isNaN(amount) || amount <= 0) {
      bot.sendMessage(chatId, '❌ Amount must be a positive number', {
        reply_markup: this.getBackToMenuKeyboard()
      });
      return;
    }

    // Validate date
    const date = this.parseDate(dateStr);
    if (!date) {
      bot.sendMessage(chatId,
        '❌ Incorrect date format\n\n' +
        'Use format: <code>YYYY-MM-DD</code>\n' +
        'Example: <code>2026-02-04</code>',
        { 
          parse_mode: 'HTML',
          reply_markup: this.getBackToMenuKeyboard()
        }
      );
      return;
    }

    // Check that date is not in future
    if (date > new Date()) {
      bot.sendMessage(chatId, '❌ Date cannot be in the future', {
        reply_markup: this.getBackToMenuKeyboard()
      });
      return;
    }

    // Execute sell USD
    const loadingMsg = await bot.sendMessage(chatId, '⏳ Getting Monobank rate...');
    
    const result = await UsdService.sellUsd(userId, amount, date);
    
    await bot.deleteMessage(chatId, loadingMsg.message_id);
    
    if (result.success) {
      const profitEmoji = result.profit >= 0 ? '💰' : '📉';
      const profitText = result.profit >= 0 
        ? `Profit: <b>+${result.profit.toFixed(2)} UAH</b>`
        : `Loss: <b>${result.profit.toFixed(2)} UAH</b>`;

      const message = `
✅ <b>USD sold</b>

💵 Amount: <b>$${result.amountUsd.toFixed(2)}</b>
📅 Date: ${date.toISOString().split('T')[0]}
💱 Monobank rate: <b>${result.monobankRate.toFixed(2)} UAH</b>
💸 Received: <b>${result.sellUah.toFixed(2)} UAH</b>
📋 Tax base: <b>${result.taxBaseUah.toFixed(2)} UAH</b>

${profitEmoji} ${profitText}

━━━━━━━━━━━━━━━━
💰 Your balance: <b>$${result.newBalance.toFixed(2)}</b>
      `;

      bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        reply_markup: this.getBackToMenuKeyboard()
      });
    } else {
      bot.sendMessage(chatId, `❌ ${result.message}`, {
        reply_markup: this.getBackToMenuKeyboard()
      });
    }
  }

  /**
   * Handle /status command
   */
  static async handleStatus(bot: TelegramBot, chatId: number, userId: number): Promise<void> {
    const loadingMsg = await bot.sendMessage(chatId, '⏳ Getting data...');

    try {
      const status = await UsdService.getStatus(userId);

      await bot.deleteMessage(chatId, loadingMsg.message_id);

      if (status.balanceUsd === 0) {
        bot.sendMessage(chatId, 
          '📊 <b>You have no USD balance</b>\n\n' +
          'Use /add_usd to add income.', 
          {
            parse_mode: 'HTML',
            reply_markup: this.getBackToMenuKeyboard()
          }
        );
        return;
      }

      const profitEmoji = status.unrealizedProfitUah >= 0 ? '💰' : '📉';
      const profitText = status.unrealizedProfitUah >= 0 
        ? `<b>+${status.unrealizedProfitUah.toFixed(2)} UAH</b>`
        : `<b>${status.unrealizedProfitUah.toFixed(2)} UAH</b>`;

      const message = `
📊 <b>Your Status</b>

━━━━━━━━━━━━━━━━
💵 <b>USD Balance:</b> $${status.balanceUsd.toFixed(2)}

📋 <b>Tax Base (NBU):</b>
${status.taxBaseUah.toFixed(2)} UAH

💱 <b>Current Value (Monobank):</b>
${status.currentValueUah.toFixed(2)} UAH
<i>Rate: ${status.currentMonobankRate.toFixed(2)} UAH</i>

${profitEmoji} <b>Unrealized Result:</b>
${profitText}
      `;

      bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        reply_markup: this.getBackToMenuKeyboard()
      });
    } catch (error) {
      await bot.deleteMessage(chatId, loadingMsg.message_id);
      bot.sendMessage(chatId, 
        `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { reply_markup: this.getBackToMenuKeyboard() }
      );
    }
  }

  /**
   * Parse date from YYYY-MM-DD format
   */
  private static parseDate(dateStr: string): Date | null {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    
    if (!regex.test(dateStr)) {
      return null;
    }

    const date = new Date(dateStr);
    
    if (isNaN(date.getTime())) {
      return null;
    }

    return date;
  }
}
