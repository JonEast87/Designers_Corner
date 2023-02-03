const express = require("express");
const dotenv = require('dotenv').config();
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const flash = require("connect-flash");
const methodOverride = require("method-override");
const mongoose = require("./config/db.js");
const MongoStore = require("connect-mongo");
const path = require("path");
const passport = require("passport");
const session = require("express-session");


const app = express();
const routes = require("./router/routes");
const setUpPassport = require("./config/setuppassport");
// const publicPath = path.resolve(__dirname, "public");

// setUpPassport handles serializing and deserializing user sessions
setUpPassport();
mongoose();

// Establishing EJS as the default rendering engine for the Express application
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// Standard Express setup
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(express.static('public/css'));
app.use(express.static('public/javascript'));
app.use(cookieParser());
app.use(session({
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: false,
}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride("_method"));
app.use(routes);

module.exports = app;