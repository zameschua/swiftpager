const TelegramBot = require('node-telegram-bot-api');
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, {polling: true});
const User = require('../models/User.js');

bot.onText(/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/, (msg) => {
  const userId = msg.from.id;
  const username = msg.from.username;
  User.findOneAndUpdate({ "email" : msg.text }, {
    "services.telegram.id" : userId,
    "services.telegram.username" : username,
  }, function(err, user) {
    if (err) {
      console.log(err);
      bot.sendMessage(userId, 'Please enter the email that you signed up with on airlog!');
    }
  });
  bot.sendMessage(userId, 'Account linked!');
});

bot.on('message', (msg) => {
  const userId = msg.from.id;
  User.findOne({ "services.telegram.id" : userId }, (err, user) => {
    if (err) {
      console.log(err);
      bot.sendMessage(userId, "Link your account by entering the email that you signed up with on airlog!");
    }
    bot.sendMessage(userId, "Sorry I don't understand your commmand! Visit airlog.io for help.");
  });
});

module.exports = bot;