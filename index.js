/* Modules */
const Discord = require("discord.js");
const fs = require("fs");

/* Models */
const setMessageText = require("./models/reaction-message/setMessageText");
const {
  addReactionMessage,
  getReactionMessage,
} = require("./models/reaction-message/queries.js");

/* Client */
const bot = new Discord.Client({ partials: ["MESSAGE", "REACTION"] });

/* Commands */
bot.commands = new Discord.Collection();
console.log(bot.commands);
const commandFolders = fs.readdirSync("./commands");

for (const folder of commandFolders) {
  const commandFiles = fs
    .readdirSync(`./commands/${folder}`)
    .filter((file) => file.endsWith(".js"));
  for (const file of commandFiles) {
    const command = require(`./commands/${folder}/${file}`);
    bot.commands.set(command.name, command);
    console.log(bot.commands);
  }
}

/* Environment variables */
const TOKEN = process.env.TOKEN;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
const PREFIX = process.env.PREFIX;

/* Teeenbe personal server log channel */
let botLogChannel;

bot.login(TOKEN);

bot.once("ready", () => {
  console.log("Booted up.");
  bot.user.setActivity("with your mum.");
  botLogChannel = bot.channels.cache.get(LOG_CHANNEL_ID);
});

bot.on("message", async (msg) => {
  if (!msg.content.startsWith(PREFIX) || msg.author.bot) {
    return;
  }

  const args = msg.content.slice(PREFIX.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  if (!bot.commands.has(commandName)) {
    return;
  }

  const command = bot.commands.get(commandName);

  try {
    command.execute(msg, args);
  } catch (err) {
    console.error(err);
    msg.reply("there was an error trying to execute that command, sorry!");
  }

  // try {
  //   if (msg.author.bot || msg.content !== "|rmsg create") {
  //     return;
  //   }

  //   /* Errors are logged in console and personal bot log channel. User notified of error. */
  // } catch (err) {
  //   console.log(err);
  //   botLogChannel.send(
  //     `There was an error in server: **${msg.guild.name}**\nChannel Name/ID: **${msg.channel.name}/${msg.channel.id}**\n\n${err}.`
  //   );
  //   msg.channel.send(
  //     "Unfortunately, there was an error creating the message. Please make sure you're following the instructions correctly. If you are and this problem persists, then there's probably something wrong with the bot, so please contact me: Teeenbe#1567"
  //   );
  // }
});

bot.on("messageReactionAdd", async (reaction, user) => {
  /* Queries database to see if an entry exists for the message. */
  const messageData = await getReactionMessage(reaction.message.id);

  if (user.bot || messageData === undefined || messageData === null) {
    return;
  }

  const guild = reaction.message.guild;
  const member = guild.members.cache.get(user.id);

  /* Converting reactions and roles JSON back to arrays. */
  const messageReactions = Object.values(JSON.parse(messageData.reactions));
  const messageRoles = Object.values(JSON.parse(messageData.roles));

  /* Determines which role the reaction corresponds to based on the index of each (should match). */
  const index = messageReactions.findIndex((r) => {
    /* Check for custom emoji. */
    if (r.charAt(0) === "<") {
      const emojiData = r.split(":");
      let emojiId = emojiData[2];
      emojiId = emojiId.slice(0, emojiId.length - 1);
      r = bot.emojis.cache.get(emojiId);
      return r.name.toLowerCase() === reaction.emoji.name.toLowerCase();
    }

    return r === reaction.emoji.name;
  });

  if (index === -1) {
    user.send(
      "It seems there's an issue with the bot and your role couldn't be added, sorry! Please contact a staff member so that they can take a look!"
    );
    botLogChannel.send(
      `Bot has returned \`index\` as \`-1\` in server: ${guild.name}`
    );
  }

  const roleName = messageRoles.find((r, i) => i === index);
  const role = guild.roles.cache.find(
    (r) => r.name.toLowerCase() === roleName.toLowerCase()
  );

  /*
  Adds or removes role from user, depending on whether they already have it
  or not and removes user's reaction that was added (cancels it out).
  */
  if (member.roles.cache.has(role.id)) {
    member.roles.remove(role);
    reaction.message.reactions.cache
      .find((r) => r === reaction)
      .users.remove(member);
    return;
  }
  member.roles.add(role);
  reaction.message.reactions.cache
    .find((r) => r === reaction)
    .users.remove(member);
});
