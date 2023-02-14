// --- imports --- //
const express = require("express");
const passport = require("passport");

// --- file imports --- //
const app = express.Router();
const Comment = require("../models/comments");
const Job = require("../models/jobs");
const Portfolio = require("../models/portfolios");
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

const checkUser = async (req, res, next) => {
    const username = req.params.username;
    const data = await User.findOne({ username: username });
    const currentUserID = res.locals.currentUser._id;

    if (data._id.equals(currentUserID)) {
        next();
    } else {
        console.log(data._id);
        console.log(currentUserID);
        req.flash("error", "You are not the owner of this account.");
        res.status(403).redirect("/");
    }
}

const checkAuthor = async (req, res, next) => {
    const portfolio = req.params.portfolios;
    const data = await User.findOne({ title: portfolio });
    const currentUserID = res.locals.currentUser._id;

    if (data.authorId.equals(currentUserID)) {
        next();
    } else {
        req.flash("error", "You are not the author of this content.");
        res.status(403).redirect("/");
    }
}

const checkPoster = async (req, res, next) => {
    const job = req.params.jobs;
    const data = await Job.findOne({ jobTitle: job });
    const currentUserID = res.locals.currentUser._id;

    if (data.jobPosterID === currentUserID) {
        next();
    } else {
        req.flash("error", "You are not the job poster. Access restricted.");
        res.status(403).redirect("/jobs");
    }
}

// --- USERS --- //

// --- AUTHENTICATE USER --- //
app.get("/login", function(req, res) {
    res.render("users/login");
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
    res.render("users/add-user");
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
app.get("/users/:username/edit", ensureAuthenticated, checkUser, async (req, res) => {
    try {
        let user = await User.findOne({ username: req.params.username });
        res.status(200).render("users/edit-user", { user: user });
    } catch (error) {
        res.status(404).send({ error: "Edit does not exist." });
    }
});

app.patch("/users/:username", ensureAuthenticated, checkUser, async (req, res) => {
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
app.get("/password/:username/edit_password", ensureAuthenticated, checkUser, async (req, res) => {
   try {
        let user = await User.findOne({ username: req.params.username });
        res.status(200).render("users/edit-userpassword", { user: user });
   } catch (error) {
       res.status(404).send({ error: "Password does not exist." });
   }
});

app.patch("/password/:username/edit_password", ensureAuthenticated, checkUser, async (req, res) => {
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
app.delete("/delete/:username", ensureAuthenticated, checkUser, async (req, res) => {
   /* Upon user deletion this function uses a manual cascade that searches for any comments / portfolios the user
   owns and removes them as well. */
   let user = await User.findOne({ username: req.params.username });

    try {
       await User.findByIdAndDelete(user.id, req.user);
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

// --- PROFILES --- //

// --- READ PROFILE ---
app.get("/users/:username", ensureAuthenticated, async (req, res) => {
    // Using async call since this function returns more than one promise
    try {
        let user = await User.findOne({ username: req.params.username });
        res.status(200).render("profiles/view-profile", { user: user, portfolio: user.portfolio });
    } catch (error) {
        console.log(error);
        res.status(404).send({ error: "User does not exist." });
    }
});

// --- ADD PROFILE ---
app.get("/profiles/add_profile/:username", ensureAuthenticated, checkUser, async (req, res) => {
    const user = await User.findOne({ username: req.params.username });
    res.render("profiles/add-profile", { user: user });
});

app.post("/profiles/add_profile/:username", ensureAuthenticated, checkUser, async (req, res, next) => {
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
app.get("/profiles/edit_profile/:username", ensureAuthenticated, checkUser, async (req, res) => {
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


// --- PORTFOLIOS --- //

// --- LIST PORTFOLIOS ---
const collectPortfolios = async (req, res) => {
    const users = await User.find()
    let portfolios = new Array();

    for (let i = 0; i < users.length; i++) {
        if (users[i].portfolio !== undefined) {
            portfolios.push(users[i].portfolio);
        }
    return portfolios;
    }
}

app.get("/", ensureAuthenticated, async(req, res, next) => {
    try {
        const portfolios = await collectPortfolios(req, res);
        res.status(200).render("index", { portfolios: portfolios });
    } catch (error) {
        console.log(error);
        res.status(404).send({ error: "No portfolios." });
    }
});

// --- CREATE PORTFOLIO ---
app.get("/add", ensureAuthenticated, async (req, res) => {
    res.render("portfolios/add-portfolio");
});

app.post("/add", ensureAuthenticated, async (req, res, next) => {
    try {
        const user = await User.findById(res.locals.currentUser._id);

        if (user.portfolioExists === true) {
            req.flash("error", "Portfolio already exists, you can only have one portfolio at a time.");
            res.status(409);
            return res.redirect("/edit");
        } else {
            user.portfolio = {
                author: res.locals.currentUser.username,
                authorId: res.locals.currentUser._id,
                description: req.body.description,
                images: req.body.images,
                // imageOfTwo: req.body.imageOfTwo,
                // imageOfThree: req.body.imageOfThree,
                tags: req.body.tags,
                title: req.body.title,
                url: req.body.url
            };
            user.portfolioExists = true;
            await user.save(next);
            req.flash("info", "Portfolio added to your account.");
            return res.status(201).redirect("/");
        }
    } catch (error) {
        res.status(404).send({ error: "Resource not found." });
    }
});

// --- READ PORTFOLIO ---
app.get("/portfolios/:portfolio", ensureAuthenticated, async (req, res, next) => {
    // Using async call since this function returns more than one promise
    try {
        const user = await User.findById(res.locals.currentUser._id);
        const portfolio = user.portfolio;
        const portfolioComments = await user.populate("portfolio.comments");
        res.status(200).render("portfolios/view-portfolio", { portfolio: portfolio, comments: portfolio.comments });
    } catch (error) {
        console.log(error);
        res.status(404).send({ error: "Post does not match." });
    }
});

// --- UPDATE PORTFOLIO ---
app.get("/portfolios/:portfolios/edit", ensureAuthenticated, checkAuthor, async (req, res) => {
   try {
       const user = await User.findById(res.locals.currentUser._id);
       const portfolio = user.portfolio;
       res.status(200).render("portfolios/edit-portfolio", { portfolio: portfolio });
   } catch(error) {
       res.status(404).send({ error: "Portfolio does not match." });
   }
});

app.patch("/portfolios/:portfolio", ensureAuthenticated, checkAuthor, async (req, res) => {
    const options = { new: true };
    const updatedData = req.body;

    try {
        let portfolio = await Portfolio.findOne({ title: req.params.portfolio });
        await Portfolio.findByIdAndUpdate(portfolio._id, updatedData, options);
        req.flash("info", "Portfolio has been updated.");
        res.status(201).redirect("/portfolios/" + req.body.title);
    } catch (error) {
        res.status(404).send({ error: "Portfolio does not match." });
    }
});


// ---COMMENTS--- //

// --- CREATE COMMENT ---
app.get("/portfolios/:portfolio/add_comment", ensureAuthenticated, async (req, res, next) => {
    try {
        const user = await User.findById(res.locals.currentUser._id);
        res.status(200).render("comments/add-comment", { portfolio: user.portfolio });
    } catch (error) {
        res.status(404).send({ error: "No portfolio exists for this comment." });
    }
});

app.post("/portfolios/:portfolio/add_comment", ensureAuthenticated, async (req, res, next) => {
    /* CREATE method that captures the entry input and saves it to the Comment model,
     it is associated with its Portfolio by including the Portfolio id
     allowing easy rendering on the HTML/EJS file */
    const newComment = new Comment({
       author: res.locals.currentUser.username,
       authorID: res.locals.currentUser._id,
       comment: req.body.comment
   });

    try {
        const savedComment = await newComment.save();
        const user = await User.findById(res.locals.currentUser._id);
        user.portfolio.comments.push(newComment);
        user.save(next);
        req.flash("info", "Comment added.");
        res.status(201).redirect("/");
    } catch (error) {
        res.status(404).send({ error: "Post does not match." });
    }
});

// --- READ COMMENT ---
app.get("/portfolios/:portfolio/view_comment/:comment", ensureAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(res.locals.currentUser._id);
        const comment = user.portfolio.comments.find(({ _id }) => _id.toString() === req.params.comment);
        res.status(200).render("comments/view-comment", { portfolio: user.portfolio, comment: comment });
    } catch (error) {
        res.status(404).send({ error: "No portfolio exists for this comment." });
    }
});

// --- UPDATE COMMENT ---
app.get("/portfolios/:portfolio/edit_comment/:comment", ensureAuthenticated, async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.comment);
        const user = await User.findById(res.locals.currentUser._id);
        res.status(200).render("comments/edit-comment", { portfolio: user.portfolio, comment: comment });
    } catch (error) {
        res.status(404).send({ error: "This comment does not exist." });
    }
});

app.patch("/portfolios/:portfolio/:comment", ensureAuthenticated, async (req, res) => {
    const options = { new: true };
    const updatedData = req.body;

    try {
        console.log(updatedData);
        await Comment.findByIdAndUpdate(req.params.comment, updatedData, options);
        req.flash("info", "Comment has been successfully updated.");
        res.status(201).redirect("/portfolios/" + req.params.portfolio);
    } catch (error) {
        console.log(error);
        res.status(404).send({ error: "No comment exists here." });
    }
});

// --- DELETE  COMMENT ---
app.delete("/portfolios/:portfolio/comment/:comment", ensureAuthenticated, async (req, res) => {
    try {
        await Comment.findByIdAndDelete(req.params.comment);
        req.flash("info", "Comment successfully deleted.");
        res.status(200).redirect("/portfolios/" + req.params.portfolio);
    } catch (error) {
        res.status(404).send({ error: "No comment exists." });
    }
});


// --- JOBS --- //

// --- LIST JOBS ---
app.get("/jobs", ensureAuthenticated, async (req, res) => {
    res.status(201).render("jobs/view-jobs");
});

// --- VIEW JOB ---
app.get("/jobs/:job", ensureAuthenticated, async (req, res) => {
    const job = req.params.job;
    const data = Job.findBy({ jobTitle: data });

    try {
        res.status(201).render("jobs/view-job", { job: data });
    } catch (error) {
        res.status(404).send({ error: "No job exists." });
    }
});

// --- CREATE JOB ---
app.get("/jobs/post_job", ensureAuthenticated, async (req, res) => {
    try {
        res.status(201).render("jobs/add-job");
    } catch (error) {
        res.status(404).send({ error: "No create job exists." });
    }
});

app.post("/jobs", ensureAuthenticated, async (req, res) => {

});

// --- EDIT JOB ---
app.get("/jobs/:job", ensureAuthenticated, checkPoster, async (req, res) => {

})

app.patch("/jobs/", ensureAuthenticated, checkPoster, async (req, res) => {

});

// --- DELETE JOB ---
app.delete("/jobs/:job", ensureAuthenticated, checkPoster, async (req, res) => {

});

module.exports = app;