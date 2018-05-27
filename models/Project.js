const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const bot = require('../utils/telegramBotService');

const ProjectSchema = new mongoose.Schema({
    users: [{
        userId: {
            type: [String],
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
    this.createLog(message);
    this.sendLog(message);
}

ProjectSchema.methods.createLog = function(message) {
    const log = {
        message: message,
        timestamp: Date.now(),
    }
    this.logs.push(log);
};

ProjectSchema.methods.sendLog = function(log) {
    this.users.forEach((user) => {
        user.services.forEach((service) => {
            user.sendLog(service, log);
        });
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
