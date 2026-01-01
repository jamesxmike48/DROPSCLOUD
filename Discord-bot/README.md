# Drops Cloud Discord Bot

A Discord bot that integrates with the Drops Cloud platform, allowing users to check drops, view stats, search, and more directly from Discord.

## Features

- `/drops` - View latest drops
- `/stats` - View your Drops Cloud stats
- `/balance` - Check your coin balance
- `/search <query>` - Search for drops
- `/leaderboard` - View top users
- `/services` - View available account generator services
- `/link` - Get link to connect your account

## Quick Deploy to Railway

### Step 1: Create Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to "Bot" section and click "Add Bot"
4. Click "Reset Token" and copy the token (save it for later)
5. Enable these Privileged Gateway Intents:
   - Server Members Intent
   - Message Content Intent
6. Go to "OAuth2" → "General" and copy your Client ID
7. Go to "OAuth2" → "URL Generator":
   - Select scopes: `bot` and `applications.commands`
   - Select bot permissions: `Send Messages`, `Embed Links`, `Use Slash Commands`
   - Copy the generated URL and open it to invite the bot to your server

### Step 2: Deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new)

1. Click the button above or go to [Railway](https://railway.app)
2. Create a new project from GitHub repo
3. Connect this repository
4. Add environment variables:
   - `DISCORD_BOT_TOKEN` - Your bot token from Step 1
   - `DISCORD_CLIENT_ID` - Your client ID from Step 1
   - `DATABASE_URL` - Your Neon database URL (same as main app)
   - `NEXT_PUBLIC_APP_URL` - Your Drops Cloud website URL
5. Click "Deploy"

The bot will automatically start and register slash commands when deployed.

## Local Development

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in your values
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run the bot:
   ```bash
   npm run dev
   ```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DISCORD_BOT_TOKEN` | Your Discord bot token | Yes |
| `DISCORD_CLIENT_ID` | Your Discord application client ID | Yes |
| `DATABASE_URL` | Neon PostgreSQL connection string | Yes |
| `NEXT_PUBLIC_APP_URL` | Your Drops Cloud website URL | No |

## Database

The bot connects to the same Neon database as your main Drops Cloud application. Make sure the database has the Discord integration tables (run the migration script from the main app).

## Support

For issues or questions, visit [drops.cloud/support](https://drops.cloud/support)
