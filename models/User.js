const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcryptjs');
const Project = require('./Project');
const emailService = require('../utils/emailService');

const UserSchema = new Schema({
  emailAddress: {
    type: String,
    unique: true,
    required: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
  },
  services: {
    telegram: {
      username: {
        type: String,
        default: "",
      },
      id: {
        type: String,
        default: "",
      },
    },
    email: {
      emailAddress: {
        type: String,
        default: "",
      },
    },
  },
  projects: [{
    projectId: mongoose.Schema.Types.ObjectId,
    // isModerator?
  }],
});

// ------------------ Pre Hook -------------------
//hashing a password before saving it to the database
UserSchema.pre('save', function(next) {
  const user = this;
  
  this.services.email.emailAddress = this.emailAddress;

  const projectData = {
    users: [{
      userId: this._id,
      services: [],
    }],
    logs: [],
    apiKey: "",
  }
  // Create the user's default project
  Project.create(projectData, function (err, project) {
    if (err) {
      // HANDLE ERRORS HERE LATER
      console.log(err);
      return err;
    } else {
      user.projects = [{
        projectId: project._id,
      }];
    }
  });

  // Hash the password
  bcrypt.hash(user.password, 10, function (err, hash) {
    if (err) {
        return next(err);
    }
    user.password = hash;
    next();
  });
});

// ---------------------- Methods ------------------------------
UserSchema.methods.verifyPassword = function(password, callback) {
  callback(err, bcrypt.compareSync(password, this.password));
};

UserSchema.methods.getProjects = function() {
  return this.projects.forEach((projectId) => Project.getProjectById(projectId));
}

UserSchema.methods.sendLog = function(service, log) {
  console.log(log);
  if (service === "telegram") {
    this.sendTelegramLog(log);
  } else if (service === "email") {
    this.sendEmailLog(log);
  }
}

UserSchema.methods.sendTelegramLog = function(log) {
  const messageToSend = `${new Date(log.timestamp).toTimeString()}: ${log.message}`
  const bot = require('../utils/telegramBotService');
  bot.sendMessage(this.services.telegram.id, messageToSend);
}

UserSchema.methods.sendEmailLog = function(log) {
  const mailOptions = {
    from: process.env.GMAIL_ADDRESS,
    to: this.services.email.emailAddress,
    subject: "Log from Lumberjack",
    text: log.message,
  };
  
  emailService.sendMail(mailOptions, function(error, info){
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
}

/**
 * Allow user to update account settings
 * Object should only have 1 key (Might be changed later to support more keys)
 * 
 * {
 *  emailAddress: newEmailAddress
 * }
 * 
 * @returns updatedUser upon successful update
 */
UserSchema.methods.update = function(updateObject) {
    const key = Object.keys(updateObject)[0];
    const value = updateObject[key];
    this[key] = value;

    this.save(function (err, updatedUser) {
      if (err) return err;
      return updatedUser;
    });
}

const User = mongoose.model('User', UserSchema);
module.exports = User;
