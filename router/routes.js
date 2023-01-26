const ejs = require("ejs");
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

app.post("/signup", async (req, res, next) => {
    // CREATE method that checks if User already exists, if not than a new one is created in that username
   const newUser = new User({
      experience: req.body.experience,
      password: req.body.password,
      profileImage: req.body.profileImage,
      phoneNumber: req.body.phoneNumber,
      purpose: req.body.purpose,
      username: req.body.username,
    });
    let user = await User.findOne({ username: req.params.username });

    try {
        if (user) {
            req.flash("error", "This user already exists. Please choose a different name.");
            res.status(409);
            return res.redirect("/signup");
        }
        await newUser.save(next);
    } catch (error) {
        res.status(404).send({ error: "Resource not found." });
    }
}, passport.authenticate("login", {
    successRedirect: "/",
    failureRedirect: "/signup",
    failureFlash: true
}));

// --- READ USER ---
app.get("/users/:username", ensureAuthenticated, async (req, res) => {
    // Using async call since this function returns more than one promise
    try {
        let user = await User.findOne({ username: req.params.username });
        const portfolios = await Portfolio.find({ authorId: user.id});
        res.status(200).render("profile", { user: user, portfolios: portfolios });
    } catch (error) {
        res.status(404).send({ error: "User does not match." });
    }
});

// --- UPDATE USER ---
app.get("/users/:username/edit", ensureAuthenticated, async (req, res) => {
    try {
        let user = await User.findOne({ username: req.params.username });
        res.status(200).render("edit", { user: user });
    } catch (error) {
        res.status(404).send({ error: "User does not match." });
    }
});

app.post("/users/:username", ensureAuthenticated, async (req, res, next) => {
    // Simple UPDATE function that captures any changed made in the variable fields and saves it via mongoose .save()
    req.user.experience = req.body.experience;
    req.user.password = req.body.password;
    req.user.profileImage = req.body.profileImage;
    req.user.phoneNumber = req.body.phoneNumber;
    req.user.purpose = req.body.purpose;

    try {
        let user = await User.findOne({ username: req.params.username });
        await User.findByIdAndUpdate(user.id, req.user);
        res.status(201).redirect("/users/" + req.user.username);
    } catch (error) {
        res.status(404).send({ error: "User does not match." });
    }
});

// --- DELETE USER ---
app.delete("/delete/:username", async (req, res) => {
   /* Upon user deletion this function as a manual cascade that searches for any comments / portfolios the user
   owns and removes thus as well. */
   let user = await User.findOne({ username: req.params.username });

    try {
       await User.findByIdAndDelete(user.id, req.user);
       await Portfolio.deleteMany({ authorId: user.id, name: { $gte: req.params.username }}).then(function() {
           console.log("Portfolio deleted.");
       }).catch(function(error) {
           console.log(error);
       });
       await Comment.deleteMany({ authorId: user.id, name: { $gte: req.params.username }}).then(function() {
           console.log("Comments deleted.");
       }).catch(function(error) {
           console.log(error);
       });
       res.status(200).redirect("/");
   } catch (error) {
       res.status(404).send({ error: "User does not exists." });
   }
});

// --- ADD FRIEND ---
app.post("/users/:username/add", ensureAuthenticated, async (req, res) => {
    const friendsList = res.locals.currentUser.friendsList,
        friendToAdd = req.params.username,
        friendCheck = (friend) => friend.name === friendToAdd;

    try {
        if (friendsList.findIndex(friendCheck) > -1) {
            req.flash("error", "This user is already added as a friend.");
            return res.status(409).redirect("/users/:username");
        } else {
            User.findByIdAndUpdate(res.locals.currentUser._id, { $push: { "friendsList": { name: req.params.username }}});
            req.flash("info", "Friend added.");
            return res.status(201).redirect("/users/" + res.locals.currentUser.username);
        }

    } catch (error) {
        res.status(404).send({ error: "Resource not found." });
    }
});


// --- Portfolios --- //

// --- LIST PORTFOLIOS ---
app.get("/", async (req, res, next) => {
    Portfolio.find()
        .sort({ createdAt: "descending" })
        .exec((err, portfolios) => {
            if (err) return next(err);
            res.render("index", { portfolios: portfolios });
    });
});

// --- CREATE PORTFOLIO ---
app.get("/add", ensureAuthenticated, async (req, res) => {
    res.render("add-portfolio");
});

app.post("/add", ensureAuthenticated, async (req, res, next) => {
    // CREATE method that checks if Portfolio already exists, if not than a new one is created
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
        title: req.body.title,
    });

    try {
        const portfolio = await Portfolio.findOne({ title: req.body.title });

        if (portfolio) {
            req.flash("error", "Portfolio already exists.");
            res.status(409);
            return res.redirect("/add");
        }

        await newPortfolio.save(next);

        return res.status(201).redirect("/");

    } catch (error) {
        res.status(404).send({ error: "Resource not found." });
    }
});

// --- READ PORTFOLIO ---
app.get("/portfolios/:portfolio", async (req, res, next) => {
    // Using async call since this function returns more than one promise
    try {
        const comment = await Comment.find({ portfolio: req.params.portfolio });
        const portfolio = await Portfolio.findOne({ title: req.params.portfolio });
        res.status(200).render("view-portfolio", { portfolio: portfolio, comments: comment });
    } catch (error) {
        res.status(404).send({ error: "Post does not match." });
    }
});

// --- UPDATE PORTFOLIO ---


// --- DELETE PORTFOLIO ---


// ---Comments--- //

// --- CREATE COMMENT ---
app.post("/portfolios/:portfolio/add_comment", ensureAuthenticated, async (req, res, next) => {
    /* CREATE method that captures the entry input and saves it to the Comment model,
     it is associated with its Portfolio by including the Portfolio id
     allowing easy rendering on the HTML/EJS file */
    const newComment = new Comment({
       authorId: res.locals.currentUser._id,
       author: res.locals.currentUser.username,
       portfolio: req.params.portfolio,
       comment: req.body.comment
   });

    try {
       await newComment.save(next);
       res.status(201).redirect("/");
    } catch (error) {
        res.status(404).send({ error: "Post does not match." });
    }
});

// --- READ COMMENT ---
app.get("/portfolios/:portfolio/add_comment", ensureAuthenticated, async (req, res, next) => {
    try {
        const portfolio = await Portfolio.findOne({ title: req.params.portfolio });
        res.status(200).render("add-comment", { portfolio: portfolio });
    } catch (error) {
        res.status(404).send({ error: "No portfolio exists for this comment." });
    }
});

// --- UPDATE COMMENT ---


// --- DELETE  COMMENT ---


module.exports = app;