require('dotenv').config();

//populates the mongodb database

var getItemList = require ("./itemList.js");
var item = require("./models/item.js");
var graphdata = require("./models/graphdata.js");

var mongoose = require("mongoose");
mongoose.connect(process.env.MONGODB_URI ||'mongodb://localhost:27017/getracker', {useNewUrlParser: true});

//populate database with item ids and then do a find(), which will return an array of all the items, which we then iterate over (get the item ids)
//and then do two requests for each item to populate them with data, more modular and less error prone
async function populate(callback)
{
	var itemList;
	await new Promise (function (resolve,reject)
	{
		getItemList(resolve);
	}).then(function (GEItems)
	{
		itemList = GEItems;
	});

	for (let itemid in itemList)
	{
		var curItem = itemList[itemid];
		await new Promise (function (resolve, reject)
		{
			let tempObj = 
			{
				id : curItem.id,
				name : curItem.name,
				name_lower : curItem.name.split(" ").join("_").toLowerCase(),
				limit : curItem.buy_limit,
				wikiName : curItem.wiki_name,
				description : curItem.examine,
				members : curItem.members,
				iconFetched : false,
				invalid : false
			}
			item.create(tempObj, function(err, newItem){
			if (err)
			{
				console.log("failed to create document with id of " + curItem.id);
				process.exit();
			}
			else
			{
				console.log("succesfully created document with id of " + curItem.id);
				graphdata.create({id : curItem.id, name : curItem.name}, function (err, newGraphData)
				{
					if (err)
					{
						console.log("failed to create graphdata for id of " + curItem.id);
						process.exit();
					}
					else
					{
						newItem.graphdata = newGraphData;
						newItem.save();
					}
					resolve();
				});
			}
			});
		});
	}
	if (typeof callback === "function")
	{
		callback();
	}
	console.log("finished adding " + Object.keys(itemList).length + " items!!");
	itemList = null;
	
	
};

module.exports = populate;

