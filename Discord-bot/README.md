# Drops Cloud Discord Bot

Discord bot for the Drops Cloud platform with commands for viewing drops, checking stats, and managing accounts.

## Features

- View latest drops
- Check user stats and coin balance
- Search for specific drops
- View available account services
- Link Discord account to Drops Cloud

## Setup for Replit

### 1. Create Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and name it "Drops Cloud Bot"
3. Go to "Bot" section and click "Add Bot"
4. **Copy the bot token** (click "Reset Token" if needed)
5. Go to "General Information" and **copy the Application ID**
6. Enable these intents under Bot settings:
   - Server Members Intent
   - Message Content Intent
7. Go to OAuth2 > URL Generator:
   - Select scopes: `bot` and `applications.commands`
   - Select bot permissions: Send Messages, Embed Links, Use Slash Commands
   - Copy the generated URL and invite the bot to your server

### 2. Deploy on Replit

1. Create a new Repl on Replit
2. Import this repository or upload these files
3. Go to "Secrets" (lock icon in left sidebar)
4. Add these secrets:
   - `DISCORD_TOKEN`: Your bot token from step 1
   - `DISCORD_CLIENT_ID`: Your application ID from step 1
   - `DATABASE_URL`: Your Neon PostgreSQL connection string (from your Drops Cloud app)
5. Click "Run" button

### 3. Keep Bot Online (Replit)

Replit may stop your bot when inactive. To keep it running 24/7:
- Use Replit's "Always On" feature (requires paid plan)
- Or use a service like UptimeRobot to ping your repl every 5 minutes

## Commands

| Command | Description | Requires Linked Account |
|---------|-------------|-------------------------|
| `/drops` | View the latest 5 drops | No |
| `/stats` | View your account stats | Yes |
| `/balance` | Check your coin balance | Yes |
| `/search <query>` | Search for drops | No |
| `/services` | View available services | No |
| `/link` | Instructions to link account | No |

## Environment Variables

- `DISCORD_TOKEN` - Your Discord bot token (from Discord Developer Portal)
- `DISCORD_CLIENT_ID` - Your Discord application ID
- `DATABASE_URL` - Your Neon PostgreSQL connection string (same as your web app)

## Troubleshooting

**Commands not showing up:**
- Wait a few minutes after bot starts (Discord needs time to register commands)
- Make sure bot has proper permissions in your server
- Try kicking and re-inviting the bot

**Database errors:**
- Verify DATABASE_URL is correct (should start with `postgresql://`)
- Make sure your Neon database is accessible (not paused)
- Check that all required tables exist (users, drops, account_services)

**"An error occurred" messages:**
- Check Replit console for detailed error logs
- Verify all environment variables are set correctly
- Make sure bot has been invited to your server

## Local Development

```bash
# Install dependencies
npm install

# Create .env file with your credentials
cp .env.example .env

# Run in development mode
npm run dev

# Build for production
npm run build

# Start production
npm start
```

## Support

For issues, check the Replit console logs. Most errors are related to missing environment variables or database connection issues.
