const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcryptjs');
const bot = require('../utils/telegramBotService.js');
const User = require('./User.js');

const ProjectSchema = new Schema({
  users: [{
    user_id: {
      type: String,
      unique: true,
      required: true,
    },
    services: {
      type: [String],
      unique: true,
      required: false,
    },
    is_moderator: {
      type: Boolean,
      required: true,
    },
    _id: false, // Stop mongoose from generating id for subdocuments
  }],
  api_key: {
    type: String,
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

ProjectSchema.methods.revokeApiKey = function() {
  this.api_key = null;
  this.save();
}

ProjectSchema.methods.issueApiKey = function() {
  const apiKey = bcrypt.hashSync(this._id + Date.now().toString(), 10);
  this.api_key = apiKey;
  this.save();
}

// ------------------ Static Methods --------------------


// ------------------- Pre hook ------------------------

const Project = mongoose.model('Project', ProjectSchema);
module.exports = Project;
