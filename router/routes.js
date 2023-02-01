// --- imports --- //
const bcrypt = require("bcrypt-nodejs");
const express = require("express");
const passport = require("passport");

// --- file imports --- //
const app = express.Router();
const Comment = require("../models/comments");
const Portfolio = require("../models/portfolio");
const User = require("../models/user");

// --- Global storage of commonly used requests --- //
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

// --- USERS --- //

// --- AUTHENTICATE USER --- //
app.get("/login", function(req, res) {
    res.render("login");
});

app.post("/login", passport.authenticate("login", {
    successRedirect: "/",
    failureRedirect: "/login",
    failureFlash: true
}));

app.get("/logout", ensureAuthenticated, function(req, res, next) {
    req.session.destroy();
    res.redirect("/");
});

// --- CREATE USER ---
app.get("/signup", function(req, res) {
    res.render("add-user");
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
        res.status(200).render("view-profile", { user: user, portfolios: portfolios });
    } catch (error) {
        res.status(404).send({ error: "User does not exist." });
    }
});

// --- UPDATE USER ---
app.get("/users/:username/edit", ensureAuthenticated, async (req, res) => {
    try {
        let user = await User.findOne({ username: req.params.username });
        res.status(200).render("edit-user", { user: user });
    } catch (error) {
        res.status(404).send({ error: "User does not exist." });
    }
});

app.patch("/users/:username", ensureAuthenticated, async (req, res) => {
    // Simple UPDATE function that captures any changed made in the variable fields and saves it via mongoose .save()
    const options = { new: true };
    const updatedData = req.body;

    try {
        let user = await User.findOne({ username: req.params.username });
        await User.findByIdAndUpdate(user.id, updatedData, options);
        req.flash("info", "Your account has been updated.");
        res.status(201).redirect("/users/" + req.user.username);
    } catch (error) {
        res.status(404).send({ error: "User does not match." });
    }
});

// --- UPDATE USER PASSWORD ---
app.get("/password/:username/edit_password", ensureAuthenticated, async (req, res) => {
   try {
        let user = await User.findOne({ username: req.params.username });
        res.status(200).render("edit-userpassword", { user: user });
   } catch (error) {
       res.status(404).send({ error: "User does not exist." });
   }
});

app.patch("/password/:username/edit_password", ensureAuthenticated, async (req, res) => {
    let password = req.body.password;
    let user = await User.findOne({ username: req.params.username });
    try {
        user.password = password;
        user.save();
        req.flash("info", "Password has been updated.");
        res.status(201).redirect("/users/" + req.user.username);
    } catch (error) {
        console.log(error);
       res.status(404).send({ error: "User does not exists." });
    }
});

// --- DELETE USER ---
app.delete("/delete/:username", ensureAuthenticated, async (req, res) => {
   /* Upon user deletion this function uses a manual cascade that searches for any comments / portfolios the user
   owns and removes them as well. */
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
       req.flash("info", "Your account and all related items have been deleted.");
       res.status(200).redirect("/");
   } catch (error) {
       res.status(404).send({ error: "User does not exists." });
   }
});

// --- ADD FRIEND ---
app.post("/users/:username/add", ensureAuthenticated, async (req, res) => {
    const friendToAdd = req.params.username;

    try {
        User.findByIdAndUpdate(res.locals.currentUser._id,
            { $push: { "friendsList": { name: friendToAdd }}},
            { new: true },
            (error, friend) => {
                if (error) return error;
                else return friend;
        });
        req.flash("info", "Friend added.");
        return res.status(201).redirect("/users/" + res.locals.currentUser.username);
    } catch (error) {
        res.status(404).send({ error: "Resource not found." });
    }
});


// --- PORTFOLIOS --- //

// --- LIST PORTFOLIOS ---
app.get("/", ensureAuthenticated, async(req, res, next) => {
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
        req.flash("info", "Portfolio added to your account.");
        return res.status(201).redirect("/");

    } catch (error) {
        res.status(404).send({ error: "Resource not found." });
    }
});

// --- READ PORTFOLIO ---
app.get("/portfolios/:portfolio", ensureAuthenticated, async (req, res, next) => {
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
app.get("/portfolios/:portfolios/edit", ensureAuthenticated, async (req, res) => {
   try {
       let portfolio = await Portfolio.findOne({ title: req.params.portfolios });
       res.status(200).render("edit-portfolio", { portfolio: portfolio });
   } catch(error) {
       res.status(404).send({ error: "Portfolio does not match." });
   }
});

app.patch("/portfolios/:portfolio", ensureAuthenticated, async (req, res) => {
    const options = { new: true };
    const updatedData = req.body;

    try {
        let portfolio = await Portfolio.findOne({ title: req.params.portfolio });
        await Portfolio.findByIdAndUpdate(portfolio._id, updatedData, options);
        req.flash("info", "Portfolio has been updated.");
        res.status(201).redirect("/portfolios/" + req.body.title);
    } catch (error) {
        console.log(error);
        res.status(404).send({ error: "Portfolio does not match." });
    }
});

// --- DELETE PORTFOLIO ---
app.delete("/delete-portfolio/:portfolio", ensureAuthenticated, async (req, res) => {
    try {
        await Portfolio.deleteOne({ title: req.params.portfolio });
        req.flash("info", "Portfolio has been successfully deleted.");
        res.status(200).redirect("/");
    } catch (error) {
        console.log(error);
        res.status(404).send({ error: "Portfolio does not exist." });
    }
});


// ---COMMENTS--- //

// --- CREATE COMMENT ---
app.get("/portfolios/:portfolio/add_comment", ensureAuthenticated, async (req, res, next) => {
    try {
        const portfolio = await Portfolio.findOne({ title: req.params.portfolio });
        const comment = await Portfolio.find({ portfolio: req.params.portfolio });
        res.status(200).render("add-comment", { portfolio: portfolio, comment: comment });
    } catch (error) {
        res.status(404).send({ error: "No portfolio exists for this comment." });
    }
});

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
       req.flash("info", "Comment added.");
       res.status(201).redirect("/");
    } catch (error) {
        res.status(404).send({ error: "Post does not match." });
    }
});

// --- READ COMMENT ---
app.get("/portfolios/:portfolio/view_comment/:comment", ensureAuthenticated, async (req, res) => {
    try {
        const portfolio = await Portfolio.findOne({ title: req.params.portfolio });
        const comment = await Portfolio.find({ portfolio: req.params.portfolio });
        res.status(200).render("view-comment", { portfolio: portfolio, comment: comment });
    } catch (error) {
        res.status(404).send({ error: "No portfolio exists for this comment." });
    }
});

// --- UPDATE COMMENT ---
app.get("/portfolios/:portfolio/edit_comment/:comment", ensureAuthenticated, async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.comment);
        const portfolio = await Comment.findOne({ title: req.params.portfolio });
        console.log(req.params);
        res.status(200).render("edit-comment", { comment: comment, portfolio: portfolio });
    } catch (error) {
        console.log(error);
        res.status(404).send({ error: "This comment does not exist." });
    }
});

app.patch("/portfolios/:portfolio/:comment", ensureAuthenticated, async (req, res) => {
    const options = { new: true };
    const updatedData = req.body;

    try {

        await Comment.findByIdAndUpdate(req.params.comment, updatedData, options);
        req.flash("info", "Comment has been successfully updated.");
        res.status(201).redirect("/portfolios/" + req.params.portfolio);
    } catch (error) {
        res.status(404).send({ error: "No comment exists here." });
    }
});

// --- DELETE  COMMENT ---
app.delete("/portfolios/:portfolio/comment/:comment", ensureAuthenticated, async (req, res) => {
    try {
        const id = req.params.comment;
        await Comment.findByIdAndDelete(id);
        req.flash("info", "Comment successfully deleted.");
        res.status(200).redirect("/portfolios/" + req.params.portfolio);
    } catch (error) {
        res.status(404).send({ error: "No comment exists." });
    }
});

module.exports = app;