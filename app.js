require('dotenv').config();
const express = require('express');
const subdomain = require('express-subdomain');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const path = require('path');
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
  usernameField: 'email_address',
  passwordField: 'password'
  },
  function(emailAddress, password, done) {
    User.findOne({ 'auth.email_address': emailAddress }, function (err, user) {
      if (err) { return done(err) }
      if (!user) { return done(null, false, { message: 'Incorrect email or password!' }) }
      
      user.auth.last_sign_in = new Date();
      user.save();
      
      return done(null, user);
    });
  }
));

// Helper function to check if user is signed in
function appSignedIn(req, res, next) {
  if (req.isAuthenticated) {
    return next();
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

// body-parser
const bodyParser = require('body-parser')
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(require('express-session')({ secret: 'keyboard cat', resave: true, saveUninitialized: true }));

// express-bearer-token
const bearerToken = require('express-bearer-token');
app.use(bearerToken());

// passport local
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
});

appRouter.post('/signin', function(req, res, next) {  
  passport.authenticate("local", function(err, user, info) {
    if (user) {
      res.redirect('/');
    } else {
      res.redirect('/signin');
    }

  })(req,res,next); 
});

appRouter.get('/signout', function(req, res){
  req.logout();
  res.redirect('http://www.lvh.me');
});

appRouter.post('/register', function(req, res) {
  if (req.body.email_address &&
    req.body.password &&
    req.body.password === req.body.password_confirm) {
    const userData = {
      auth: {
        email_address: req.body.email_address,
        password: req.body.password,
      },
      services: {
        email: {
          email_address: req.body.email_address,
        }
      }
    }
    User.create(userData, function (err, user) {
      if (err) {
        console.error(err.stack);
        res.status(400).json({ error: "Failed to create user" });
        return;
      }

      const projectData = {
        users: [{
          user_id: user._id,
          services: ['email'],
          is_moderator: true,
        }],
        api_key: '',
      }
      // Create the user's default project
      Project.create(projectData, function (err, project) {
        if (err) {
          console.error(err.stack);
          res.status(200).json({ error: 'Failed to create default project' });
          return;
        } else {
          user.projects = [{
            project_id: project._id,
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
  res.render('app.html');
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
  if (!req.body.auth || (!req.body.auth.email_address || !req.body.auth.password)) {
    res.status(400).json({ error: 'Expected email_address and password in request body' });
    return;
  }

  const userData = {
    auth: {
      email_address: req.body.auth.email_address,
      password: req.body.auth.password,
    },
    services: {
      email: {
        email_address: req.body.email_address,
      }
    }
  }
  User.create(userData, function (err, user) {
    if (err) {
      console.error(err.stack);
      res.status(400).json({ error: 'Failed to create user' });
      return;
    }

    const projectData = {
      users: [{
        user_id: user._id,
        services: [],
        is_moderator: true,
      }],
      api_key: '',
    }
    // Create the user's default project
    Project.create(projectData, function (err, project) {
      if (err) {
        console.error(err.stack);
        res.status(200).json({ error: 'Failed to create default project' });
        return;
      } else {
        project.issueApiKey();
        user.projects = [{
          project_id: project._id,
          is_moderator: true,
        }];
        user.save();
        res.status(200).json({ user: user });
      }
    });
  });
});

/**
 * Gets the information for a single user
 */
apiRouter.get('/v1/users/:userId', function(req, res) {
  User.findById(req.params.userId, '-auth.password -__v').exec(function(err, user) {
    if (err) {
      console.error(err.stack);
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.status(200).json({ user: user });
  });
});

/**
 * Updates the information for a user
 */
apiRouter.patch('/v1/users/:userId', function(req, res) {
  User.findOneAndUpdate( {_id: req.params.userId}, { $set: req.body }, { new: true }, function(err, user) {
    if (err || !user) {
      console.error(err.stack);
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.status(200).json({ user: user });
  });
});

/**
 * Updates the information for a user
 */
apiRouter.put('/v1/users/:userId', function(req, res) {
  User.findOneAndUpdate( {_id: req.params.userId}, { $set: req.body }, { new: true }, function(err, user) {
    if (err || !user) {
      console.error(err.stack);
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.status(200).json({ user: user });
  });
});

/**
 * Deletes a user
 * NOT IN USE FOR NOW
 */
/*
apiRouter.delete('/v1/users/:userId', function(req, res) {
  User.deleteOne( {_id: req.params.userId}, function(err, user) {
    if (err || !user) {
      console.error(err.stack);
      res.status(404).json({ error: 'User not found' });
      return;
    }
    // Go through all projects and delete if the user is the only one on the project
    // If there is more than one project, need to make another user the moderator
    res.status(204).end();
  });
});
*/

/**
 * Gets a list of projects that the user belongs to
 */
apiRouter.get('/v1/users/:userId/projects', function(req, res) {
  const userId = req.params.userId;
  User.findById(userId, (err, user) => {
    if (err || !user) {
      console.error(err.stack);
      res.status(404).json({ error: 'Cannot find user' });
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
 * TODO: Need to add user to the project, and add project to the user
 */
/*
apiRouter.post('/v1/projects', function(req, res) {
  const projectData = req.body;
  Project.create(projectData, function (err, project) {
    if (err) {
      console.error(err.stack);
      res.status(400).json({ error: 'Failed to create project' });
      return;
    } else {
      res.status(200).json({ project: project });
    }
  });
});
*/

 /**
 * Get the information of a single project
 */
apiRouter.get('/v1/projects/:projectId', function(req, res) {
  try {
    const projectId = req.params.projectId;
    Project.findById(projectId, '-__v', (err, project) => {
      if (err || !project) {
        console.error(err.stack);
        res.status(404).json({ error: 'Cannot find project' })
        return;
      }
      res.status(200).json({ project: project });
    });
  } catch (err) {
    res.status(400).json({ error: err });
  }
});

/**
 * Updates the information for a project
 */
apiRouter.patch('/v1/projects/:projectId', function(req, res) {
  Project.findOneAndUpdate( {_id: req.params.projectId}, { $set: req.body }, { new: true }, function(err, project) {
    if (err || !project) {
      console.error(err.stack);
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.status(200).send({ project: project });
  });
});

/**
 * Updates the information for a project
 */
apiRouter.put('/v1/projects/:projectId', function(req, res) {
  Project.findOneAndUpdate( {_id: req.params.projectId}, { $set: req.body }, { new: true }, function(err, project) {
    if (err || !project) {
      console.error(err.stack);
      res.status(404).json({ error: 'Project not found, ' + err.message });
      return;
    }
    res.status(200).send({ project: project });
  });
});

/**
 * Gets the API key for a project
 */
apiRouter.get('/v1/projects/:projectId/key', function(req, res) {
  Project.findById(req.params.projectId, function(err, project) {
    if (err || !project) {
      console.error(err.stack);
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.status(200).send({ api_key: project.api_key });
  });
});

/**
 * Issues a new apiKey for the specified project
 */
apiRouter.post('/v1/projects/:projectId/key', function(req, res) {
  Project.findById(req.params.projectId, function(err, project) {
    if (err || !project) {
      console.error(err.stack);
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    project.issueApiKey();
    res.status(200).send({ api_key: project.api_key });
  });
});

/**
 * Revokes the apiKey for the specified project
 */
apiRouter.delete('/v1/projects/:projectId/key', function(req, res) {
  Project.findById(req.params.projectId, function(err, project) {
    if (err || !project) {
      console.error(err.stack);
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    project.revokeApiKey();
    res.status(204).end();
  });
});

 /**
 * Notify all users involved in a project
 * TODO: Should put the apy key in request.headers.authorization
 */
apiRouter.post('/v1/notify', function(req, res) {
  const apiKey = req.body.apiKey;
  const message = req.body.message;
  // Find user via api key
  Project.findOne({ api_key: req.body.apiKey }, function(err, project) {
    if (err || !project) {
      console.error(err.stack);
      res.status(404).json({ error: 'Cannot find project' });
      return;
    }
    project.notify(message);
    res.status(204).end(); 
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
