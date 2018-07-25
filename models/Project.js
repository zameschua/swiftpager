const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcryptjs');
const bot = require('../utils/telegramBotService.js');
const User = require('./User.js');

const ProjectSchema = new Schema({
  users: [{
    userId: {
      type: String,
      unique: true,
      required: true,
    },
    services: {
      type: [String],
      unique: true,
      required: false,
    },
    _id: false
  }],
  apiToken: {
    type: String,
    unique: true,
  }
});

// -------------------- Methods ----------------------
/**
 * Async method!
 * @param {} message 
 */
ProjectSchema.methods.notify = function(message) {
  const notification = {
    message: message,
    timestamp: Date.now(),
  }
  this.users.forEach((projectUser) => {
    const User = require('./User.js');
    User.findById(projectUser.userId, (err, user) => {
      if (err || !user) {
        console.error(err, 'Cannot find user!');
        return err;
      }
      projectUser.services.forEach((service) => {
        console.log(service);
        user.notify(service, notification);
      });
    })
  });
}

ProjectSchema.methods.revokeApiToken = function() {
  this.apiToken = "";
  this.save();
}

ProjectSchema.methods.issueApiToken = function() {
  const apiToken = bcrypt.hashSync(this._id + Date.now().toString(), 10);
  this.apiToken = apiToken;
  this.save();
}

// ------------------ Static Methods --------------------


// ------------------- Pre hook ------------------------
ProjectSchema.pre('save', function(next) {
  const apiToken = bcrypt.hashSync(this._id + Date.now().toString(), 10);
  this.apiToken = apiToken;
  next();
});


const Project = mongoose.model('Project', ProjectSchema);
module.exports = Project;
