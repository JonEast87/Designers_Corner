const mongoose = require("mongoose");

mongoose.set("strictQuery", true);
const dbConnect = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
       useUnifiedTopology: true,
      useNewUrlParser: true,
    });
    console.log("Connected to database.")
  } catch (error) {
    console.log(`Error ${error.message}.`)
  }
}

module.exports = dbConnect