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
  logs: [{
    message: {
      type: String,
      required: true,
      default: "",
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    }
  }],
  apiKey: {
    type: String,
    unique: true,
  }
});

// -------------------- Methods ----------------------
ProjectSchema.methods.log = function(message) {
  const log = {
    message: message,
    timestamp: Date.now(),
  }
  this.createLog(log);
  this.sendLog(log);
}

ProjectSchema.methods.createLog = function(log) {
  this.logs.push(log);
  // THIS IS NOT WORKING
};

ProjectSchema.methods.sendLog = function(log) {
  this.users.forEach((projectUser) => {
    const User = require('./User.js');
    User.findOne({_id: projectUser.userId}, (err, user) => {
      if (err) console.log(err);
      projectUser.services.forEach((service) => {
        user.sendLog(service, log);
      });
    })
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
