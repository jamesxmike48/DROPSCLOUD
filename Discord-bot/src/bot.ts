import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
  Partials,
} from "discord.js"
import { neon } from "@neondatabase/serverless"
import express from "express"

const DISCORD_TOKEN = process.env.DISCORD_TOKEN
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID
const DATABASE_URL = process.env.DATABASE_URL
const BOT_WEBHOOK_SECRET = process.env.BOT_WEBHOOK_SECRET || "your-secret-key-here"
const BOT_PORT = process.env.BOT_PORT || 3001

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID || !DATABASE_URL) {
  console.error("Missing required environment variables!")
  console.error("Please set DISCORD_TOKEN, DISCORD_CLIENT_ID, and DATABASE_URL")
  process.exit(1)
}

const sql = neon(DATABASE_URL)

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
})

// Define commands
const commands = [
  new SlashCommandBuilder().setName("drops").setDescription("View the latest drops on Drops Cloud"),
  new SlashCommandBuilder().setName("stats").setDescription("View your Drops Cloud stats"),
  new SlashCommandBuilder().setName("balance").setDescription("Check your coin balance"),
  new SlashCommandBuilder()
    .setName("search")
    .setDescription("Search for drops")
    .addStringOption((option) => option.setName("query").setDescription("Search term").setRequired(true)),
  new SlashCommandBuilder().setName("services").setDescription("View available account generator services"),
  new SlashCommandBuilder().setName("link").setDescription("Get instructions to link your Discord account"),
  new SlashCommandBuilder()
    .setName("profile")
    .setDescription("View a user profile")
    .addUserOption((option) => option.setName("user").setDescription("Discord user to view").setRequired(false)),
  new SlashCommandBuilder().setName("announcements").setDescription("View the latest Drops Cloud announcements"),
  new SlashCommandBuilder()
    .setName("vip")
    .setDescription("Check VIP status")
    .addUserOption((option) => option.setName("user").setDescription("Discord user to check").setRequired(false)),
  new SlashCommandBuilder().setName("daily").setDescription("Claim your daily coin bonus"),
  new SlashCommandBuilder().setName("top").setDescription("View top drops by unlocks"),
].map((command) => command.toJSON())

// Register slash commands
const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN)

async function registerCommands() {
  try {
    console.log("[Bot] Registering slash commands...")
    await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), { body: commands })
    console.log("[Bot] Successfully registered slash commands!")
  } catch (error) {
    console.error("[Bot] Error registering commands:", error)
  }
}

// Command handlers with improved error handling
async function handleDropsCommand(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply()

    const drops = await sql`
      SELECT 
        d.id,
        d.title,
        d.description,
        d.cost,
        d.service,
        d.unlock_count,
        d.created_at,
        d.owner_username,
        d.owner_id
      FROM drops d
      WHERE d.is_visible = true AND d.is_expired = false
      ORDER BY d.created_at DESC
      LIMIT 5
    `

    if (!drops || drops.length === 0) {
      await interaction.editReply("No active drops found at the moment.")
      return
    }

    const embed = new EmbedBuilder()
      .setTitle("📦 Latest Drops on Drops Cloud")
      .setColor(0x8b5cf6)
      .setDescription("Here are the newest drops available")
      .setTimestamp()

    drops.forEach((drop: any) => {
      const description = drop.description
        ? drop.description.length > 80
          ? drop.description.substring(0, 80) + "..."
          : drop.description
        : "No description"

      embed.addFields({
        name: drop.title || "Untitled Drop",
        value: `💰 ${drop.cost || 0} coins | 🔓 ${drop.unlock_count || 0} unlocks\n👤 ${drop.owner_username || "Unknown"} | 🎮 ${drop.service || "General"}\n${description}`,
        inline: false,
      })
    })

    embed.setFooter({ text: "Visit Drops Cloud to unlock these drops!" })

    await interaction.editReply({ embeds: [embed] })
  } catch (error) {
    console.error("[Bot] Error in handleDropsCommand:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    if (interaction.deferred) {
      await interaction.editReply(`An error occurred while fetching drops: ${errorMessage}`)
    } else {
      await interaction.reply(`An error occurred while fetching drops: ${errorMessage}`)
    }
  }
}

async function handleStatsCommand(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply()

    const user = await sql`
      SELECT 
        username, 
        coins, 
        role, 
        vip_expires_at, 
        created_at
      FROM users
      WHERE discord_id = ${interaction.user.id}
      LIMIT 1
    `

    if (!user || user.length === 0) {
      await interaction.editReply("❌ You need to link your Discord account first.\nUse `/link` for instructions.")
      return
    }

    const userData = user[0]
    const isVip = userData.vip_expires_at && new Date(userData.vip_expires_at) > new Date()

    const embed = new EmbedBuilder()
      .setTitle(`📊 Stats for ${userData.username}`)
      .setColor(0x8b5cf6)
      .addFields(
        { name: "💰 Coins", value: (userData.coins || 0).toString(), inline: true },
        { name: "👑 Role", value: userData.role || "user", inline: true },
        { name: "⭐ VIP Status", value: isVip ? "✅ Active" : "❌ Inactive", inline: true },
        { name: "📅 Member Since", value: new Date(userData.created_at).toLocaleDateString(), inline: true },
      )
      .setTimestamp()

    if (isVip && userData.vip_expires_at) {
      embed.addFields({
        name: "⏰ VIP Expires",
        value: new Date(userData.vip_expires_at).toLocaleDateString(),
        inline: true,
      })
    }

    await interaction.editReply({ embeds: [embed] })
  } catch (error) {
    console.error("[Bot] Error in handleStatsCommand:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    if (interaction.deferred) {
      await interaction.editReply(`An error occurred while fetching your stats: ${errorMessage}`)
    } else {
      await interaction.reply(`An error occurred while fetching your stats: ${errorMessage}`)
    }
  }
}

async function handleBalanceCommand(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply()

    const user = await sql`
      SELECT username, coins
      FROM users
      WHERE discord_id = ${interaction.user.id}
      LIMIT 1
    `

    if (!user || user.length === 0) {
      await interaction.editReply("❌ You need to link your Discord account first.\nUse `/link` for instructions.")
      return
    }

    const embed = new EmbedBuilder()
      .setTitle("💰 Coin Balance")
      .setColor(0x10b981)
      .setDescription(`**${user[0].username}** has **${user[0].coins || 0}** coins`)
      .setTimestamp()

    await interaction.editReply({ embeds: [embed] })
  } catch (error) {
    console.error("[Bot] Error in handleBalanceCommand:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    if (interaction.deferred) {
      await interaction.editReply(`An error occurred while fetching your balance: ${errorMessage}`)
    } else {
      await interaction.reply(`An error occurred while fetching your balance: ${errorMessage}`)
    }
  }
}

async function handleSearchCommand(interaction: ChatInputCommandInteraction) {
  const query = interaction.options.getString("query", true)

  try {
    await interaction.deferReply()

    const searchPattern = `%${query}%`
    const results = await sql`
      SELECT 
        d.id,
        d.title,
        d.description,
        d.cost,
        d.service,
        d.unlock_count,
        d.created_at,
        d.owner_username
      FROM drops d
      WHERE d.is_visible = true 
        AND d.is_expired = false
        AND (d.title ILIKE ${searchPattern} OR d.description ILIKE ${searchPattern} OR d.service ILIKE ${searchPattern})
      ORDER BY d.created_at DESC
      LIMIT 5
    `

    if (!results || results.length === 0) {
      await interaction.editReply(`No drops found for "${query}".`)
      return
    }

    const embed = new EmbedBuilder()
      .setTitle(`🔍 Search Results for "${query}"`)
      .setColor(0x8b5cf6)
      .setDescription(`Found ${results.length} result(s)`)
      .setTimestamp()

    results.forEach((drop: any) => {
      embed.addFields({
        name: drop.title || "Untitled",
        value: `💰 ${drop.cost || 0} coins | 🔓 ${drop.unlock_count || 0} unlocks | 👤 ${drop.owner_username || "Unknown"}`,
        inline: false,
      })
    })

    await interaction.editReply({ embeds: [embed] })
  } catch (error) {
    console.error("[Bot] Error in handleSearchCommand:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    if (interaction.deferred) {
      await interaction.editReply(`An error occurred while searching: ${errorMessage}`)
    } else {
      await interaction.reply(`An error occurred while searching: ${errorMessage}`)
    }
  }
}

async function handleServicesCommand(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply()

    const services = await sql`
      SELECT 
        service_name, 
        display_name, 
        description,
        is_active
      FROM account_services
      WHERE is_active = true
      ORDER BY display_name
      LIMIT 15
    `

    if (!services || services.length === 0) {
      await interaction.editReply("No services available at the moment.")
      return
    }

    // Get stock counts
    const serviceCounts = await sql`
      SELECT 
        service_id,
        COUNT(*) as stock_count
      FROM account_stock
      WHERE status = 'available'
      GROUP BY service_id
    `

    const stockMap = new Map()
    serviceCounts.forEach((item: any) => {
      stockMap.set(item.service_id, item.stock_count)
    })

    const embed = new EmbedBuilder()
      .setTitle("🎮 Available Account Services")
      .setColor(0x8b5cf6)
      .setDescription("Account generator services currently available")
      .setTimestamp()

    services.forEach((service: any) => {
      const stockCount = stockMap.get(service.id) || 0
      embed.addFields({
        name: service.display_name || service.service_name,
        value: `📦 Stock: ${stockCount}`,
        inline: true,
      })
    })

    embed.setFooter({ text: "Visit /account-generator to claim accounts!" })

    await interaction.editReply({ embeds: [embed] })
  } catch (error) {
    console.error("[Bot] Error in handleServicesCommand:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    if (interaction.deferred) {
      await interaction.editReply(`An error occurred while fetching services: ${errorMessage}`)
    } else {
      await interaction.reply(`An error occurred while fetching services: ${errorMessage}`)
    }
  }
}

async function handleLinkCommand(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle("🔗 Link Your Discord Account")
    .setColor(0x5865f2)
    .setDescription("To link your Discord account with Drops Cloud:")
    .addFields(
      { name: "Step 1", value: "Go to your Drops Cloud account settings page", inline: false },
      { name: "Step 2", value: 'Find the "Discord Integration" section', inline: false },
      { name: "Step 3", value: 'Click the "Link Discord Account" button', inline: false },
      { name: "Step 4", value: "Authorize the connection when prompted", inline: false },
    )
    .setFooter({ text: "Once linked, you can use personalized bot commands!" })
    .setTimestamp()

  await interaction.reply({ embeds: [embed], ephemeral: true })
}

async function handleProfileCommand(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply()

    const targetUser = interaction.options.getUser("user") || interaction.user

    const user = await sql`
      SELECT 
        username,
        coin_balance,
        role,
        vip_expires_at,
        created_at,
        bio,
        total_drops_created,
        total_coins_earned,
        career_tier
      FROM users
      WHERE discord_id = ${targetUser.id}
      LIMIT 1
    `

    if (!user || user.length === 0) {
      await interaction.editReply(`❌ ${targetUser.username} hasn't linked their Discord account yet.`)
      return
    }

    const userData = user[0]
    const isVip = userData.vip_expires_at && new Date(userData.vip_expires_at) > new Date()

    const embed = new EmbedBuilder()
      .setTitle(`👤 Profile: ${userData.username}`)
      .setColor(isVip ? 0xffd700 : 0x8b5cf6)
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields(
        { name: "💰 Coin Balance", value: (userData.coin_balance || 0).toString(), inline: true },
        { name: "👑 Role", value: userData.role || "user", inline: true },
        { name: "⭐ VIP", value: isVip ? "✅ Active" : "❌ Inactive", inline: true },
        { name: "📦 Drops Created", value: (userData.total_drops_created || 0).toString(), inline: true },
        { name: "💎 Total Earned", value: `${userData.total_coins_earned || 0} coins`, inline: true },
        { name: "🎯 Career Tier", value: userData.career_tier || "None", inline: true },
      )
      .setFooter({ text: `Member since ${new Date(userData.created_at).toLocaleDateString()}` })
      .setTimestamp()

    if (userData.bio) {
      embed.setDescription(userData.bio)
    }

    await interaction.editReply({ embeds: [embed] })
  } catch (error) {
    console.error("[Bot] Error in handleProfileCommand:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    if (interaction.deferred) {
      await interaction.editReply(`An error occurred: ${errorMessage}`)
    } else {
      await interaction.reply(`An error occurred: ${errorMessage}`)
    }
  }
}

async function handleAnnouncementsCommand(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply()

    const announcements = await sql`
      SELECT 
        title,
        message,
        type,
        created_at
      FROM announcements
      WHERE is_active = true 
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at DESC
      LIMIT 3
    `

    if (!announcements || announcements.length === 0) {
      await interaction.editReply("No active announcements at the moment.")
      return
    }

    const embed = new EmbedBuilder().setTitle("📢 Drops Cloud Announcements").setColor(0x3b82f6).setTimestamp()

    announcements.forEach((announcement: any) => {
      const typeEmoji =
        {
          info: "ℹ️",
          warning: "⚠️",
          success: "✅",
          error: "❌",
        }[announcement.type] || "📌"

      embed.addFields({
        name: `${typeEmoji} ${announcement.title}`,
        value:
          announcement.message.length > 200 ? announcement.message.substring(0, 200) + "..." : announcement.message,
        inline: false,
      })
    })

    await interaction.editReply({ embeds: [embed] })
  } catch (error) {
    console.error("[Bot] Error in handleAnnouncementsCommand:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    if (interaction.deferred) {
      await interaction.editReply(`An error occurred: ${errorMessage}`)
    } else {
      await interaction.reply(`An error occurred: ${errorMessage}`)
    }
  }
}

async function handleVipCommand(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply()

    const targetUser = interaction.options.getUser("user") || interaction.user

    const user = await sql`
      SELECT 
        username,
        vip_expires_at,
        vip_granted_at,
        vip_badge_color
      FROM users
      WHERE discord_id = ${targetUser.id}
      LIMIT 1
    `

    if (!user || user.length === 0) {
      await interaction.editReply(`❌ ${targetUser.username} hasn't linked their Discord account yet.`)
      return
    }

    const userData = user[0]
    const isVip = userData.vip_expires_at && new Date(userData.vip_expires_at) > new Date()

    const embed = new EmbedBuilder()
      .setTitle(`⭐ VIP Status: ${userData.username}`)
      .setColor(isVip ? 0xffd700 : 0x6b7280)
      .setThumbnail(targetUser.displayAvatarURL())

    if (isVip) {
      const daysRemaining = Math.ceil(
        (new Date(userData.vip_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      )

      embed.setDescription("✅ This user has an active VIP membership!")
      embed.addFields(
        { name: "📅 Expires On", value: new Date(userData.vip_expires_at).toLocaleDateString(), inline: true },
        { name: "⏰ Days Remaining", value: daysRemaining.toString(), inline: true },
        { name: "🎨 Badge Color", value: userData.vip_badge_color || "Default", inline: true },
      )
    } else {
      embed.setDescription("❌ This user does not have an active VIP membership.")
      embed.addFields({
        name: "💎 Get VIP",
        value: "Visit Drops Cloud to purchase VIP and enjoy exclusive benefits!",
        inline: false,
      })
    }

    await interaction.editReply({ embeds: [embed] })
  } catch (error) {
    console.error("[Bot] Error in handleVipCommand:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    if (interaction.deferred) {
      await interaction.editReply(`An error occurred: ${errorMessage}`)
    } else {
      await interaction.reply(`An error occurred: ${errorMessage}`)
    }
  }
}

async function handleDailyCommand(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply()

    const user = await sql`
      SELECT 
        id,
        username,
        coin_balance
      FROM users
      WHERE discord_id = ${interaction.user.id}
      LIMIT 1
    `

    if (!user || user.length === 0) {
      await interaction.editReply("❌ You need to link your Discord account first.\nUse `/link` for instructions.")
      return
    }

    const userId = user[0].id

    // Check last bonus claim
    const stats = await sql`
      SELECT 
        last_bonus_claimed_date,
        total_bonuses_claimed
      FROM user_stats
      WHERE user_id = ${userId}
      LIMIT 1
    `

    const today = new Date().toISOString().split("T")[0]
    const lastClaim = stats[0]?.last_bonus_claimed_date

    if (lastClaim === today) {
      await interaction.editReply(
        "❌ You've already claimed your daily bonus today!\nCome back tomorrow for more coins.",
      )
      return
    }

    const bonusAmount = 50
    const newBalance = user[0].coin_balance + bonusAmount

    // Update balance
    await sql`
      UPDATE users
      SET coin_balance = ${newBalance}
      WHERE id = ${userId}
    `

    // Update stats
    await sql`
      UPDATE user_stats
      SET 
        last_bonus_claimed_date = ${today},
        total_bonuses_claimed = COALESCE(total_bonuses_claimed, 0) + 1
      WHERE user_id = ${userId}
    `

    const embed = new EmbedBuilder()
      .setTitle("🎁 Daily Bonus Claimed!")
      .setColor(0x10b981)
      .setDescription(`**${user[0].username}** claimed their daily bonus!`)
      .addFields(
        { name: "💰 Bonus Amount", value: `+${bonusAmount} coins`, inline: true },
        { name: "💳 New Balance", value: `${newBalance} coins`, inline: true },
      )
      .setFooter({ text: "Come back tomorrow for another bonus!" })
      .setTimestamp()

    await interaction.editReply({ embeds: [embed] })
  } catch (error) {
    console.error("[Bot] Error in handleDailyCommand:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    if (interaction.deferred) {
      await interaction.editReply(`An error occurred: ${errorMessage}`)
    } else {
      await interaction.reply(`An error occurred: ${errorMessage}`)
    }
  }
}

async function handleTopCommand(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply()

    const topDrops = await sql`
      SELECT 
        title,
        unlock_count,
        cost,
        owner_username,
        service
      FROM drops
      WHERE is_visible = true AND is_expired = false
      ORDER BY unlock_count DESC
      LIMIT 5
    `

    if (!topDrops || topDrops.length === 0) {
      await interaction.editReply("No drops found.")
      return
    }

    const embed = new EmbedBuilder()
      .setTitle("🏆 Top Drops by Unlocks")
      .setColor(0xffd700)
      .setDescription("Most popular drops on Drops Cloud")
      .setTimestamp()

    topDrops.forEach((drop: any, index: number) => {
      const medal = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"][index]
      embed.addFields({
        name: `${medal} ${drop.title}`,
        value: `🔓 ${drop.unlock_count || 0} unlocks | 💰 ${drop.cost || 0} coins\n👤 ${drop.owner_username || "Unknown"} | 🎮 ${drop.service || "General"}`,
        inline: false,
      })
    })

    await interaction.editReply({ embeds: [embed] })
  } catch (error) {
    console.error("[Bot] Error in handleTopCommand:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    if (interaction.deferred) {
      await interaction.editReply(`An error occurred: ${errorMessage}`)
    } else {
      await interaction.reply(`An error occurred: ${errorMessage}`)
    }
  }
}

// Event handlers
client.once("ready", () => {
  console.log(`[Bot] Logged in as ${client.user?.tag}`)
  console.log(`[Bot] Serving ${client.guilds.cache.size} server(s)`)
  registerCommands()

  const app = express()
  app.use(express.json())

  app.post("/webhook/link", async (req, res) => {
    try {
      const authHeader = req.headers.authorization
      if (authHeader !== `Bearer ${BOT_WEBHOOK_SECRET}`) {
        return res.status(401).json({ error: "Unauthorized" })
      }

      const { discordId, username } = req.body

      if (!discordId || !username) {
        return res.status(400).json({ error: "Missing required fields" })
      }

      console.log(`[Bot] Received link notification for ${username} (${discordId})`)

      // Send welcome DM
      try {
        const user = await client.users.fetch(discordId)

        const welcomeEmbed = new EmbedBuilder()
          .setTitle("🎉 Discord Account Linked Successfully!")
          .setColor(0x10b981)
          .setDescription(`Welcome to Drops Cloud, **${username}**!`)
          .addFields(
            {
              name: "✅ Account Connected",
              value: "Your Discord account is now linked to Drops Cloud!",
              inline: false,
            },
            {
              name: "🤖 Bot Commands",
              value:
                "You can now use all bot commands:\n" +
                "• `/drops` - View latest drops\n" +
                "• `/stats` - Check your stats\n" +
                "• `/balance` - View coin balance\n" +
                "• `/search` - Search for drops\n" +
                "• `/services` - View account services\n" +
                "• `/profile` - View a user profile\n" +
                "• `/announcements` - View latest announcements\n" +
                "• `/vip` - Check VIP status\n" +
                "• `/daily` - Claim daily bonus\n" +
                "• `/top` - View top drops by unlocks",
              inline: false,
            },
            {
              name: "💡 What's Next?",
              value: "Start exploring drops, claim accounts, and earn coins on Drops Cloud!",
              inline: false,
            },
          )
          .setFooter({ text: "Thank you for joining Drops Cloud!" })
          .setTimestamp()

        await user.send({ embeds: [welcomeEmbed] })
        console.log(`[Bot] Welcome DM sent to ${username}`)

        res.json({ success: true, dmSent: true })
      } catch (dmError) {
        console.error(`[Bot] Failed to send DM to ${discordId}:`, dmError)
        res.json({ success: true, dmSent: false, error: "User has DMs disabled or bot cannot reach user" })
      }
    } catch (error) {
      console.error("[Bot] Error in webhook/link:", error)
      res.status(500).json({ error: "Internal server error" })
    }
  })

  app.get("/health", (req, res) => {
    res.json({ status: "ok", bot: client.user?.tag || "Not logged in" })
  })

  app.listen(BOT_PORT, () => {
    console.log(`[Bot] Webhook server listening on port ${BOT_PORT}`)
  })
})

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return

  console.log(`[Bot] Command received: ${interaction.commandName} from ${interaction.user.tag}`)

  try {
    switch (interaction.commandName) {
      case "drops":
        await handleDropsCommand(interaction)
        break
      case "stats":
        await handleStatsCommand(interaction)
        break
      case "balance":
        await handleBalanceCommand(interaction)
        break
      case "search":
        await handleSearchCommand(interaction)
        break
      case "services":
        await handleServicesCommand(interaction)
        break
      case "link":
        await handleLinkCommand(interaction)
        break
      case "profile":
        await handleProfileCommand(interaction)
        break
      case "announcements":
        await handleAnnouncementsCommand(interaction)
        break
      case "vip":
        await handleVipCommand(interaction)
        break
      case "daily":
        await handleDailyCommand(interaction)
        break
      case "top":
        await handleTopCommand(interaction)
        break
      default:
        await interaction.reply("Unknown command.")
    }
  } catch (error) {
    console.error("[Bot] Error handling interaction:", error)
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred"

    try {
      if (interaction.deferred) {
        await interaction.editReply(`An error occurred: ${errorMessage}`)
      } else if (!interaction.replied) {
        await interaction.reply(`An error occurred: ${errorMessage}`)
      }
    } catch (replyError) {
      console.error("[Bot] Error sending error message:", replyError)
    }
  }
})

client.on("error", (error) => {
  console.error("[Bot] Discord client error:", error)
})

process.on("unhandledRejection", (error) => {
  console.error("[Bot] Unhandled promise rejection:", error)
})

// Start the bot
console.log("[Bot] Starting Discord bot...")
client.login(DISCORD_TOKEN).catch((error) => {
  console.error("[Bot] Failed to login:", error)
  process.exit(1)
})
