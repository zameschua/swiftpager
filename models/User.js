const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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
  telegram: {
    username: String,
    id: Number,
  },
  apiKey: {
    type: String,
    unique: true,
    required: true,
  }
});

UserSchema.methods.verifyPassword = function(password, callback) {
  console.log("verifying pw in userschema");
  callback(err, bcrypt.compareSync(password, this.password));
};
  
//hashing a password before saving it to the database
UserSchema.pre('save', function(next) {
  var user = this;
  bcrypt.hash(user.password, 10, function (err, hash) {
    if (err) {
    return next(err);
    }
    user.password = hash;
    next();
  })
});

const User = mongoose.model('User', UserSchema);
module.exports = User;
