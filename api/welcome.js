import { kv } from "@vercel/kv";
import { createCanvas, loadImage } from "canvas";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  // Verify Discord interaction (you can reuse your existing verification logic)
  // For brevity, I'm skipping full verification, but do include it.

  const interaction = req.body;
  if (interaction.type === 1) {
    // Discord PING
    return res.status(200).json({ type: 1 });
  }

  if (interaction.type === 2 && interaction.data.name === "welcome") {
    // Acknowledge immediately (defer)
    res.status(200).json({ type: 5 }); // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE

    // Do the heavy work after acknowledging
    await handleWelcomeCommand(interaction);
    return;
  }

  res.status(400).json({ error: "Unknown interaction" });
}

async function handleWelcomeCommand(interaction) {
  const { guild_id, token, application_id } = interaction;
  const welcomeChannelId = process.env.WELCOME_CHANNEL_ID;
  const bgUrl = process.env.WELCOME_BG_URL || "";

  try {
    // Fetch guild members (requires GUILD_MEMBERS intent enabled)
    const members = await fetchAllMembers(guild_id);
    if (!members) {
      await sendFollowup(token, "❌ Could not fetch member list.");
      return;
    }

    // Get already welcomed set from KV
    const welcomedKey = `welcomed:${guild_id}`;
    const welcomedSet = await kv.smembers(welcomedKey); // Returns array of user IDs

    const newMembers = members.filter(
      (m) => !welcomedSet.includes(m.user.id) && !m.user.bot,
    );
    if (newMembers.length === 0) {
      await sendFollowup(token, "✅ All members have already been welcomed.");
      return;
    }

    // Send welcome for each new member
    const channel = await getDiscordChannel(welcomeChannelId);
    if (!channel) {
      await sendFollowup(token, "❌ Welcome channel not found.");
      return;
    }

    for (const member of newMembers) {
      const avatarURL = member.user.avatar
        ? `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png?size=256`
        : member.user.defaultAvatarURL;

      // Generate banner image
      const imageBuffer = await generateWelcomeBanner(
        avatarURL,
        member.user.username,
        interaction.guild?.name || "Server", // note: guild name not in interaction, you may need to fetch guild
        members.length,
        bgUrl,
      );

      // Send to welcome channel (using Discord API directly)
      await fetch(
        `https://discord.com/api/v10/channels/${welcomeChannelId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: `👋 Welcome <@${member.user.id}>!`,
            embeds: [
              {
                image: { url: "attachment://welcome.png" },
                color: 0x5865f2,
              },
            ],
            files: [
              {
                name: "welcome.png",
                data: imageBuffer.toString("base64"),
                type: "image/png",
              },
            ],
          }),
        },
      );

      // Add user to welcomed set
      await kv.sadd(welcomedKey, member.user.id);
    }

    await sendFollowup(
      token,
      `✅ Sent welcome to ${newMembers.length} new member(s).`,
    );
  } catch (err) {
    console.error(err);
    await sendFollowup(token, "❌ An error occurred.");
  }
}

// Helper: fetch all guild members (paginated)
async function fetchAllMembers(guildId) {
  let members = [];
  let lastId = null;
  while (true) {
    const url = `https://discord.com/api/v10/guilds/${guildId}/members?limit=1000${lastId ? `&after=${lastId}` : ""}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.length === 0) break;
    members = members.concat(data);
    lastId = data[data.length - 1].user.id;
    if (data.length < 1000) break;
  }
  return members;
}

// Generate banner with canvas (same as before)
async function generateWelcomeBanner(
  avatarURL,
  username,
  serverName,
  memberCount,
  bgURL,
) {
  // (Same canvas code you already have – returns a Buffer)
  // ... paste your existing generateWelcomeBanner implementation here
}

// Follow-up message to the command user
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
