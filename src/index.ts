import TelegramBot from 'node-telegram-bot-api';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { BotHandlers } from './handlers/BotHandlers';
import { NotificationService } from './services/NotificationService';

// Load environment variables
dotenv.config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;
const ALLOWED_USER_ID = process.env.ALLOWED_USER_ID ? parseInt(process.env.ALLOWED_USER_ID) : null;

if (!TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN не знайдено в .env');
  process.exit(1);
}

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI не знайдено в .env');
  process.exit(1);
}

/**
 * Check user access
 */
function checkUserAccess(userId: number): boolean {
  if (ALLOWED_USER_ID === null) {
    console.warn('⚠️ ALLOWED_USER_ID not configured - access allowed for everyone');
    return true;
  }
  return userId === ALLOWED_USER_ID;
}

/**
 * Handle unauthorized access
 */
function handleUnauthorized(bot: TelegramBot, chatId: number): void {
  bot.sendMessage(chatId, '🚫 <b>Access denied</b>\n\nThis bot is available only to authorized users.', {
    parse_mode: 'HTML'
  });
}

/**
 * Connect to MongoDB
 */
async function connectToDatabase(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI as string);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

/**
 * Initialize bot
 */
async function startBot(): Promise<void> {
  // Connect to database
  await connectToDatabase();

  // Create bot
  const bot = new TelegramBot(TELEGRAM_BOT_TOKEN as string, { polling: true });

  console.log('✅ Bot started');
  if (ALLOWED_USER_ID) {
    console.log(`🔒 Allowed user: ${ALLOWED_USER_ID}`);
  } else {
    console.warn('⚠️ Open access mode (configure ALLOWED_USER_ID in .env)');
  }

  // Auto-register user for notifications on any command
  bot.on('message', (msg: TelegramBot.Message) => {
    const userId = msg.from?.id;
    if (userId && checkUserAccess(userId)) {
      NotificationService.registerUser(userId, msg.chat.id);
    }
  });

  // Command /start
  bot.onText(/\/start/, (msg: TelegramBot.Message) => {
    const userId = msg.from?.id;
    if (!userId || !checkUserAccess(userId)) {
      handleUnauthorized(bot, msg.chat.id);
      return;
    }
    BotHandlers.handleStart(bot, msg.chat.id);
  });

  bot.onText(/\/help/, (msg: TelegramBot.Message) => {
    const userId = msg.from?.id;
    if (!userId || !checkUserAccess(userId)) {
      handleUnauthorized(bot, msg.chat.id);
      return;
    }
    BotHandlers.handleHelp(bot, msg.chat.id);
  });

  bot.onText(/\/add_usd/, (msg: TelegramBot.Message) => {
    const userId = msg.from?.id;
    if (!userId || !checkUserAccess(userId)) {
      handleUnauthorized(bot, msg.chat.id);
      return;
    }
    BotHandlers.handleAddUsd(bot, msg);
  });

  bot.onText(/\/sell_usd/, (msg: TelegramBot.Message) => {
    const userId = msg.from?.id;
    if (!userId || !checkUserAccess(userId)) {
      handleUnauthorized(bot, msg.chat.id);
      return;
    }
    BotHandlers.handleSellUsd(bot, msg);
  });

  bot.onText(/\/status/, (msg: TelegramBot.Message) => {
    const userId = msg.from?.id;
    if (!userId || !checkUserAccess(userId)) {
      handleUnauthorized(bot, msg.chat.id);
      return;
    }
    BotHandlers.handleStatus(bot, msg.chat.id, userId);
  });

  // Command /test_notification - manually trigger notification check
  bot.onText(/\/test_notification/, async (msg: TelegramBot.Message) => {
    const userId = msg.from?.id;
    if (!userId || !checkUserAccess(userId)) {
      handleUnauthorized(bot, msg.chat.id);
      return;
    }
    
    const chatId = msg.chat.id;
    console.log(`🧪 Manual notification test triggered by user ${userId}`);
    
    try {
      await NotificationService.testNotification(bot, userId, chatId);
    } catch (error) {
      bot.sendMessage(chatId, `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // Handle reply keyboard button presses (plain text messages)
  bot.on('message', (msg: TelegramBot.Message) => {
    const userId = msg.from?.id;
    const chatId = msg.chat.id;
    const text = msg.text;

    // Skip if no text or if it's a command
    if (!text || text.startsWith('/')) {
      return;
    }

    // Check access
    if (!userId || !checkUserAccess(userId)) {
      handleUnauthorized(bot, chatId);
      return;
    }

    // Handle keyboard buttons by text
    switch (text) {
      case '➕ Add USD':
        BotHandlers.handleAddUsdCallback(bot, chatId);
        break;
      case '💰 Sell USD':
        BotHandlers.handleSellUsdCallback(bot, chatId);
        break;
      case '📊 Status':
        BotHandlers.handleStatus(bot, chatId, userId);
        break;
      case '❓ Help':
        BotHandlers.handleHelp(bot, chatId);
        break;
    }
  });

  // Handle polling errors
  bot.on('polling_error', (error: Error) => {
    console.error('Polling error:', error);
  });

  // Handle unknown commands
  bot.on('message', (msg: TelegramBot.Message) => {
    const userId = msg.from?.id;
    const text = msg.text;
    
    if (text && text.startsWith('/') && !text.match(/^\/(start|help|add_usd|sell_usd|status)/)) {
      if (!userId || !checkUserAccess(userId)) {
        handleUnauthorized(bot, msg.chat.id);
        return;
      }
      bot.sendMessage(msg.chat.id, '❌ Unknown command. Use /help for list of available commands.');
    }
  });

  // Setup cron job for P&L notifications (4 times per day: 8:00, 12:00, 16:00, 20:00)
  cron.schedule('0 8,12,16,20 * * *', async () => {
    console.log('🔔 Running scheduled P&L check...');
    await NotificationService.checkAndNotify(bot);
  }, {
    timezone: "Europe/Kiev"
  });

  console.log('⏰ Scheduled P&L notifications for 08:00, 12:00, 16:00, 20:00 (Kyiv time)');
}

// Start bot
startBot().catch((error) => {
  console.error('❌ Critical error:', error);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⏹️  Stopping bot...');
  await mongoose.disconnect();
  console.log('✅ Disconnected from MongoDB');
  process.exit(0);
});
