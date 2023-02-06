const mongoose = require("mongoose");
const bcrypt = require("bcrypt-nodejs");

// Import commentSchema, jobSchema and portfolioSchema to include inside the User model's portfolio array
// for easier access
const { jobSchema } = require("./jobs");
const { portfolioSchema } = require("./portfolio");
const { Schema } = mongoose;
const SALT_FACTOR = 10;
const noop = () => {};

// Declaring the profile with the User model now
const profileSchema = new Schema({
    bio: { type: String },
    createdAt: { type: Date, default: Date.now() },
    profileAuthor: { type: mongoose.Schema.Types.ObjectId, required: true },
    profileImage: { type: String, required: false },
    purpose: { type: String },
    skills: { type: String }
});

const userSchema = new Schema({
    createdAt: { type: Date, default: Date.now() },
    friendsList: [ { name: { type: String, required: false } }],
    // Integrating the job model the user model
    // jobs: [jobSchema],
    // portfolios: [portfolioSchema],
    password: { type: String, required: true },
    phoneNumber: { type: Number, required: true },
    // Integrating the profile model into the user model
    profile: profileSchema,
    profileExists: { type: Boolean, required: true, default: false },
    username: { type: String, required: true, unique: true }
});

userSchema.methods.name = function() {
    return this.username;
};

userSchema.pre("save", function(done) {
    const user = this;
    if (!user.isModified("password")) return done();
    bcrypt.genSalt(SALT_FACTOR, function(err, salt) {
        if (err) return done(err);
        bcrypt.hash(user.password, salt, noop, function(err, hashedPassword) {
            if (err) return done(err);
            user.password = hashedPassword;
            done();
        });
    });
});

userSchema.methods.checkPassword = function(guess, done) {
    bcrypt.compare(guess, this.password, function(err, isMatch) {
        done(err, isMatch);
    });
};

const User = mongoose.model("User", userSchema);
module.exports = User;