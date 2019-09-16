require('dotenv').config();

var mongoose = require ("mongoose");


var userSchema = new mongoose.Schema({
username : String,
password : String,

investments : [{
	name : String, 
	id : Number, 

	dateInvested : Date,
	pricePerItemInvested : Number,

	numInvested : Number,

	lastUpdated : Date,
	currentPricePerItem: Number

}]
});

var user = mongoose.model("user", userSchema);
module.exports = user;