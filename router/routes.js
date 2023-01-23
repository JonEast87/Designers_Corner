const express = require("express");
const passport = require("passport");

const app = express.Router();
const Comment = require("../models/comments");
const Portfolio = require("../models/portfolio");
const User = require("../models/user");

// --- Global storage of commonly used requests ---
app.use(function(req, res, next) {
    res.locals.currentUser = req.user;
    res.locals.errors = req.flash("error");
    res.locals.infos = req.flash("info");
    next();
});


// --- Authentication and Registration --- //
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        next();
    } else {
        req.flash("info", "You must be logged in to see this page.");
        res.redirect("/login");
    }
}

app.get("/login", function(req, res) {
    res.render("login");
});

app.post("/login", passport.authenticate("login", {
    successRedirect: "/",
    failureRedirect: "/login",
    failureFlash: true
}));

app.get("/logout", function(req, res, next) {
    req.session.destroy();
    res.redirect("/");
});


// --- Users --- //

// --- CREATE USER ---
app.get("/signup", function(req, res) {
    res.render("signup");
});

app.post("/signup", function(req, res, next) {
    // CREATE method that checks if User already exists, if not than a new one is created in that username
    const experience = req.body.experience;
    const password = req.body.password;
    const phoneNumber = req.body.phoneNumber;
    const profileImage = req.body.profileImage;
    const purpose = req.body.purpose;
    const username = req.body.username;

    User.findOne({ username: username }, function(err, user) {
       if (err) return next(err);
       if (user) {
           req.flash("error", "User already exists.");
           return res.redirect("/signup");
       }
       const newUser = new User({
          experience: experience,
          password: password,
          profileImage: profileImage,
          phoneNumber: phoneNumber,
          purpose: purpose,
          username: username,
        });
       newUser.save(next);
     });
}, passport.authenticate("login", {
    successRedirect: "/",
    failureRedirect: "/signup",
    failureFlash: true
}));

// --- READ USER ---
app.get("/users/:username", ensureAuthenticated, async function(req, res, next) {
    // Using async call since this function returns more than one promise
    User.findOne({ username: req.params.username }, async function(err, user) {
        if (err) return next(err);
        if (!user) return next(404);
        const portfolios = await Portfolio.find({ authorId: user.id});
        res.render("profile", { user: user, portfolios: portfolios });
    });
});

// --- UPDATE USER ---
app.get("/users/:username/edit", ensureAuthenticated, function(req, res, next) {
    User.findOne({ username: req.params.username }, async function(err, user) {
        if (err) return next(err);
        if (!user) return next(404);
        res.render("edit", { user: user });
    });
});

app.post("/users/:username/edit", ensureAuthenticated, function(req, res, next) {
    // Simple UPDATE function that captures any changed made in the variable fields and saves it via mongoose .save()
    req.user.experience = req.body.experience;
    req.user.password = req.body.password;
    req.user.profileImage = req.body.profileImage;
    req.user.phoneNumber = req.body.phoneNumber;
    req.user.purpose = req.body.purpose;

    req.user.save(function(err) {
        if (err) {
            next(err);
            return;
        }
        req.flash("info", "Profile updated.");
        res.redirect("/users/" + req.user.username);
    });
});

// --- ADD FRIEND --- //
app.post("/users/:username/add", ensureAuthenticated, function(req, res, next) {
    User.findByIdAndUpdate(res.locals.currentUser._id, { $push: { "friendsList": { name: req.params.username }}}, function(err, user) {
        if (err) {
            next(err);
            return;
        }
        req.flash("info", "Friend added.");
        res.redirect("/users/" + res.locals.currentUser.username);
    });
});

// --- Portfolios --- //

// --- LIST PORTFOLIOS ---
app.get("/", function(req, res, next) {
    Portfolio.find()
        .sort({ createdAt: "descending" })
        .exec((err, portfolios) => {
            if (err) return next(err);
            res.render("index", { portfolios: portfolios });
    });
});

// --- CREATE PORTFOLIO ---
app.get("/add", ensureAuthenticated, function(req, res) {
    res.render("add-portfolio");
});

app.post("/add", ensureAuthenticated, function(req, res, next) {
    // CREATE method that checks if Portfolio already exists, if not than a new one is created
    const title = req.body.title;

    Portfolio.findOne({ title: title }, function(err, portfolio) {
        if (err) return next(err);
        if (portfolio) {
            req.flash("error", "Portfolio already exists.");
            return res.redirect("/add");
        }
        const tags = req.body.tags.split(", ");
        const newPortfolio = new Portfolio({
            authorId: res.locals.currentUser._id,
            author: res.locals.currentUser.username,
            description: req.body.description,
            headerImage: req.body.headerImage,
            contextImage: req.body.contextImage,
            contextImage2: req.body.contextImage2,
            contextImage3: req.body.contextImage3,
            tags: [...tags],
            title: title,
        });
        newPortfolio.save(next);
        res.redirect("/");
    });
});

// --- READ PORTFOLIO --- //
app.get("/portfolios/:portfolio", async function(req, res, next) {
    // Using async call since this function returns more than one promise
    const comment = await Comment.find({ portfolio: req.params.portfolio });
    Portfolio.findOne({ title: req.params.portfolio }, function(err, portfolio) {
        if (err) return next(err);
        if (!portfolio) return next(404);
        res.render("view-portfolio", { portfolio: portfolio, comments: comment });
    });
});

// --- UPDATE PORTFOLIO --- //


// --- DELETE PORTFOLIO --- //


// ---Comments--- //

// --- CREATE COMMENT --- //
app.post("/portfolios/:portfolio/add_comment", ensureAuthenticated, function(req, res, next) {
    /* CREATE method that captures the entry input and saves it to the Comment model,
     it is associated with its Portfolio by including the Portfolio id
     allowing easy rendering on the HTML/EJS file */
    const newComment = new Comment({
       authorId: res.locals.currentUser._id,
       author: res.locals.currentUser.username,
       portfolio: req.params.portfolio,
       comment: req.body.comment
   });
   newComment.save(next);
   res.redirect("/");
});

// --- READ COMMENT --- //
app.get("/portfolios/:portfolio/add_comment", ensureAuthenticated, function(req, res, next) {
    Portfolio.findOne({ title: req.params.portfolio }, function(err, portfolio) {
        if (err) return next(err);
        if (!portfolio) return next(404);
        res.render("add-comment", { portfolio: portfolio });
    });
});

// --- UPDATE COMMENT --- //


// --- DELETE  COMMENT --- //

module.exports = app;