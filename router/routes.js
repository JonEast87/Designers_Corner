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

// --- Authentication, Registration and Middleware Helpers --- //
const collectPortfolios = async (req, res) => {
    const users = await User.find();
    let portfolios = new Array();
    let i = 0;
    while (i < users.length) {
        if (users[i].portfolioExists === true) {
            portfolios.push(users[i].portfolio);
        }
        i++;
    }
    return portfolios;
}

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
        req.flash("error", "You are not the owner of this account.");
        res.status(403).redirect("/");
    }
}

const checkAuthor = async (req, res, next) => {
    // find post author
    const author = await User.findOne().where('portfolio.title').equals(req.params.portfolios);
    // find current user
    const currentUser = res.locals.currentUser;

    // check if current user is the author
    if (author._id.equals(currentUser._id)) {
        // permit if true
        next();
    } else {
        // deny if false
        req.flash("error", "You are not the author of this content.");
        res.status(403).redirect("/");
    }
}

const checkPoster = async (req, res, next) => {
    const job = req.params.job;
    const data = await Job.findOne({ jobTitle: job });
    const currentUser = res.locals.currentUser;

    if (data.jobPosterID.equals(currentUser._id)) {
        next();
    } else {
        req.flash("error", "You are not the job poster. Access restricted.");
        res.status(403).redirect("/jobs");
    }
}

// --- LIST PORTFOLIOS AND JOBS --- //

app.get("/", ensureAuthenticated, async(req, res, next) => {
    try {
        const portfolios = await collectPortfolios(req, res);
        const jobs = await Job.find();
        res.status(200).render("index", { portfolios: portfolios, jobs: jobs });
    } catch (error) {
        res.status(404).send({ error: "No portfolios." });
    }
});

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
        res.status(404).send({ error: "User does not exist." });
    }
});

// --- ADD PROFILE ---
app.get("/profiles/add_profile/:username", ensureAuthenticated, checkUser, async (req, res) => {
    const user = await User.findOne({ username: req.params.username });
    res.render("profiles/add-profile", { user: user });
});

app.post("/profiles/add_profile/:username", ensureAuthenticated, checkUser, async (req, res, next) => {
    let enteredSkills = req.body.skills.split(", ");
    let splicedSkills = enteredSkills.splice(0, 3);
    const newProfile = new Object({
        profileAuthor: res.locals.currentUser._id,
        bio: req.body.bio,
        profileImage: req.body.profileImage,
        purpose: req.body.purpose,
        skills: splicedSkills
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
   const user = await User.findOne({ username: req.params.username });
   res.status(200).render("profiles/edit-profile", { user: user });
});

app.patch("/profiles/edit_profile", ensureAuthenticated, async (req, res) => {
    let enteredSkills = req.body.skills.split(", ");
    let splicedSkills = enteredSkills.splice(0, 3);
    const updatedProfile = new Object({
        profileAuthor: res.locals.currentUser._id,
        bio: req.body.bio,
        profileImage: req.body.profileImage,
        purpose: req.body.purpose,
        skills: splicedSkills
    });

    try {
        const user = await User.findById(res.locals.currentUser._id);

        if (user.profileExists === true) {
            user.profile = updatedProfile;
            await user.save();
            req.flash("info", "Profile has been successfully updated.");
            res.status(201).redirect("/users/" + res.locals.currentUser.username);
        } else {
            res.render("/profiles/add_profile");
        }
    } catch (error) {
        res.status(404).send({ error: "Profile does not match." });
    }
});


// --- PORTFOLIOS --- //

// --- CREATE PORTFOLIO ---
app.get("/add", ensureAuthenticated, async (req, res) => {
    res.render("portfolios/add-portfolio");
});

app.post("/add", ensureAuthenticated, async (req, res, next) => {
    try {
        const user = await User.findById(res.locals.currentUser._id);
        const enteredTags = req.body.tags.split(", ");
        const splicedTags = enteredTags.splice(0, 3);

        if (user.portfolioExists === true) {
            req.flash("error", "Portfolio already exists, you can only have one portfolio at a time.");
            res.status(409);
            return res.redirect("/edit");
        } else {
            user.portfolio = {
                author: res.locals.currentUser.username,
                authorId: res.locals.currentUser._id,
                description: req.body.description,
                images: [req.body.image1, req.body.image2, req.body.image3],
                tags: splicedTags,
                title: req.body.title,
                url: req.body.live,
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
        const portfolioAuthor = await User.findOne().where('portfolio.title').equals(req.params.portfolio);
        await portfolioAuthor.populate("portfolio.comments");
        res.status(200).render("portfolios/view-portfolio", { portfolio: portfolioAuthor.portfolio, comments: portfolioAuthor.portfolio.comments });
    } catch (error) {
        res.status(404).send({ error: "Post does not match." });
    }
});

// --- UPDATE PORTFOLIO ---
app.get("/portfolios/:portfolios/edit", ensureAuthenticated, checkAuthor, async (req, res) => {
   const user = await User.findById(res.locals.currentUser._id);
    if (user.portfolioExists === false) {
        req.flash("error", "Portfolio does not exist. You have to create one first to edit it.");
        res.status(409);
        return res.redirect("/add");
    }

    try {
       const portfolio = user.portfolio;
       res.status(200).render("portfolios/edit-portfolio", { portfolio: portfolio });
   } catch(error) {
       res.status(404).send({ error: "Portfolio does not match." });
   }
});

app.patch("/portfolios/:portfolio/edit", ensureAuthenticated, async (req, res, next) => {
    try {
        const user = await User.findById(res.locals.currentUser._id);
        const enteredTags = req.body.tags.split(", ");
        const splicedTags = enteredTags.splice(0, 3);

        user.portfolio = {
            author: res.locals.currentUser.username,
            authorId: res.locals.currentUser._id,
            description: req.body.description,
            images: [req.body.image1, req.body.image2, req.body.image3],
            tags: splicedTags,
            title: req.body.title,
            url: req.body.live,
        };
        await user.save();
        req.flash("info", "Portfolio has been updated.");
        return res.status(201).redirect("/");
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
        const portfolioAuthor = await User.findOne().where('portfolio.title').equals(req.params.portfolio);
        portfolioAuthor.portfolio.comments.push(newComment);
        await portfolioAuthor.save();
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
        await Comment.findByIdAndDelete(req.params.comment);
        req.flash("info", "Comment successfully deleted.");
        res.status(200).redirect("/portfolios/" + req.params.portfolio);
    } catch (error) {
        res.status(404).send({ error: "No comment exists." });
    }
});


// --- JOBS --- //

// --- LIST JOBS ---

// --- CREATE JOB ---
app.get("/add_job", ensureAuthenticated, async (req, res) => {
    try {
        res.status(201).render("jobs/add-jobs");
    } catch (error) {
        res.status(404).send({ error: "No create job exists." });
    }
});

app.post("/add_job", ensureAuthenticated, async (req, res) => {
    const enteredSkills = req.body.skills.split(", ");
    const splicedSkills = enteredSkills.splice(0, 3);
    const newJob = new Job({
        companyName: req.body.name,
        jobDescription: req.body.description,
        jobPosterID: res.locals.currentUser._id,
        jobSkills: splicedSkills,
        jobTitle: req.body.title,
        projectTypes: req.body.tags,
    });

    try {
        req.flash("info", "You have successfully created an job posting.");
        await newJob.save();
        res.status(201).redirect("/");
    } catch (error) {
        res.status(404).send({ error: "Resource not found." });
    }
});

// --- READ JOB ---
app.get("/jobs/:job", ensureAuthenticated, async (req, res) => {
    const job = req.params.job;
    const data = await Job.findOne({ jobTitle: job });

    try {
        res.status(201).render("jobs/view-job", { job: data });
    } catch (error) {
        res.status(404).send({ error: "No job exists." });
    }
});

// --- UPDATE JOB ---
app.get("/jobs/:job/edit_job", ensureAuthenticated, checkPoster, async (req, res) => {
    try {
        const job = await Job.findOne({ jobTitle: req.params.job });
        res.status(200).render("jobs/edit-job", { job: job });
    } catch(error) {
        res.status(404).send({ error: "Cannot edit job." });
    }
});

app.patch("/jobs/:job/edit_job", ensureAuthenticated, checkPoster, async (req, res) => {
    let foundJob = await Job.findOne({ jobTitle: req.params.job });
    let foundJobID = foundJob._id;
    const enteredSkills = req.body.skills.split(", ");
    const splicedSkills = enteredSkills.splice(0, 3);
    const options = { new: true };

    try {
        const data = {
            companyName: req.body.name,
            jobDescription: req.body.description,
            jobPosterID: res.locals.currentUser_id,
            jobSkills: splicedSkills,
            jobTitle: req.body.title,
            projectTypes: req.body.tags
        }

        const updatedJob = await Job.findByIdAndUpdate(foundJobID, data, options);
        req.flash("info", "You have successfully edited your job posting.");
        res.status(201).redirect("/");
    } catch (error) {
        console.log(error);
        res.status(404).send({ error: "Resource not found." });
    }
});

// --- DELETE JOB ---
app.delete("/jobs/:job", ensureAuthenticated, checkPoster, async (req, res) => {

});


// --- APPLYING TO JOBS //
app.patch("/job/:job/applied", ensureAuthenticated, async (req, res) => {

    try {
        const foundJob = await Job.findOne({ jobTitle: req.params.job });
        const foundJobID = foundJob._id;
        const user = res.locals.currentUser;
        foundJob.peopleApplied.push(user);
    } catch (error) {
        console.log(error);
        res.status(404).send({ error: "Could not apply to this listing." });
    }
});
module.exports = app;