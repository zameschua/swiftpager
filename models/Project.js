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
    }
  }],
  apiKey: {
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
ProjectSchema.methods.update = function(updateObject) {
  const key = Object.keys(updateObject)[0];
  const value = updateObject[key];
  this[key] = value;

  this.save(function (err, updatedProject) {
    if (err) return err;
    return updatedProject;
  });
}

// ------------------ Static Methods --------------------
ProjectSchema.statics.getProjectById = function(id) {
  return this.find({ _id: id });
}

// ------------------- Pre hook ------------------------
ProjectSchema.pre('save', function(next) {
  const apiKey = bcrypt.hashSync(this._id + Date.now().toString(), 10);
  this.apiKey = apiKey;
  next();
});


const Project = mongoose.model('Project', ProjectSchema);
module.exports = Project;
