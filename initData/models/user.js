var mongoose = require ("mongoose");


var userSchema = new mongoose.Schema({
username : String,
password : String,

investments : [
{
	itemname : String, 
	itemid : Number, 

	dateInvested : Date,
	numInvested : Number,
	priceInvested : Number
}
]
});

var user = mongoose.model("user", userSchema);
module.exports = user;