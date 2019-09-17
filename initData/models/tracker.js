require('dotenv').config();

var mongoose = require ("mongoose");

var trackerSchema = new mongoose.Schema({
name : String,
value : Number
});

var tracker = mongoose.model("tracker", trackerSchema);
module.exports = tracker;