// Load environment variables locally (ignored in production if platform provides them)
require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  AttachmentBuilder,
  EmbedBuilder,
} = require("discord.js");
const { createCanvas, loadImage } = require("canvas");

// Create the bot client with the necessary intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // Required to listen for new members
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ─── Configuration (all from environment variables) ─────────────────
const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID;
const WELCOME_BACKGROUND_URL =
  process.env.WELCOME_BACKGROUND_URL ||
  "https://i.imgur.com/your-default-banner.png"; // optional fallback background

// ─── Helper: Generate a custom welcome banner with Canvas ──────────
async function generateWelcomeBanner(member) {
  const canvas = createCanvas(800, 250);
  const ctx = canvas.getContext("2d");

  // Draw background image (or solid gradient if image fails)
  try {
    const background = await loadImage(WELCOME_BACKGROUND_URL);
    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
  } catch {
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    gradient.addColorStop(0, "#6a11cb");
    gradient.addColorStop(1, "#2575fc");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Dark overlay for better text readability
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Circular user avatar
  ctx.save();
  const avatarSize = 120;
  const avatarX = 60;
  const avatarY = canvas.height / 2 - avatarSize / 2;
  ctx.beginPath();
  ctx.arc(
    avatarX + avatarSize / 2,
    avatarY + avatarSize / 2,
    avatarSize / 2,
    0,
    Math.PI * 2,
    true,
  );
  ctx.closePath();
  ctx.clip();

  const avatarURL = member.user.displayAvatarURL({
    extension: "png",
    size: 256,
  });
  const avatar = await loadImage(avatarURL);
  ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
  ctx.restore();

  // Welcome text
  ctx.font = 'bold 36px "Segoe UI", "Helvetica Neue", sans-serif';
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`Welcome, ${member.user.username}!`, 220, 110);

  // Member count
  ctx.font = '24px "Segoe UI", sans-serif';
  ctx.fillStyle = "#dddddd";
  ctx.fillText(`You are the ${member.guild.memberCount}th member!`, 220, 160);

  // Server name
  ctx.font = '20px "Segoe UI", sans-serif';
  ctx.fillStyle = "#aaaaaa";
  ctx.fillText(member.guild.name, 220, 200);

  return canvas.toBuffer("image/png");
}

// ─── Event: Bot is ready ───────────────────────────────────────────
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`Monitoring welcome channel ID: ${WELCOME_CHANNEL_ID}`);
});

// ─── Event: New member joins ────────────────────────────────────────
client.on("guildMemberAdd", async (member) => {
  try {
    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (!channel) {
      console.error("❌ Welcome channel not found. Check WELCOME_CHANNEL_ID");
      return;
    }

    // Generate the custom image
    const imageBuffer = await generateWelcomeBanner(member);
    const attachment = new AttachmentBuilder(imageBuffer, {
      name: "welcome.png",
    });

    // Build a nice embed with the generated banner
    const embed = new EmbedBuilder()
      .setColor(0x5865f2) // Discord blurple
      .setTitle(`👋 Welcome to ${member.guild.name}!`)
      .setDescription(
        `Hey ${member.user}, we're glad to have you here!\n` +
          `Please read the rules and enjoy your stay.`,
      )
      .setImage("attachment://welcome.png")
      .setFooter({ text: `Member #${member.guild.memberCount}` })
      .setTimestamp();

    // Send the welcome message, mentioning the new member
    await channel.send({
      content: `${member.user}`,
      embeds: [embed],
      files: [attachment],
    });

    console.log(`✅ Welcomed ${member.user.tag}`);
  } catch (error) {
    console.error("❌ Error in welcome event:", error);
  }
});

// ─── (Optional) HTTP server for health checks on Render/Railway ─────
const http = require("http");
const PORT = process.env.PORT || 3000;
http
  .createServer((req, res) => {
    res.writeHead(200);
    res.end("Bot is alive!");
  })
  .listen(PORT, () => {
    console.log(`Health check server running on port ${PORT}`);
  });

// ─── Log in to Discord ──────────────────────────────────────────────
client.login(process.env.DISCORD_TOKEN);
