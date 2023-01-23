const mongoose = require("mongoose");
const { Schema } = mongoose;

const portfolioSchema = new Schema({
   author: { type: String, required: true },
   authorId: { type: mongoose.Schema.Types.ObjectId, required: true },
   createdAt: { type: Date, default: Date.now() },
   description: { type: String, required: true },
   headerImage: { type: String, required: true },
   contextImage: { type: String, required: false},
   contextImage2: { type: String, required: false },
   contextImage3: { type: String, required: false},
   title: { type: String, require: true },
   tags: [{ type: String, required: false }],
   url: { type: String, required: false }
});

const Portfolio = mongoose.model("Portfolio", portfolioSchema);
module.exports = Portfolio;