// register-commands.js
const TOKEN = process.env.DISCORD_TOKEN;
const APP_ID = process.env.DISCORD_APPLICATION_ID;

if (!TOKEN || !APP_ID) {
  console.error("❌ Missing environment variables.");
  console.error(
    "Please set both DISCORD_TOKEN and DISCORD_APPLICATION_ID before running:",
  );
  console.error('   $env:DISCORD_TOKEN="your-token"');
  console.error('   $env:DISCORD_APPLICATION_ID="your-app-id"');
  console.error("   node register-commands.js");
  process.exit(1);
}

const command = {
  name: "welcome",
  description:
    "Send welcome messages to new members who haven’t been welcomed yet.",
};

console.log("Registering command /welcome ...");

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
      console.log("✅ Command registered successfully:", data);
    }
  })
  .catch((err) => console.error("❌ Network error:", err));
