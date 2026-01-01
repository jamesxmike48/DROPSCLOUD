import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, Colors } from "discord.js"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
})

// Define slash commands
const commands = [
  new SlashCommandBuilder().setName("drops").setDescription("View recent drops available"),

  new SlashCommandBuilder().setName("stats").setDescription("View your Drops Cloud stats"),

  new SlashCommandBuilder()
    .setName("balance")
    .setDescription("Check your coin balance")
    .addUserOption((option) => option.setName("user").setDescription("User to check (optional)").setRequired(false)),

  new SlashCommandBuilder().setName("link").setDescription("Link your Drops Cloud account with Discord"),

  new SlashCommandBuilder()
    .setName("search")
    .setDescription("Search for drops")
    .addStringOption((option) => option.setName("query").setDescription("Search query").setRequired(true)),

  new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("View top users")
    .addStringOption((option) =>
      option
        .setName("category")
        .setDescription("Leaderboard category")
        .setRequired(false)
        .addChoices(
          { name: "Coins", value: "coins" },
          { name: "Drops Created", value: "drops" },
          { name: "Drops Unlocked", value: "unlocked" },
        ),
    ),

  new SlashCommandBuilder().setName("services").setDescription("View available account generator services"),
].map((command) => command.toJSON())

// Register commands
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN!)

client.once("ready", async () => {
  console.log(`✅ Discord bot logged in as ${client.user?.tag}`)

  try {
    console.log("Started refreshing slash commands...")

    await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!), {
      body: commands,
    })

    console.log("Successfully reloaded slash commands!")
  } catch (error) {
    console.error("Error registering commands:", error)
  }
})

// Handle slash commands
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return

  const { commandName } = interaction

  try {
    if (commandName === "drops") {
      await handleDropsCommand(interaction)
    } else if (commandName === "stats") {
      await handleStatsCommand(interaction)
    } else if (commandName === "balance") {
      await handleBalanceCommand(interaction)
    } else if (commandName === "link") {
      await handleLinkCommand(interaction)
    } else if (commandName === "search") {
      await handleSearchCommand(interaction)
    } else if (commandName === "leaderboard") {
      await handleLeaderboardCommand(interaction)
    } else if (commandName === "services") {
      await handleServicesCommand(interaction)
    }
  } catch (error) {
    console.error(`Error handling ${commandName}:`, error)
    await interaction.reply({
      content: "An error occurred while processing your command.",
      ephemeral: true,
    })
  }
})

async function handleDropsCommand(interaction: any) {
  await interaction.deferReply()

  const drops = await sql`
    SELECT id, title, service, cost, owner_username, created_at
    FROM drops
    WHERE is_visible = true AND is_expired = false
    ORDER BY created_at DESC
    LIMIT 5
  `

  if (drops.length === 0) {
    await interaction.editReply("No drops available right now. Check back later!")
    return
  }

  const embed = new EmbedBuilder()
    .setTitle("🎁 Recent Drops")
    .setColor(Colors.Purple)
    .setDescription("Here are the latest drops available on Drops Cloud")
    .setTimestamp()

  drops.forEach((drop: any) => {
    embed.addFields({
      name: drop.title,
      value: `**Service:** ${drop.service}\n**Cost:** ${drop.cost} coins\n**Posted by:** ${drop.owner_username}`,
      inline: false,
    })
  })

  embed.setFooter({ text: "Visit drops-cloud.com to unlock drops" })

  await interaction.editReply({ embeds: [embed] })
}

async function handleStatsCommand(interaction: any) {
  await interaction.deferReply()

  const user = await getUserByDiscordId(interaction.user.id)

  if (!user) {
    await interaction.editReply({
      content: "You need to link your Drops Cloud account first! Use `/link` command.",
      ephemeral: true,
    })
    return
  }

  const stats = await sql`
    SELECT 
      coin_balance,
      total_coins_earned,
      total_drops_created,
      career_tier,
      role
    FROM users
    WHERE id = ${user.id}
  `

  if (stats.length === 0) {
    await interaction.editReply("Could not fetch your stats.")
    return
  }

  const userStats = stats[0]

  const embed = new EmbedBuilder()
    .setTitle(`📊 Stats for ${user.username}`)
    .setColor(Colors.Blue)
    .addFields(
      { name: "💰 Coins", value: userStats.coin_balance.toString(), inline: true },
      { name: "🪙 Total Earned", value: userStats.total_coins_earned.toString(), inline: true },
      { name: "🎁 Drops Created", value: userStats.total_drops_created.toString(), inline: true },
      { name: "🏆 Career Tier", value: userStats.career_tier || "None", inline: true },
      { name: "👑 Role", value: userStats.role, inline: true },
    )
    .setThumbnail(user.profile_picture || "")
    .setTimestamp()

  await interaction.editReply({ embeds: [embed] })
}

async function handleBalanceCommand(interaction: any) {
  const targetUser = interaction.options.getUser("user")
  const discordId = targetUser?.id || interaction.user.id

  const user = await getUserByDiscordId(discordId)

  if (!user) {
    await interaction.reply({
      content: targetUser
        ? "That user hasn't linked their account."
        : "You need to link your account first! Use `/link`",
      ephemeral: true,
    })
    return
  }

  const result = await sql`
    SELECT coin_balance, role
    FROM users
    WHERE id = ${user.id}
  `

  const balance = result[0]

  const embed = new EmbedBuilder()
    .setTitle(`💰 Balance for ${user.username}`)
    .setDescription(`**${balance.coin_balance}** coins`)
    .setColor(balance.role === "vip" ? Colors.Gold : Colors.Green)
    .setTimestamp()

  await interaction.reply({ embeds: [embed] })
}

async function handleLinkCommand(interaction: any) {
  const linkUrl = `${process.env.NEXT_PUBLIC_APP_URL}/settings?discord_link=true`

  const embed = new EmbedBuilder()
    .setTitle("🔗 Link Your Account")
    .setDescription(
      "To link your Discord account with Drops Cloud:\n\n1. Visit your [Settings Page](" +
        linkUrl +
        ")\n2. Click the **Link Discord** button\n3. Authorize the connection",
    )
    .setColor(Colors.Blue)
    .setTimestamp()

  await interaction.reply({ embeds: [embed], ephemeral: true })
}

async function handleSearchCommand(interaction: any) {
  await interaction.deferReply()

  const query = interaction.options.getString("query")

  const drops = await sql`
    SELECT id, title, service, cost, owner_username
    FROM drops
    WHERE 
      (title ILIKE ${"%" + query + "%"} OR service ILIKE ${"%" + query + "%"})
      AND is_visible = true 
      AND is_expired = false
    LIMIT 5
  `

  if (drops.length === 0) {
    await interaction.editReply(`No drops found matching "${query}"`)
    return
  }

  const embed = new EmbedBuilder()
    .setTitle(`🔍 Search Results for "${query}"`)
    .setColor(Colors.Purple)
    .setDescription(`Found ${drops.length} drop(s)`)

  drops.forEach((drop: any) => {
    embed.addFields({
      name: drop.title,
      value: `**Service:** ${drop.service}\n**Cost:** ${drop.cost} coins\n**By:** ${drop.owner_username}`,
      inline: false,
    })
  })

  await interaction.editReply({ embeds: [embed] })
}

async function handleLeaderboardCommand(interaction: any) {
  await interaction.deferReply()

  const category = interaction.options.getString("category") || "coins"

  let orderBy = "coin_balance"
  let categoryName = "Coins"

  if (category === "drops") {
    orderBy = "total_drops_created"
    categoryName = "Drops Created"
  } else if (category === "unlocked") {
    orderBy = "(SELECT COUNT(*) FROM unlocked_drops WHERE user_id = users.id)"
    categoryName = "Drops Unlocked"
  }

  const topUsers = await sql`
    SELECT username, coin_balance, total_drops_created, role, profile_picture
    FROM users
    WHERE status = 'active'
    ORDER BY ${sql.raw(orderBy)} DESC
    LIMIT 10
  `

  const embed = new EmbedBuilder().setTitle(`🏆 Top 10 - ${categoryName}`).setColor(Colors.Gold).setTimestamp()

  topUsers.forEach((user: any, index: number) => {
    const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`
    let value = ""

    if (category === "coins") {
      value = `${user.coin_balance} coins`
    } else if (category === "drops") {
      value = `${user.total_drops_created} drops`
    }

    embed.addFields({
      name: `${medal} ${user.username}`,
      value: value,
      inline: true,
    })
  })

  await interaction.editReply({ embeds: [embed] })
}

async function handleServicesCommand(interaction: any) {
  await interaction.deferReply()

  const services = await sql`
    SELECT display_name, description, 
      (SELECT COUNT(*) FROM account_stock WHERE service_id = account_services.id AND status = 'available') as stock_count
    FROM account_services
    WHERE is_active = true
    ORDER BY display_name
    LIMIT 10
  `

  if (services.length === 0) {
    await interaction.editReply("No services available right now.")
    return
  }

  const embed = new EmbedBuilder()
    .setTitle("🎮 Available Account Services")
    .setColor(Colors.Green)
    .setDescription("These services are available in the account generator")
    .setTimestamp()

  services.forEach((service: any) => {
    embed.addFields({
      name: service.display_name,
      value: `${service.description || "No description"}\n**Stock:** ${service.stock_count} accounts`,
      inline: false,
    })
  })

  embed.setFooter({ text: "Visit /account-generator to claim accounts" })

  await interaction.editReply({ embeds: [embed] })
}

async function getUserByDiscordId(discordId: string) {
  const users = await sql`
    SELECT id, username, profile_picture
    FROM users
    WHERE discord_id = ${discordId}
    LIMIT 1
  `

  return users.length > 0 ? users[0] : null
}

client.login(process.env.DISCORD_BOT_TOKEN)
