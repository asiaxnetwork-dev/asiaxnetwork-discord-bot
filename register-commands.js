const TOKEN = process.env.DISCORD_TOKEN;
const APP_ID = process.env.DISCORD_APPLICATION_ID;

if (!TOKEN || !APP_ID) {
  console.error(
    "❌ Missing DISCORD_TOKEN or DISCORD_APPLICATION_ID environment variables.",
  );
  console.error("Set them in your terminal before running:");
  console.error('   $env:DISCORD_TOKEN="your-token"');
  console.error('   $env:DISCORD_APPLICATION_ID="1483347994878414980"');
  process.exit(1);
}

const command = {
  name: "welcome",
  description: "Send a welcome message to a specific user with a custom banner",
  options: [
    {
      name: "user",
      description: "The user to welcome",
      type: 6, // USER type
      required: true,
    },
  ],
};

console.log("Registering /welcome command with user option...");

fetch(`https://discord.com/api/v10/applications/${APP_ID}/commands`, {
  method: "POST",
  headers: {
    Authorization: `Bot ${TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(command),
})
  .then((res) => res.json())
  .then((data) => {
    if (data.errors) {
      console.error("❌ Error:", data.errors);
    } else {
      console.log("✅ Command registered:", data);
    }
  })
  .catch((err) => console.error("❌ Network error:", err));
