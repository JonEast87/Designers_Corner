const mongoose = require("mongoose");

const { Schema } = mongoose;

const profileSchema = new Schema({
    bio: { type: String },
    createdAt: { type: Date, default: Date.now() },
    profileAuthor: { type: mongoose.Schema.Types.ObjectId, required: true },
    profileImage: { type: String, required: false },
    purpose: { type: String },
    skills: { type: String }
});

const Profile = mongoose.model("Profile", profileSchema);
module.exports = Profile;