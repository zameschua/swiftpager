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
  usernameField: 'emailAddress',
  passwordField: 'password'
  },
  function(emailAddress, password, done) {
    User.findOne({ emailAddress: emailAddress }, function (err, user) {
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


/********************************************************************
 * dashboard.domain.com 
 ********************************************************************/
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

// TODO: Change to POST
dashboardRouter.get('/auth/signout', function(req, res){
  req.logout();
  res.redirect('http://lvh.me');
});

dashboardRouter.post('/auth/register', function(req, res) {
  if (req.body.emailAddress &&
    req.body.password &&
    req.body.password === req.body.passwordConfirm) {
    const userData = {
      emailAddress: req.body.emailAddress,
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
  Project.findOne({ _id: req.user.projects[0].projectId}, function(err, project) {
    if (err) console.log(err);
    
    res.render('dashboard.html', {
      email: req.user.emailAddress,
      telegramUsername: req.user.services.telegram.username ? "@" + req.user.services.telegram.username : "Seems like you haven't set up your Telegram account yet!",
      apiKey: project.apiKey,
    });

  });
});

app.use(subdomain('dashboard', dashboardRouter));

/********************************************************************
 * api.domain.com/v1
 ********************************************************************/
const apiRouter = express.Router();

// USER API

/**
 * Creates a new user
 */
apiRouter.post('/v1/users', function(req, res) {

});

/**
 * Gets the information for a single user
 */
apiRouter.get('/v1/users/:userId', function(req, res) {
  Users.findById(req.params.userId, function(err, user) {
    if (err) {
      console.error(err);
      // Handle error here
    }

    res.json({
      user: user,
    });
  });
});

/**
 * Updates the information for a user
 */
apiRouter.patch('/v1/users/:userId', function(req, res) {
  Users.findById(req.body.userId, function(err, user) {
    if (err) console.error(err);
    
    User.update(req.body).then(response => {
      res.sendStatus(200);
    }).catch(err => {
      console.error(err);
      res.sendStatus(404); // TODO: Make the call return the correct error code
    });
  });
});

/**
 * Gets the default project for the user, then sends an alert
 */
apiRouter.post('/v1/users/:userId/notify', function(req, res) {
  const apiKey = req.params.apiKey;
  const message = req.body.message;
  // Find user via api key
  Project.findOne({ apiKey: req.body.apiKey }, function(err, project) {
    if (err) {
      console.log(err);
    } else {
      // Send message via telegram
      console.log(project);
      project.log(message);
      res.sendStatus(200);
    }
  })
});

/**
 * Gets a list of projects that the user belongs to
 */
apiRouter.get('/v1/users/:userId/projects', function(req, res) {
  const userId = req.params.userId;
  User.findById(userId, (err, user) => {
    if (err) {
      console.error(err);
      // Handle error here
    }
    res.json({
      projects: user.projects,
    });
  });
});


//PROJECT API

 /**
 * Get the information of a single project
 */
apiRouter.get('/v1/projects/:projectId', function(req, res) {
  const projectId = req.params.userId;
  Project.findById(userId, (err, project) => {
    if (err) {
      console.error(err);
      // Handle error here
    }
    res.json({
      project: project,
    });
  });
});

 /**
 * Create a new project
 */
apiRouter.post('/v1/projects/:projectId', function(req, res) {

});

 /**
 * Notify all users involved in a project
 */
apiRouter.get('/v1/projects/:projectId/notify', function(req, res) {

});


app.use(subdomain('api', apiRouter));
// -------------------------------------------------------------


app.get('/', function (req, res) {
  res.render('index.html');
})

app.listen(PORT)
console.log('Running on http://localhost:' + PORT);

/*
Graphics color is #278fff
*/
