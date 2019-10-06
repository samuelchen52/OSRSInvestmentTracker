require('dotenv').config();

var mongoose = require ("mongoose");


var itemSchema = new mongoose.Schema({

lastUpdated : Date,

id: Number,
name : String,
wikiName : String,

name_lower : String, //spaces replaced with hyphens, and letters are lowercased

description : String,
members: Boolean,

limit: Number,

iconFetched : Boolean,

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