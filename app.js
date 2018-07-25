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
function appSignedIn(req, res, next) {
  if (req.user) {
      next();
  } else {
      res.redirect('/signin');
  }
}

// Helper function to check if user is signed in
function apiSignedIn(req, res, next) {
  if (req.user) {
      next();
  } else {
      res.status(403).json({ error: 'Not signed in' });
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
 * app.domain.com 
 ********************************************************************/
var appRouter = express.Router();

appRouter.get('/signin', function(req, res) {
  res.render('signin.html');
});

appRouter.get('/register', function (req, res) {
  res.render('register.html');
})

appRouter.post('/auth/signin',
  passport.authenticate('local', { failureRedirect: '/signin' }),
  function(req, res) {
    // If this function gets called, authentication was successful.
    // `req.user` contains the authenticated user.
    res.redirect('/');
});

// TODO: Change to POST
appRouter.get('/auth/signout', function(req, res){
  req.logout();
  res.redirect('http://www.lvh.me');
});

appRouter.post('/auth/register', function(req, res) {
  if (req.body.emailAddress &&
    req.body.password &&
    req.body.password === req.body.passwordConfirm) {
    const userData = {
      emailAddress: req.body.emailAddress,
      password: req.body.password,
      services: {
        email: {
          emailAddress: req.body.emailAddress,
        }
      }
    }
    User.create(userData, function (err, user) {
      if (err) {
        console.error(err);
        res.status(400).json({ error: "Failed to create user" });
        return;
      }

      const projectData = {
        users: [{
          userId: user._id,
          services: ['email'],
        }],
        apiKey: '',
      }
      // Create the user's default project
      Project.create(projectData, function (err, project) {
        if (err) {
          console.error(err);
          res.status(200).json({ error: 'Failed to create default project' });
          return err;
        } else {
          user.projects = [{
            projectId: project._id,
          }];
          user.save();
        }
      });
      res.redirect('/');
    });
  }
});

// User only can access this endpoint if they're signed in
appRouter.get('/', appSignedIn,  function(req, res, next) {
  Project.findOne({ _id: req.user.projects[0].projectId}, function(err, project) {
    if (err) {
      console.error(err);
      res.status(404).json({ error: 'Project not found' });
    }
    
    res.render('app.html', {
      email: req.user.emailAddress,
      telegramUsername: req.user.services.telegram.username ? "@" + req.user.services.telegram.username : "Seems like you haven't set up your Telegram account yet!",
      apiKey: project.apiKey,
    });

  });
});

app.use(subdomain('app', appRouter));

/********************************************************************
 * api.domain.com/v1
 ********************************************************************/
const apiRouter = express.Router();

// USER API

/**
 * Creates a new user
 */
apiRouter.post('/v1/users', function(req, res) {
  // Handle validation here
  if (req.body.emailAddress &&
    req.body.password &&
    req.body.password === req.body.passwordConfirm) {
    const userData = {
      emailAddress: req.body.emailAddress,
      password: req.body.password,
      services: {
        email: {
          emailAddress: req.body.emailAddress,
        }
      }
    }
    User.create(userData, function (err, user) {
      if (err) {
        console.error(err);
        res.status(400).json({ error: "Failed to create user" });
        return;
      }

      const projectData = {
        users: [{
          userId: user._id,
          services: [],
        }],
        apiKey: '',
      }
      // Create the user's default project
      Project.create(projectData, function (err, project) {
        if (err) {
          console.error(err);
          res.status(200).json({ error: 'Failed to create default project' });
          return err;
        } else {
          user.projects = [{
            projectId: project._id,
          }];
          user.save();
        }
      });

      res.status(200).json({ user: user });
    });
  }
});

/**
 * Gets the information for a single user
 */
apiRouter.get('/v1/users/:userId', function(req, res) {
  User.findById(req.params.userId, function(err, user) {
    if (err || !user) {
      console.error(err);
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json({ user: user });
  });
});

/**
 * Updates the information for a user
 */
// TODO: Limit the access to password
apiRouter.patch('/v1/users/:userId', function(req, res) {
  User.findOneAndUpdate( {_id: req.params.userId}, { $set: req.body }, { new: true }, function(err, user) {
    if (err || !user) {
      console.error(err);
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.status(200).send({ user: user });
  });
});

/**
 * Gets the default project for the user, then sends an alert
 */
apiRouter.post('/v1/users/:userId/notify', function(req, res) {
  const apiKey = req.body.apiKey;
  const message = req.body.message;
  // Find user via api key
  Project.findOne({ apiKey: apiKey }, function(err, project) {
    if (err || !project) {
      console.error(err);
      res.status(404).json({ error: 'Cannot find project' });
      return;
    }
    project.notify(message);
    // Project.notify should be async, should wait for response from project.notify
    res.status(200).json({ message: 'Message sent!' });
  })
});

/**
 * Gets a list of projects that the user belongs to
 */
apiRouter.get('/v1/users/:userId/projects', function(req, res) {
  const userId = req.params.userId;
  User.findById(userId, (err, user) => {
    if (err || !user) {
      console.error(err);
      res.status(400).send({ error: 'Cannot find user' });
      return;
    }
    res.status(200).json({
      projects: user.projects,
    });
  });
});


//PROJECT API

 /**
 * Create a new project
 */
apiRouter.post('/v1/projects', function(req, res) {
  const projectData = req.body;
  Project.create(projectData, function (err, project) {
    if (err) {
      console.error(err);
      res.status(400).json({ error: "Failed to create user" });
      return;
    } else {
      res.status(200).json({ project: project });
    }
  });
});

 /**
 * Get the information of a single project
 */
apiRouter.get('/v1/projects/:projectId', function(req, res) {
  try {
    const projectId = req.params.projectId;
    Project.findById(projectId, (err, project) => {
      if (err || !project) {
        console.error(err);
        res.status(404).json({ error: 'Cannot find proejct' })
        return;
      }
      res.status(200).json({ project: project });
    });
  } catch (err) {
    res.status(400).json({ error: err });
  }
});

/**
 * Updates the information for a user
 */
apiRouter.patch('/v1/projects/:projectId', function(req, res) {
  Project.findOneAndUpdate( {_id: req.params.projectId}, { $set: req.body }, { new: true }, function(err, project) {
    if (err || !project) {
      console.error(err);
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.status(200).send({ project: project });
  });
});

 /**
 * Notify all users involved in a project
 */
apiRouter.post('/v1/notify', function(req, res) {
  const apiKey = req.body.apiKey;
  const message = req.body.message;
  // Find user via api key
  Project.findOne({ apiKey: req.body.apiKey }, function(err, project) {
    if (err || !project) {
      console.error(err);
      res.status(404).json({ error: 'Cannot find project' });
      return;
    }
    project.notify(message);
    // Project.notify should be async, should wait for response from project.notify
    res.status(200).send({ message: 'Message sent' }); 
  })
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
