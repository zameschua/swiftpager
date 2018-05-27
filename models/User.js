const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Project = require('./Project');
const bot = require('../utils/telegramBotService');

const UserSchema = new mongoose.Schema({
    email: {
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
            }
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
  })
});

// ---------------------- Methods ------------------------------
UserSchema.methods.verifyPassword = function(password, callback) {
    callback(err, bcrypt.compareSync(password, this.password));
};

UserSchema.methods.getProjects = function() {
    return this.projects.forEach((projectId) => Project.getProjectById(projectId));
}

UserSchema.methods.sendLog = function(service, log){
    if (service === "telegram") {
        this.sendTelegramLog(log);
    }
}

UserSchema.methods.sendTelegramLog = function(log) {
    const messageToSend = `${log.timestamp.toString()}: ${log.message}`
    bot.sendMessage(this.services.telegram.id, messageToSend);
}

const User = mongoose.model('User', UserSchema);
module.exports = User;
