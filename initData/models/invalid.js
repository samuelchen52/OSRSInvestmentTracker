require('dotenv').config();

var mongoose = require ("mongoose");


var invalidSchema = new mongoose.Schema({

name : String,
id : Number

});

var invalid = mongoose.model("Invalid", invalidSchema);
module.exports = invalid;