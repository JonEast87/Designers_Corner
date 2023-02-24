const mongoose = require("mongoose");

const { Schema } = mongoose;

const jobSchema = new Schema({
    createdAt: { type: Date, default: Date.now() },
    companyRating: { type: Number, required: false },
    companyName: { type: String, required: true },
    peopleApplied: [{ type: mongoose.Schema.Types.ObjectId, required: false }],
    jobDescription: { type: String, required: true },
    jobSkills: [{ type: String, required: true }],
    jobTitle: { type: String, required: true },
    jobPosterID: { type: mongoose.Schema.Types.ObjectId, require: false },
    projectTypes: [{ type: String, required: true }],
});

const Job = mongoose.model("Job", jobSchema);
module.exports = Job;