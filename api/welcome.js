import { createCanvas, loadImage } from "@napi-rs/canvas";

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const interaction = req.body;

  // Discord PING (type 1) – required for endpoint verification
  if (interaction.type === 1) {
    return res.status(200).json({ type: 1 });
  }

  // Slash command handling (type 2)
  if (interaction.type === 2 && interaction.data.name === "welcome") {
    // Acknowledge the interaction immediately (type 5 = deferred channel message with source)
    res.status(200).json({ type: 5 });

    try {
      await handleWelcome(interaction);
    } catch (error) {
      console.error("handleWelcome error:", error);
      await sendFollowup(
        interaction.token,
        "❌ Something went wrong. Please try again.",
      );
    }
    return;
  }

  // Unknown interaction
  return res.status(400).json({ error: "Unknown interaction type" });
}

// ─── Main welcome logic ────────────────────────────────────────────────
async function handleWelcome(interaction) {
  const { guild_id, token, data } = interaction;
  const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID;
  const BG_URL = process.env.WELCOME_BACKGROUND_URL || "";

  // Get the target user from the command options
  const userOption = data.options?.find((opt) => opt.name === "user");
  if (!userOption) {
    return sendFollowup(
      token,
      "❌ You must mention a user, e.g., `/welcome @username`",
    );
  }

  const targetUserId = userOption.value;

  // Fetch the member object from the guild (to get avatar, username, etc.)
  const memberRes = await fetch(
    `https://discord.com/api/v10/guilds/${guild_id}/members/${targetUserId}`,
    { headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` } },
  );

  if (!memberRes.ok) {
    return sendFollowup(token, "❌ Could not find that member in this server.");
  }

  const member = await memberRes.json();
  const username = member.user.username;
  const avatarURL = member.user.avatar
    ? `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png?size=256`
    : `https://cdn.discordapp.com/embed/avatars/${(member.user.discriminator || "0") % 5}.png`;

  // Fetch guild info (name and approximate member count)
  const guildRes = await fetch(
    `https://discord.com/api/v10/guilds/${guild_id}?with_counts=true`,
    { headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` } },
  );
  const guildData = guildRes.ok ? await guildRes.json() : null;
  const serverName = guildData?.name ?? "Our Server";
  const memberCount = guildData?.approximate_member_count ?? "?";

  // Generate the welcome banner
  const bannerBuffer = await generateBanner(
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
            data: bannerBuffer.toString("base64"),
            type: "image/png",
          },
        ],
      }),
    },
  );

  // Reply to the command user
  await sendFollowup(token, `✅ Welcome message sent for **${username}**!`);
}

// ─── Canvas banner generator ───────────────────────────────────────────
async function generateBanner(
  avatarURL,
  username,
  serverName,
  memberCount,
  bgURL,
) {
  const canvas = createCanvas(800, 250);
  const ctx = canvas.getContext("2d");

  // Background
  try {
    if (bgURL) {
      const bg = await loadImage(bgURL);
      ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
    } else {
      throw new Error("No BG URL provided");
    }
  } catch {
    // Fallback gradient
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    gradient.addColorStop(0, "#6a11cb");
    gradient.addColorStop(1, "#2575fc");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Dark overlay for text readability
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Circular avatar
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

  // Welcome text
  ctx.font = 'bold 36px "Segoe UI", "Helvetica Neue", sans-serif';
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`Welcome, ${username}!`, 220, 110);

  // Member count
  ctx.font = '24px "Segoe UI", sans-serif';
  ctx.fillStyle = "#dddddd";
  ctx.fillText(`You are the ${memberCount}th member!`, 220, 160);

  // Server name
  ctx.font = '20px "Segoe UI", sans-serif';
  ctx.fillStyle = "#aaaaaa";
  ctx.fillText(serverName, 220, 200);

  return canvas.toBuffer("image/png");
}

// ─── Follow‑up message helper ─────────────────────────────────────────
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
