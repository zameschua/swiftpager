var nodemailer = require('nodemailer');

var emailService = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  auth: {
    type: 'login',
    user: process.env.GMAIL_ADDRESS,
    pass: process.env.GMAIL_PASSWORD,
  }
});

module.exports = emailService;