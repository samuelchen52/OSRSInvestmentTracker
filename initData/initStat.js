require('dotenv').config();

//populates the mongodb database

var itemList = require ("./itemList.js");
var item = require("./models/item.js");
var graphdata = require("./models/graphdata.js");
var statdata = require("./models/statdata.js");

var mongoose = require("mongoose");
mongoose.connect(process.env.MONGODB_URI ||'mongodb://localhost:27017/getracker', {useNewUrlParser: true});

//populate database with item ids and then do a find(), which will return an array of all the items, which we then iterate over (get the item ids)
//and then do two requests for each item to populate them with data, more modular and less error prone
async function populate(callback)
{

	item.find({}, async function (err, allitems)
	{
		if (err)
		{
			console.log("couldnt fetch all documents!");
			process.exit();
		}
		else
		{
			for (var i = 0; i < allitems.length; i ++)
			{
				await new Promise (function (resolve, reject)
				{
					statdata.create({id : allitems[i].id, name : allitems[i].name}, function (err, newstat)
					{
						if (err)
						{
							console.log("failed to create document with id of " + allitems[i].id);
							process.exit();
						}
						else
						{
							allitems[i].statdata = newstat;
							allitems[i].save();
							console.log("succesfully created document with id of " + allitems[i].id);
							resolve();
						}
					});
				});
			}
		}
	});
	
	if (typeof callback === "function")
	{
		callback();
	}
};

module.exports = populate;
//console.log(itemids.length); //3011 documents
