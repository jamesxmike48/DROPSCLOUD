import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from "discord.js"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
})

// Commands
const commands = [
  new SlashCommandBuilder().setName("drops").setDescription("View latest drops on Drops Cloud"),

  new SlashCommandBuilder().setName("stats").setDescription("View your Drops Cloud stats"),

  new SlashCommandBuilder().setName("balance").setDescription("Check your coin balance"),

  new SlashCommandBuilder()
    .setName("search")
    .setDescription("Search for drops")
    .addStringOption((option) => option.setName("query").setDescription("Search term").setRequired(true)),

  new SlashCommandBuilder().setName("leaderboard").setDescription("View top users"),

  new SlashCommandBuilder().setName("services").setDescription("View available account generator services"),

  new SlashCommandBuilder().setName("link").setDescription("Link your Drops Cloud account"),
].map((cmd) => cmd.toJSON())

client.once("ready", async () => {
  console.log(`✅ Bot logged in as ${client.user?.tag}`)

  // Register slash commands
  const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN!)
  try {
    await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!), { body: commands })
    console.log("✅ Slash commands registered")
  } catch (error) {
    console.error("❌ Error registering commands:", error)
  }
})

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return

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
      case "leaderboard":
        await handleLeaderboardCommand(interaction)
        break
      case "services":
        await handleServicesCommand(interaction)
        break
      case "link":
        await handleLinkCommand(interaction)
        break
    }
  } catch (error) {
    console.error("Error handling command:", error)
    await interaction.reply({ content: "❌ An error occurred", ephemeral: true })
  }
})

async function handleDropsCommand(interaction: any) {
  const drops = await sql`
    SELECT d.*, u.username, u.discord_username
    FROM drops d
    JOIN users u ON d.user_id = u.id
    WHERE d.is_active = true
    ORDER BY d.created_at DESC
    LIMIT 5
  `

  if (drops.length === 0) {
    await interaction.reply("No drops available right now.")
    return
  }

  const embed = {
    color: 0x8b5cf6,
    title: "🎁 Latest Drops",
    description: drops
      .map((d: any, i: number) => `**${i + 1}. ${d.title}**\n💰 ${d.price} coins | 👤 ${d.username}\n`)
      .join("\n"),
    footer: { text: "Visit drops.cloud for more!" },
  }

  await interaction.reply({ embeds: [embed] })
}

async function handleStatsCommand(interaction: any) {
  const user = await sql`
    SELECT u.*, 
      (SELECT COUNT(*) FROM drops WHERE user_id = u.id) as drops_created,
      (SELECT COUNT(*) FROM drop_claims WHERE user_id = u.id) as drops_claimed
    FROM users u
    WHERE u.discord_id = ${interaction.user.id}
  `

  if (user.length === 0) {
    await interaction.reply({
      content: "❌ Account not linked. Use `/link` to connect your account.",
      ephemeral: true,
    })
    return
  }

  const u = user[0]
  const embed = {
    color: 0x8b5cf6,
    title: `📊 Stats for ${u.username}`,
    fields: [
      { name: "💰 Coins", value: u.coins.toString(), inline: true },
      { name: "🎁 Drops Created", value: u.drops_created.toString(), inline: true },
      { name: "📥 Drops Claimed", value: u.drops_claimed.toString(), inline: true },
      { name: "👑 Role", value: u.role, inline: true },
    ],
    thumbnail: { url: u.discord_avatar || "https://cdn.discordapp.com/embed/avatars/0.png" },
  }

  await interaction.reply({ embeds: [embed] })
}

async function handleBalanceCommand(interaction: any) {
  const user = await sql`
    SELECT coins, username FROM users WHERE discord_id = ${interaction.user.id}
  `

  if (user.length === 0) {
    await interaction.reply({
      content: "❌ Account not linked. Use `/link` to connect your account.",
      ephemeral: true,
    })
    return
  }

  await interaction.reply(`💰 ${user[0].username}'s balance: **${user[0].coins} coins**`)
}

async function handleSearchCommand(interaction: any) {
  const query = interaction.options.getString("query")

  const drops = await sql`
    SELECT d.*, u.username
    FROM drops d
    JOIN users u ON d.user_id = u.id
    WHERE d.is_active = true 
      AND (d.title ILIKE ${`%${query}%`} OR d.description ILIKE ${`%${query}%`})
    ORDER BY d.created_at DESC
    LIMIT 5
  `

  if (drops.length === 0) {
    await interaction.reply(`No drops found for "${query}"`)
    return
  }

  const embed = {
    color: 0x8b5cf6,
    title: `🔍 Search Results: "${query}"`,
    description: drops
      .map((d: any, i: number) => `**${i + 1}. ${d.title}**\n💰 ${d.price} coins | 👤 ${d.username}\n`)
      .join("\n"),
  }

  await interaction.reply({ embeds: [embed] })
}

async function handleLeaderboardCommand(interaction: any) {
  const users = await sql`
    SELECT username, coins, role,
      (SELECT COUNT(*) FROM drops WHERE user_id = users.id) as drops_created
    FROM users
    ORDER BY coins DESC
    LIMIT 10
  `

  const embed = {
    color: 0xffd700,
    title: "🏆 Top Users Leaderboard",
    description: users
      .map((u: any, i: number) => {
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`
        return `${medal} **${u.username}**\n💰 ${u.coins} coins | 🎁 ${u.drops_created} drops`
      })
      .join("\n\n"),
  }

  await interaction.reply({ embeds: [embed] })
}

async function handleServicesCommand(interaction: any) {
  const services = await sql`
    SELECT name, display_name, description, 
      (SELECT COUNT(*) FROM account_stock WHERE service_id = account_services.id AND is_claimed = false) as stock
    FROM account_services
    WHERE is_active = true
    ORDER BY display_name
    LIMIT 10
  `

  if (services.length === 0) {
    await interaction.reply("No services available.")
    return
  }

  const embed = {
    color: 0x8b5cf6,
    title: "🎮 Available Services",
    description: services.map((s: any) => `**${s.display_name}**\n📦 ${s.stock} in stock\n`).join("\n"),
    footer: { text: "Visit /account-generator to claim accounts!" },
  }

  await interaction.reply({ embeds: [embed] })
}

async function handleLinkCommand(interaction: any) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://drops.cloud"
  await interaction.reply({
    content: `🔗 Link your account here: ${appUrl}/settings\n\nOnce linked, you can use all bot commands!`,
    ephemeral: true,
  })
}

client.login(process.env.DISCORD_BOT_TOKEN)
