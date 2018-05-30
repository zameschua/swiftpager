require('dotenv').config();
const express = require('express');
const subdomain = require('express-subdomain');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const path = require('path');
const bot = require('./utils/telegramBotService.js');
const User = require('./models/User.js');
const Project = require('./models/Project.js');

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

  Project.findOne({ _id: req.user.projects[0].projectId}, function(err, project) {
    if (err) console.log(err);
    
    res.render('dashboard.html', {
      email: req.user.email,
      telegramUsername: req.user.services.telegram.username ? req.user.services.telegram.username : "NOT_YET_SET_UP",
      apiKey: project.apiKey,
    });

  });
});

app.use(subdomain('dashboard', dashboardRouter));
// -------------------------------------------------------------

// api.domain.com-------------------------------------------------------------
const apiRouter = express.Router();

// Need to handle linking of account to telegram
apiRouter.post('/v1/me/logs', function(req, res) {
  console.log(req.body.apiKey);
  const apiKey = req.body.apiKey;
  const message = req.body.message;
  // Find user via api key
  Project.findOne({ apiKey: req.body.apiKey }, function(err, project) {
    if (err) {
      console.log(err);
    } else {
      // Send message via telegram
      project.log(message);
      res.sendStatus(200);
    }
  })

});

apiRouter.get('/v1/me/', function(req, res) {
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



/*
TODO
1. Pass data to front-end / back-end (DONE)
2. Set-up POST endpoint for telegram messages (DONE)
3. Do up the home page -- HALF DONE
4. Let the user change credentials on settings page
5. Do up API docs
6. Handle invalid sign up properly

Graphics color is #278fff
*/