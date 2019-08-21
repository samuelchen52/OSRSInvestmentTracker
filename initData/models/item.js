var mongoose = require ("mongoose");


var itemSchema = new mongoose.Schema({

lastUpdated : Date,

icon : String,
icon_large : String,
id: Number,
type: String,
typeIcon : String,
name : String,

name_lower : String, //spaces replaced with hyphens, and letters are lowercased

description : String,
members: Boolean,

limit: Number,

graphdata: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "graphdata"
	},

statdata: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "statdata"
	}

});

var item = mongoose.model("Item", itemSchema);
module.exports = item;