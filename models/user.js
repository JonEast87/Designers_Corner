const mongoose = require("mongoose");
const bcrypt = require("bcrypt-nodejs");

const { Schema } = mongoose;
const SALT_FACTOR = 10;
const noop = () => {};

const userSchema = new Schema({
    createdAt: { type: Date, default: Date.now() },
    friendsList: [ { name: { type: String, required: false } }],
    password: { type: String, required: true },
    phoneNumber: { type: Number, required: true },
    profile: { type: mongoose.Schema.Types.ObjectId, required: false },
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