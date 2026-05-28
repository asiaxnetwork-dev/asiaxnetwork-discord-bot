import { createCanvas, loadImage } from "canvas";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const interaction = req.body;

  // Discord PING
  if (interaction.type === 1) return res.status(200).json({ type: 1 });

  // Slash command: /welcome <user>
  if (interaction.type === 2 && interaction.data.name === "welcome") {
    // Acknowledge immediately
    res.status(200).json({ type: 5 });

    try {
      await handleWelcome(interaction);
    } catch (err) {
      console.error("Error handling /welcome:", err);
      await sendFollowup(interaction.token, "❌ Something went wrong.");
    }
    return;
  }

  return res.status(400).json({ error: "Unknown interaction" });
}

async function handleWelcome(interaction) {
  const { guild_id, token, data } = interaction;
  const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID;
  const BG_URL = process.env.WELCOME_BACKGROUND_URL || "";

  // Extract the target user from the command options
  const userOption = data.options?.find((opt) => opt.name === "user");
  if (!userOption) {
    return sendFollowup(
      token,
      "❌ You must mention a user, e.g. `/welcome @username`",
    );
  }

  const targetUserId = userOption.value;
  const member = interaction.member; // The command invoker – we need guild member info, but we need the target member object

  // The interaction may not include the target member's full object, so we fetch it via REST
  const guild = interaction.guild_id;
  if (!guild)
    return sendFollowup(token, "❌ This command only works in servers.");

  // Fetch the target member from the guild
  const memberRes = await fetch(
    `https://discord.com/api/v10/guilds/${guild}/members/${targetUserId}`,
    {
      headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` },
    },
  );

  if (!memberRes.ok) {
    return sendFollowup(token, "❌ Could not find that member in this server.");
  }

  const targetMember = await memberRes.json();
  const username = targetMember.user.username;
  const avatarURL = targetMember.user.avatar
    ? `https://cdn.discordapp.com/avatars/${targetMember.user.id}/${targetMember.user.avatar}.png?size=256`
    : `https://cdn.discordapp.com/embed/avatars/${Number(targetMember.user.discriminator || 0) % 5}.png`;

  // Get guild member count (optional)
  const guildRes = await fetch(
    `https://discord.com/api/v10/guilds/${guild}?with_counts=true`,
    {
      headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` },
    },
  );
  const guildData = guildRes.ok ? await guildRes.json() : null;
  const memberCount = guildData?.approximate_member_count ?? "?";
  const serverName = guildData?.name ?? "Our Server";

  // Generate the welcome banner
  const banner = await generateBanner(
    avatarURL,
    username,
    serverName,
    memberCount,
    BG_URL,
  );

  // Send the welcome message to the configured channel
  await fetch(
    `https://discord.com/api/v10/channels/${WELCOME_CHANNEL_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: `👋 Welcome <@${targetUserId}>!`,
        embeds: [
          {
            image: { url: "attachment://welcome.png" },
            color: 0x5865f2,
          },
        ],
        files: [
          {
            name: "welcome.png",
            data: banner.toString("base64"),
            type: "image/png",
          },
        ],
      }),
    },
  );

  await sendFollowup(token, `✅ Welcome message sent for **${username}**!`);
}

async function generateBanner(
  avatarURL,
  username,
  serverName,
  memberCount,
  bgURL,
) {
  const canvas = createCanvas(800, 250);
  const ctx = canvas.getContext("2d");

  try {
    if (bgURL) {
      const bg = await loadImage(bgURL);
      ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
    } else throw new Error("No BG");
  } catch {
    const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
    grad.addColorStop(0, "#6a11cb");
    grad.addColorStop(1, "#2575fc");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

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
  ctx.clip();
  const avatar = await loadImage(avatarURL);
  ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
  ctx.restore();

  ctx.font = 'bold 36px "Segoe UI", sans-serif';
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`Welcome, ${username}!`, 220, 110);

  ctx.font = '24px "Segoe UI", sans-serif';
  ctx.fillStyle = "#dddddd";
  ctx.fillText(`You are the ${memberCount}th member!`, 220, 160);

  ctx.font = '20px "Segoe UI", sans-serif';
  ctx.fillStyle = "#aaaaaa";
  ctx.fillText(serverName, 220, 200);

  return canvas.toBuffer("image/png");
}

async function sendFollowup(token, content) {
  await fetch(
    `https://discord.com/api/v10/webhooks/${process.env.DISCORD_APPLICATION_ID}/${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    },
  );
}
