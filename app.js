require('dotenv').config();
const express = require('express');
const subdomain = require('express-subdomain');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const TelegramBot = require('node-telegram-bot-api');
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, {polling: true});
const path = require('path');
const User = require('./models/User');

const PORT = process.env.PORT || 80;

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

const bodyParser = require('body-parser')
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(require('express-session')({ secret: 'keyboard cat', resave: true, saveUninitialized: true }));

app.use(passport.initialize());
app.use(passport.session());


// dashboard.domain.com -------------------------------------------------
var dashboardRouter = express.Router();

dashboardRouter.get('/signin', function(req, res) {
  res.render('signin.html');
});

dashboardRouter.get('/register', function (req, res) {
  res.render('register.html');
})

dashboardRouter.post('/auth/signin',
  passport.authenticate('local', { failureRedirect: '/signin' }),
  function(req, res) {
    // If this function gets called, authentication was successful.
    // `req.user` contains the authenticated user.
    res.redirect('/');
});

dashboardRouter.get('/auth/signout', function(req, res){
  req.logout();
  res.redirect('http://lvh.me');
});

dashboardRouter.post('/auth/register', function(req, res) {
  if (req.body.email &&
    req.body.password &&
    req.body.password === req.body.passwordConfirm) {
    const userData = {
      email: req.body.email,
      password: req.body.password,
      apiKey: bcrypt.hashSync(req.body.email + Date.now().toString(), 10),
    }
    User.create(userData, function (err, user) {
      if (err) {
        // HANDLE ERRORS HERE LATER
        console.log(err);
        return err;
      } else {
        return res.redirect('/');
      }
    });
  }
})

// User only can access this endpoint if they're signed in
dashboardRouter.get('/', signedIn,  function(req, res, next) {
  console.log(req.user);
  res.render('dashboard.html', {
    email: req.user.email,
    telegramUsername: req.user.telegram.username ? req.user.telegram.username : "NOT_YET_SET_UP",
    apiKey: req.user.apiKey,
  });
});

app.use(subdomain('dashboard', dashboardRouter));
// -------------------------------------------------------------

// api.domain.com-------------------------------------------------------------
const apiRouter = express.Router();

// Need to handle linking of account to telegram
apiRouter.post('/v1/logs/telegram', function(req, res) {
  console.log(req.body.apiKey);
  const apiKey = req.body.apiKey;
  const message = req.body.message;
  const group = req.body.group || null;
  // Find user via api key
  User.findOne({ apiKey: req.body.apiKey }, function(err, user) {
    if (err) {
      console.log(err);
    } else {
      // Send message via telegram
      bot.sendMessage(user.telegram.id, message);
      res.sendStatus(200);
    }
  })

});

apiRouter.post('/v1/emailLog', function(req, res) {
  if (req.body.message) {

  }
})


app.use(subdomain('api', apiRouter));
// -------------------------------------------------------------


app.get('/', function (req, res) {
  res.render('index.html');
})

app.listen(PORT)
console.log('Running on http://localhost:' + PORT);



// TELEGRAM BOT ------------------------------------------
bot.onText(/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/, (msg) => {
  const userId = msg.from.id;
  const username = msg.from.username;
  User.findOneAndUpdate({ email : msg.text }, {
    'telegram.id' : userId,
    'telegram.username' : username,
  }, function(err, user) {
    if (err) {
      bot.sendMessage(userId, 'Please enter the email that you signed up with on airlog!');
    }
  });
  bot.sendMessage(userId, 'Account linked!');
});

bot.on('message', (msg) => {
  const userId = msg.from.id;
  User.findOne({ 'telegram.id' : userId }, (err, user) => {
    if (err) {
      bot.sendMessage(userId, "Link your account by entering the email that you signed up with on airlog!");
    }
    bot.sendMessage(userId, "Sorry I don't understand your commmand! Visit airlog.io for help.");
  });
});


/*
TODO
1. Pass data to front-end / back-end (DONE)
2. Set-up POST endpoint for telegram messages (DONE)
3. Do up the home page
4. Let the user change credentials on settings page

Graphics color is #72b6ff
*/