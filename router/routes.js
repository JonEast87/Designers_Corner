// --- imports --- //
const bcrypt = require("bcrypt-nodejs");
const express = require("express");
const passport = require("passport");

// --- file imports --- //
const app = express.Router();
const Comment = require("../models/comments");
// const Profile = require("../models/profile");
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

function checkOwnership(req, res, next) {
    const username = req.params.username;
    const currentUser = res.locals.currentUser.username;

    if (username === currentUser) {
        next();
    } else {
        req.flash("error", "You are not allowed access.");
        res.status(403).redirect("/");
    }
}

// --- USERS --- //

// --- AUTHENTICATE USER --- //
app.get("/login", function(req, res) {
    res.render("login");
});

app.post("/login", async (req, res, next) => {
    req.flash("info", "You have been successfully signed in.");
    next();
}, passport.authenticate("login", {
    successRedirect: "/",
    failureRedirect: "/login",
    failureFlash: true
}));

app.get("/logout", ensureAuthenticated, function(req, res, next) {
    req.session.destroy();
    res.redirect("/login");
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
        req.flash("info", "You have successfully created an account.");
        await newUser.save(next);
    } catch (error) {
        res.status(404).send({ error: "Resource not found." });
    }
}, passport.authenticate("login", {
    successRedirect: "/",
    failureRedirect: "/signup",
    failureFlash: true
}));

// --- UPDATE USER ---
app.get("/users/:username/edit", ensureAuthenticated, checkOwnership, async (req, res) => {
    try {
        let user = await User.findOne({ username: req.params.username });
        res.status(200).render("edit-user", { user: user });
    } catch (error) {
        res.status(404).send({ error: "Edit does not exist." });
    }
});

app.patch("/users/:username", ensureAuthenticated, checkOwnership, async (req, res) => {
    // Simple UPDATE function that captures any changed made in the variable fields and saves it via mongoose .save()
    const options = { new: true };
    const updatedData = req.body;

    try {
        let user = await User.findOne({ username: req.params.username });
        await User.findByIdAndUpdate(user.id, updatedData, options);
        req.flash("info", "Your account has been updated.");
        res.status(201).redirect("/users/" + req.user.username);
    } catch (error) {
        res.status(404).send({ error: "Update does not match." });
    }
});

// --- UPDATE USER PASSWORD ---
app.get("/password/:username/edit_password", ensureAuthenticated, checkOwnership, async (req, res) => {
   try {
        let user = await User.findOne({ username: req.params.username });
        res.status(200).render("edit-userpassword", { user: user });
   } catch (error) {
       res.status(404).send({ error: "Password does not exist." });
   }
});

app.patch("/password/:username/edit_password", ensureAuthenticated, checkOwnership, async (req, res) => {
    let password = req.body.password;
    let user = await User.findOne({ username: req.params.username });
    try {
        user.password = password;
        user.save();
        req.flash("info", "Password has been updated.");
        res.status(201).redirect("/users/" + req.user.username);
    } catch (error) {
        console.log(error);
       res.status(404).send({ error: "Update password does not exists." });
    }
});

// --- DELETE USER ---
app.delete("/delete/:username", ensureAuthenticated, checkOwnership, async (req, res) => {
   /* Upon user deletion this function uses a manual cascade that searches for any comments / portfolios the user
   owns and removes them as well. */
   let user = await User.findOne({ username: req.params.username });

    try {
       await User.findByIdAndDelete(user.id, req.user);
       await Portfolio.deleteMany({ authorId: user.id, name: { $gte: req.params.username }})
           .then(function() {
                console.log("Portfolio deleted.");
       }).catch(function(error) {
           console.log(error);
       });
       await Comment.deleteMany({ authorId: user.id, name: { $gte: req.params.username }})
           .then(function() {
                console.log("Comments deleted.");
       }).catch(function(error) {
           console.log(error);
       });
       req.flash("info", "Your account and all related items have been deleted.");
       res.status(200).redirect("/");
   } catch (error) {
       res.status(404).send({ error: "Delete does not exists." });
   }
});

// --- READ PROFILE ---
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

// --- ADD USER PROFILE ---
app.get("/profiles/add_profile/:username", ensureAuthenticated, checkOwnership, async (req, res) => {
    const user = await User.findOne({ username: req.params.username });
    res.render("add-profile", { user: user });
});

app.post("/profiles/add_profile/:username", ensureAuthenticated, checkOwnership, async (req, res, next) => {
    const newProfile = new Object({
        profileAuthor: res.locals.currentUser._id,
        bio: req.body.bio,
        profileImage: req.body.profileImage,
        purpose: req.body.purpose,
        skills: req.body.skills
    });

    try {
        const user = await User.findOne({ username: req.params.username });

        if (user.profileExists === false) {
            user.profile = newProfile;
            user.profileExists = true;
            await user.save(next);
            req.flash("info", "Profile created for your account.");
            return res.status(201).redirect("/users/" + req.params.username);
        } else {
            req.flash("error", "Profile already exists.");
            res.status(409);
            return res.redirect("/users/" + req.params.username);
        }
    } catch (error) {
        res.status(404).send({ error: "Resource not found." });
    }
});

// -- EDIT PROFILE ---
app.get("/profiles/edit_profile/:username", ensureAuthenticated, checkOwnership, async (req, res) => {
   const user = User.findOne({ username: req.params.username });
   res.status(200).render("edit-profile", { user: user });
});

app.patch("/profiles/edit_profile", ensureAuthenticated, async (req, res) => {
    const profileSkills = req.body.purpose,
        profilePurpose = req.body.skills,
        profileBio = req.body.bio,
        profileImage = req.body.profileImage;

    try {
        let user = await User.findOne({ username: res.locals.currentUser.username });
        user.profile.skills = profileSkills;
        user.profile.purpose = profilePurpose;
        user.profile.bio = profileBio;
        user.profile.profileImage = profileImage;
        await user.save();
        req.flash("info", "Profile has been successfully updated.");
        res.status(201).redirect("/users/" + res.locals.currentUser.username);
    } catch (error) {
        res.status(404).send({ error: "Profile does not match." });
    }
});

// --- ADD FRIEND ---
app.post("/users/:username/add", ensureAuthenticated, checkOwnership, async (req, res) => {
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
    try {
        const portfolios = await Portfolio.find().sort({ createdAt: "descending" });
        res.status(200).render("index", { portfolios: portfolios });
    } catch (error) {
        res.status(404).send({ error: "No portfolios." });
    }
});

// --- CREATE PORTFOLIO ---
app.get("/add", ensureAuthenticated, async (req, res) => {
    res.render("add-portfolio");
});

app.post("/add", ensureAuthenticated, async (req, res, next) => {
    // CREATE method that checks if Portfolio already exists, if not than a new one is created
    const newPortfolio = new Portfolio({
        authorId: res.locals.currentUser._id,
        author: res.locals.currentUser.username,
        description: req.body.description,
        imageOfOne: req.body.imageOfOne,
        imageOfTwo: req.body.imageOfTwo,
        imageOfThree: req.body.imageOfThree,
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
        const user = await User.findOne({ _id: portfolio.authorId });
        res.status(200).render("view-portfolio", { portfolio: portfolio, comments: comment, user: user });
    } catch (error) {
        res.status(404).send({ error: "Post does not match." });
    }
});

// --- UPDATE PORTFOLIO ---
app.get("/portfolios/:portfolios/edit", ensureAuthenticated, checkOwnership, async (req, res) => {
   try {
       let portfolio = await Portfolio.findOne({ title: req.params.portfolios });
       res.status(200).render("edit-portfolio", { portfolio: portfolio });
   } catch(error) {
       res.status(404).send({ error: "Portfolio does not match." });
   }
});

app.patch("/portfolios/:portfolio", ensureAuthenticated, checkOwnership, async (req, res) => {
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
app.delete("/delete-portfolio/:portfolio", ensureAuthenticated, checkOwnership, async (req, res) => {
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
app.get("/portfolios/:portfolio/edit_comment/:comment", ensureAuthenticated, checkOwnership, async (req, res) => {
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

app.patch("/portfolios/:portfolio/:comment", ensureAuthenticated, checkOwnership, async (req, res) => {
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
app.delete("/portfolios/:portfolio/comment/:comment", ensureAuthenticated, checkOwnership, async (req, res) => {
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