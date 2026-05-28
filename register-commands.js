const TOKEN = process.env.DISCORD_TOKEN;
const APP_ID = process.env.DISCORD_APPLICATION_ID;

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

fetch(`https://discord.com/api/v10/applications/${APP_ID}/commands`, {
  method: "POST",
  headers: {
    Authorization: `Bot ${TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(command),
})
  .then((res) => res.json())
  .then(console.log)
  .catch(console.error);
