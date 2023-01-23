const mongoose = require("mongoose");
const { Schema } = mongoose;

const commentSchema = new Schema({
    author: { type: String, required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, required: true },
    portfolio: { type: String, required: true },
    comment: { type: String, required: true }
});

const Comment = mongoose.model("Comment", commentSchema);
module.exports = Comment;