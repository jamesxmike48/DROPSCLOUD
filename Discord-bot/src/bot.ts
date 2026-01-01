import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from "discord.js"
import { neon } from "@neondatabase/serverless"

const DISCORD_TOKEN = process.env.DISCORD_TOKEN
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID
const DATABASE_URL = process.env.DATABASE_URL

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID || !DATABASE_URL) {
  console.error("Missing required environment variables!")
  console.error("Please set DISCORD_TOKEN, DISCORD_CLIENT_ID, and DATABASE_URL")
  process.exit(1)
}

const sql = neon(DATABASE_URL)

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
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
        d.price,
        d.service_type,
        d.created_at,
        u.username as creator_username 
      FROM drops d
      LEFT JOIN users u ON d.user_id = u.id
      WHERE d.is_active = true
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
        ? drop.description.length > 100
          ? drop.description.substring(0, 100) + "..."
          : drop.description
        : "No description"

      embed.addFields({
        name: drop.title || "Untitled Drop",
        value: `💰 ${drop.price || 0} coins | 👤 ${drop.creator_username || "Unknown"}\n${description}`,
        inline: false,
      })
    })

    embed.setFooter({ text: "Visit Drops Cloud to claim these drops!" })

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
        d.price,
        d.created_at,
        u.username as creator_username
      FROM drops d
      LEFT JOIN users u ON d.user_id = u.id
      WHERE d.is_active = true 
        AND (d.title ILIKE ${searchPattern} OR d.description ILIKE ${searchPattern})
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
        value: `💰 ${drop.price || 0} coins | 👤 ${drop.creator_username || "Unknown"}`,
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
        name, 
        display_name, 
        stock_count, 
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

    const embed = new EmbedBuilder()
      .setTitle("🎮 Available Account Services")
      .setColor(0x8b5cf6)
      .setDescription("Account generator services currently available")
      .setTimestamp()

    services.forEach((service: any) => {
      embed.addFields({
        name: service.display_name || service.name,
        value: `📦 Stock: ${service.stock_count || 0}`,
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

// Event handlers
client.once("ready", () => {
  console.log(`[Bot] Logged in as ${client.user?.tag}`)
  console.log(`[Bot] Serving ${client.guilds.cache.size} server(s)`)
  registerCommands()
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
