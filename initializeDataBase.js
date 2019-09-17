require('dotenv').config();

const express    = require("express");
const bodyparser = require("body-parser");
const mongoose   = require("mongoose");
const session = require('client-sessions');

const item = require("./initData/models/item.js");
const graphdata = require("./initData/models/graphdata.js");
const statdata = require("./initData/models/statdata.js");
const user = require("./initData/models/user.js");

const tracker = require("./initData/models/tracker.js");

//make items
const initItem = require("./initData/initItem.js"); //makes graphdata as well
const initStat = require("./initData/initStat.js") //separate because stat model can change often

//update item data
const initItemData = require("./initData/initItemData.js");
const initStatData = require("./initData/initStatData.js");
const initGraphData = require("./initData/initGraphData.js");

const port = process.env.PORT || 80;
const numItems = 3506; 

var allitems = null;
var allitemsOrdered = null;


mongoose.connect(process.env.MONGODB_URI ||'mongodb://localhost:27017/getracker', {useNewUrlParser: true});

//fetches all docs and assigns it to allitems
//callback in this case is resolve function from promise, cause app has to wait until all items are fetched before starting
async function fetchAllDocuments(callback)
{
	//allitems will be the array being sorted that is 
	allitems = [];
	allitemsOrdered = {};
	await new Promise (function (resolve, reject)
	{
		item.find({}, async function(err, alldocs) {
		if (err)
		{
			res.send("there was an error fetching all the documents!");
			process.exit();
		}
		else
		{
			for (var i = 0; i < alldocs.length; i ++)
			{

				allitemsOrdered[alldocs[i].id] = alldocs[i];
				allitemsOrdered[alldocs[i].id].index = i; 
				//userLastUpdated is last day that user reqeuested an update, if the day is the same, its not going to bother requesting
				//allitemsOrdered[alldocs[i].id].userLastUpdated = alldocs[i].lastUpdated;
				await new Promise( function(resolve, reject)
				{
					item.populate(alldocs[i], [{path: "statdata"}], function (err, populatedDoc)
					{
						if (err)
						{
							console.log(err);
							process.exit();
						}
						resolve();
					});
				});
			}
			allitems = alldocs;
			resolve();
		}
		});
	});
	callback(allitems);
}


//_________________________________________________________________________________________________________________________________________________________________
//_________________________________________________________________________________________________________________________________________________________________
//_________________________________________________________________________________________________________________________________________________________________

async function initDatabase ()
{
	await new Promise(function (resolve, reject)
	{
		//passes the promise object all the documents i.e. passes alldocs to the resolve function
		fetchAllDocuments(resolve);
	}).then(function(alldocs){allitems = alldocs;});
	
	//initialize all items in the database
	if (allitems.length === 0)
	{
		await new Promise (function(resolve, reject)
		{
			console.log("making items....");
			initItem(resolve);
		});
		await new Promise (function(resolve, reject)
		{
			console.log("making stats....");
			initStat(resolve);
		});

		//wait for graph and item data to be populated, itemdata should take longer than graphdata
		//so shouldnt need to wait for graph data to catch up
		var numgraphdata = 0;
		while(numgraphdata !== numItems)
		{
			graphdata.find({}, function(err, allgraphdata)
			{
				if (err)
				{
					console.log(err);
					process.exit();
				}
				else
				{
					numgraphdata = allgraphdata.length;
				}
			});
			console.log("still fetching graph data");
			await new Promise (function (resolve, reject)
			{
				setTimeout(function(){resolve();}, 60000 * 5);
			});
		}
		console.log("calculating stat data");
		await new Promise (function(resolve, reject)
		{
			initStatData(resolve);
		});
	}
	process.exit();

}

module.exports = initDatabase;




