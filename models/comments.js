const mongoose = require("mongoose");
const { Schema } = mongoose;

const commentSchema = new Schema({
    author: { type: String, required: true },
    authorID: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    comment: { type: String, required: true }
});

module.exports = mongoose.model('Comment', commentSchema);