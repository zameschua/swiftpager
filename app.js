const express = require('express');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const path = require('path')
const User = require('./models/User');

const PORT = process.env.PORT || 8080;

//connect to MongoDB
const mongoose = require('mongoose');
mongoose.connect('mongodb://db/test');
const db = mongoose.connection;

//handle mongo error
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {
  console.log('MongoDB connected!');
});

passport.use(new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password'
  },
  function(email, password, done) {
    console.log("in passport.use");
    User.findOne({ email: email }, function (err, user) {
      /*
      if (err) { return done(err); }
      if (!user) { return done(null, false); }
      if (!user.verifyPassword(password)) { return done(null, false); }
      */
      return done(null, user);
    });
  }
));

// Helper function to check if user is signed in
function signedIn(req, res, next) {
  if (req.user) {
      next();
  } else {
      res.redirect('/signin');
  }
}

passport.serializeUser(function(user, cb) {
  cb(null, user.id);
});

passport.deserializeUser(function(id, cb) {
  User.findOne({_id: id}, function (err, user) {
    if (err) { return cb(err); }
    cb(null, user);
  });
});

// App
const app = express();
app.engine('html', require('ejs').renderFile);
app.use(express.static(path.join(__dirname, 'public')));
app.use(require('cookie-parser')());

app.use(require('body-parser').urlencoded({ extended: true }));
app.use(require('express-session')({ secret: 'keyboard cat', resave: true, saveUninitialized: true }));

app.use(passport.initialize());
app.use(passport.session());


// Routes
app.get('/', function (req, res) {
  res.render('index.html');
})

app.get('/register', function (req, res) {
  res.render('register.html');
})

app.post('/register', function(req, res) {
  if (req.body.email &&
    req.body.password &&
    req.body.password === req.body.passwordConfirm) {
    const userData = {
      email: req.body.email,
      password: req.body.password,
    }
    User.create(userData, function (err, user) {
      if (err) {
        // HANDLE ERRORS HERE LATER
        console.log(err);
        return err;
      } else {
        return res.redirect('/dashboard');
      }
    });
  }
})

app.get('/signin', function(req, res) {
  res.render('signin.html') 
});

app.post('/signin',
  passport.authenticate('local', { failureRedirect: '/signin' }),
  function(req, res) {
    // If this function gets called, authentication was successful.
    // `req.user` contains the authenticated user.
    res.redirect('/dashboard');
});

// User only can access this endpoint if they're signed in
app.get('/dashboard',signedIn,  function(req, res, next) {
  console.log(req.user);
  res.render('dashboard.html');
});

app.get('/signout', function(req, res){
  req.logout();
  res.redirect('/');
});

app.listen(PORT)
console.log('Running on http://localhost:' + PORT);
