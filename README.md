# FOP Dollar Bot 💵

Telegram-бот для обліку доходів у USD з автоматичним розрахунком податкової бази, прибутку/збитку та підтримкою FIFO.

## 🎯 Основні можливості

- ✅ Додавання доходів у USD з фіксацією курсу НБУ на дату отримання
- 💰 Продаж USD з автоматичним розрахунком прибутку/збитку за методом FIFO
- 📊 Перегляд поточного балансу та статистики
- 💱 Інтеграція з API НБУ та Monobank для актуальних курсів валют
- 🗄️ Зберігання даних у MongoDB
- 🔒 Обмеження доступу по UserID (тільки для авторизованого користувача)
- 🎨 User-friendly інтерфейс з інлайн кнопками
- ⚡ Кеш курсів валют на 6 місяців для швидкості
- ✅ Покриття тестами (Jest)
- 🔧 ESLint для якості коду

## 📋 Команди бота

### `/start`
Головне меню з інтерактивними кнопками:
- ➕ Додати USD
- 💰 Продати USD
- 📊 Статус
- ❓ Довідка

### `/add_usd <сума> <YYYY-MM-DD>`
Додати дохід у доларах на певну дату.

**Приклад:**
```
/add_usd 100 2026-02-01
```

Бот автоматично:
- Отримає курс НБУ USD→UAH на вказану дату (з кешу або API)
- Розрахує податкову базу (сума × курс НБУ)
- Збільшить баланс USD
- Покаже красиве повідомлення з деталями

### `/sell_usd <сума> <YYYY-MM-DD>`
Продати долари на певну дату.

**Приклад:**
```
/sell_usd 50 2026-02-04
```

Бот автоматично:
- Перевірить достатність коштів
- Отримає курс Monobank (продаж) на дату
- Спише USD за принципом FIFO (першим прийшов - першим пішов)
- Розрахує прибуток/збиток: `(сума продажу) - (податкова база)`
- Зменшить баланс USD
- Покаже детальну інформацію про операцію

### `/status`
Показати поточний статус.

**Інформація:**
- 💵 Баланс USD
- 📋 Податкова база залишку (за курсом НБУ на дату отримання)
- 💱 Поточна вартість залишку (за курсом Monobank сьогодні)
- 💰/📉 Нереалізований прибуток/збиток

### `/help` або `/start`
Показати список команд та інструкцію.

## 🚀 Встановлення та запуск

### 1. Клонування репозиторію
```bash
cd FopDollarBot
```

### 2. Встановлення залежностей
```bash
npm install
```

### 3. Налаштування змінних оточення

Створіть файл `.env` на основі `.env.example`:
```bash
cp .env.example .env
```

Відредагуйте `.env` та додайте свої дані:
```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/fop_dollar_bot?retryWrites=true&w=majority
ALLOWED_USER_ID=your_telegram_user_id_here
```

#### Як отримати токен Telegram бота:
1. Відкрийте [@BotFather](https://t.me/BotFather) у Telegram
2. Відправте `/newbot`
3. Дайте ім'я боту та username
4. Скопіюйте отриманий токен у `.env`

#### Як дізнатись свій Telegram User ID:
1. Відкрийте [@userinfobot](https://t.me/userinfobot) у Telegram
2. Натисніть Start
3. Скопіюйте ваш User ID (число) у `.env`

**Важливо:** Тільки користувач з вказаним ALLOWED_USER_ID зможе користуватися ботом!

#### Як налаштувати MongoDB Atlas:
1. Зареєструйтесь на [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Створіть безкоштовний кластер (M0)
3. Додайте користувача бази даних
4. Додайте свою IP-адресу до whitelist (або `0.0.0.0/0` для доступу звідусіль)
5. Отримайте connection string та додайте його до `.env`

### 4. Збірка проєкту
```bash
npm run build
```

### 5. Запуск бота

**Режим розробки:**
```bash
npm run dev
```

**Продакшн:**
```bash
npm start
```

### 6. Запуск тестів

**Всі тести:**
```bash
npm test
```

**Watch режим:**
```bash
npm run test:watch
```

**З coverage:**
```bash
npm run test:coverage
```

### 7. Перевірка коду (ESLint)

**Перевірити:**
```bash
npm run lint
```

**Виправити автоматично:**
```bash
npm run lint:fix
```

## 🐳 Docker (рекомендований спосіб для сервера)

### Швидкий запуск з Docker Compose

Найпростіший спосіб розгорнути бота на сервері - використовувати Docker:

```bash
# 1. Створіть .env файл
cp .env.example .env
# Відредагуйте .env (встановіть TELEGRAM_BOT_TOKEN, ALLOWED_USER_ID, MONGODB_URI)

# 2. Запустіть Docker Compose
docker-compose up -d

# 3. Перегляньте логи
docker-compose logs -f bot
```

Docker Compose автоматично:
- ✅ Побудує та запустить бота в контейнері
- ✅ Налаштує автоматичний перезапуск
- ✅ Підключиться до вашого MongoDB Atlas кластера

**Примітка:** Використовуйте MongoDB Atlas або інший зовнішній MongoDB. Локальний MongoDB контейнер **не потрібен**.

**Докладна інструкція:** Дивіться [DOCKER.md](DOCKER.md) для повного гайду по розгортанню, оновленню та troubleshooting.

### Переваги Docker

- 🚀 Не потрібно встановлювати Node.js окремо
- 🔒 Ізольоване середовище
- 📦 Всі залежності вбудовані
- 🔄 Легке оновлення та відкат версій
- 💾 Простий деплой на сервері
- ⚡ Швидке розгортання

**Використовуйте MongoDB Atlas** для production - це безкоштовний хмарний MongoDB з автоматичними backup та scaling.

## 🏗️ Архітектура

```
src/
├── index.ts                  # Точка входу, ініціалізація бота
├── models/                   # Mongoose моделі
│   ├── UsdIncome.ts          # Модель доходів у USD
│   ├── UsdSale.ts            # Модель продажів USD
│   └── CurrencyCache.ts      # Кеш курсів валют (6 міс.)
├── services/                 # Бізнес-логіка
│   ├── CurrencyService.ts    # Робота з API курсів валют + кеш
│   └── UsdService.ts         # FIFO, розрахунки P&L
├── handlers/                 # Обробники команд бота
│   └── BotHandlers.ts        # Обробка команд + інлайн кнопки
└── __tests__/                # Тести Jest
    ├── CurrencyService.test.ts
    └── UsdService.test.ts
```

## 📦 База даних

### Колекція `usd_incomes`:
```typescript
{
  userId: number;         // ID користувача Telegram
  amountUsd: number;      // Сума доходу в USD
  remainingUsd: number;   // Залишок USD (для FIFO)
  nbuRate: number;        // Курс НБУ на дату доходу
  taxBaseUah: number;     // Податкова база в UAH
  date: Date;             // Дата отримання доходу
  createdAt: Date;        // Дата створення запису
}
```

### Колекція `usd_sales`:
```typescript
{
  userId: number;         // ID користувача Telegram
  amountUsd: number;      // Сума продажу в USD
  sellDate: Date;         // Дата продажу
  monobankRate: number;   // Курс Monobank на дату продажу
  sellUah: number;        // Отримана сума в UAH
  taxBaseUah: number;     // Податкова база проданих USD
  profit: number;         // Прибуток/збиток
  createdAt: Date;        // Дата створення запису
}
```

### Колекція `currency_caches`:
```typescript
{
  provider: string;       // 'nbu' або 'monobank'
  currencyCode: string;   // 'USD'
  date: Date;             // Дата курсу
  rate: number;           // Курс валюти
  cachedAt: Date;         // Коли закешовано
  expiresAt: Date;        // Коли видалити (TTL: 6 місяців)
}
```

## 🔄 Принцип роботи FIFO

При продажу USD бот використовує метод **FIFO** (First In, First Out):

1. Знаходить найстаріші доходи з залишком USD
2. Списує USD у порядку їх надходження
3. Розраховує податкову базу для кожного списання пропорційно
4. Сумує загальну податкову базу проданих USD
5. Обчислює прибуток: `(сума продажу в UAH) - (податкова база)`

**Приклад:**
```
Дохід 1: 100 USD @ 40 грн (01.02.2026)
Дохід 2: 50 USD @ 41 грн (05.02.2026)

Продаж: 120 USD @ 42 грн (10.02.2026)

FIFO:
- 100 USD з Доходу 1: база = 4000 грн
- 20 USD з Доходу 2: база = 820 грн (пропорційно)
- Загальна база: 4820 грн

Продаж: 120 × 42 = 5040 грн
Прибуток: 5040 - 4820 = 220 грн
```

## 🔌 API

### Monobank Public API
**Endpoint:** `https://api.monobank.ua/bank/currency`

Отримує поточні курси валют Monobank (оновлюються кожні 5 хвилин).
- Використовується `rateSell` для продажу USD
- Кешується на 6 місяців

### НБУ API
**Endpoint:** `https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json`

Отримує офіційні курси НБУ на конкретну дату.
- Використовується для податкової бази
- Кешується на 6 місяців

## 🛠️ Технології

### Основні
- **Node.js** + **TypeScript** - основа проєкту
- **node-telegram-bot-api** - Telegram Bot API з інлайн кнопками
- **mongoose** - ODM для MongoDB з TTL індексами
- **axios** - HTTP клієнт для API запитів
- **dotenv** - управління змінними оточення

### Розробка та тестування
- **Jest** - юніт-тести з coverage
- **ts-jest** - TypeScript для Jest
- **ESLint** - лінтер з TypeScript правилами
- **@typescript-eslint** - плагіни для ESLint

## 🔐 Безпека

- 🔒 **Обмеження доступу** - тільки один авторизований користувач (ALLOWED_USER_ID)
- ✅ **Валідація даних** - перевірка всіх вхідних параметрів
- 🛡️ **Захист API** - обробка помилок та rate limiting
- 📊 **Аудит операцій** - всі дії зберігаються в БД

## 📈 Покращення продуктивності

- ⚡ **Кеш курсів** - 6 місяців зберігання для швидкості
- 🗄️ **Індекси MongoDB** - швидкий пошук по userId та даті
- 🔄 **TTL індекс** - автоматичне видалення старих записів кешу
- 💾 **Пропорційні розрахунки** - оптимізована FIFO логіка

## 📝 Ліцензія

ISC

## 👨‍💻 Розробка

**Структура скриптів:**
- `npm run dev` - запуск у режимі розробки (ts-node)
- `npm run build` - збірка TypeScript → JavaScript
- `npm start` - запуск зібраного проєкту
- `npm run watch` - watch mode для TypeScript
- `npm test` - запуск тестів
- `npm run test:watch` - тести в watch mode
- `npm run test:coverage` - тести з coverage звітом
- `npm run lint` - перевірка коду ESLint
- `npm run lint:fix` - автоматичне виправлення помилок ESLint

**Створено для FOP-підприємців** 🇺🇦
