require('dotenv').config();

const express    = require("express");
const bodyparser = require("body-parser");
const mongoose   = require("mongoose");
const session = require('client-sessions');

const item = require("./initData/models/item.js");
const graphdata = require("./initData/models/graphdata.js");
const statdata = require("./initData/models/statdata.js");
const user = require("./initData/models/user.js");


//make items
const initItem = require("./initData/initItem.js"); //makes graphdata as well
const initStat = require("./initData/initStat.js") //separate because stat model can change often

//update item data
const initItemData = require("./initData/initItemData.js");
const initStatData = require("./initData/initStatData.js");
const initGraphData = require("./initData/initGraphData.js");

const port = process.env.PORT || 80;
const numItems = 3506; 




mongoose.connect(process.env.MONGODB_URI ||'mongodb://localhost:27017/getracker', {useNewUrlParser: true});

//fetches all docs and assigns it to allitems
//callback in this case is resolve function from promise, cause app has to wait until all items are fetched before starting
async function fetchAllDocuments(callback)
{
	//allitems will be the array being sorted that is 
	allitems = [];
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

async function initDatabase (callback)
{
	var allitems = null;
	await new Promise(function (resolve, reject)
	{
		//passes the promise object all the documents i.e. passes alldocs to the resolve function
		fetchAllDocuments(resolve);
	}).then(function(alldocs){allitems = alldocs;});
	
	//initialize all items in the database, if they havent been initialized
	if (allitems.length === 0)
	{
		await new Promise (function(resolve, reject)
		{
			console.log("making items....");
			initItem(resolve);
		}).catch(function (error) 
		{
			console.log("THIS SHOULDNT HAPPEN");
		});
		await new Promise (function(resolve, reject)
		{
			console.log("making stats....");
			initStat(resolve);
		}).catch(function (error) 
		{
			console.log("THIS SHOULDNT HAPPEN");
		});;
		await new Promise(function (resolve, reject)
		{
			//passes the promise object all the documents i.e. passes alldocs to the resolve function
			fetchAllDocuments(resolve);
		}).then(function(alldocs){allitems = alldocs;});
	}

	// check if all items have had their graph / item data fetched, if not, then fetch it
	var arrItemsGraphDataNeeded = [];
	var arrItemsItemDataNeeded = [];
	for (var i = 0; i < allitems.length; i ++)
	{
		if (allitems[i].lastUpdated === undefined)
		{
			arrItemsGraphDataNeeded.push(allitems[i]);
		}
		if (allitems[i].description === undefined)
		{
			arrItemsItemDataNeeded.push(allitems[i]);
		}
	}
	console.log("there are " + arrItemsItemDataNeeded.length + " documents that need to have item data fetched");
	console.log("there are " + arrItemsGraphDataNeeded.length + " documents that need to have graph data updated");

	// populate the rest of the data
	initItemData(0, arrItemsItemDataNeeded);
	await new Promise (function(resolve, reject)
	{
		initGraphData(0, arrItemsGraphDataNeeded, resolve);
		//throw away all references, so garbage collector can clean up
		arrItemsGraphDataNeeded = null;
		arrItemsItemDataNeeded = null;
		allitems = null;
	}).catch(function (error) 
	{
		console.log("THIS SHOULDNT HAPPEN");
	});

	//get all items again, since initdata functions will wipe the array for the garbage collector
	//then calculate stats
	await new Promise(function (resolve, reject)
	{
		//passes the promise object all the documents i.e. passes alldocs to the resolve function
		fetchAllDocuments(resolve);
	}).then(function(alldocs){allitems = alldocs;});
	initStatData(allitems);

	//grab allitems AGAIN, to get rid of statdata references, just to save some space
	await new Promise(function (resolve, reject)
	{
		//passes the promise object all the documents i.e. passes alldocs to the resolve function
		fetchAllDocuments(resolve);
	}).then(function(alldocs){allitems = alldocs;});
	
	if (typeof callback === "function")
	{
		callback();
	}
	//continually update graphdata throughout the life time of the applictaion

	while(true)
	{
		for (let i = 0; i < numItems; i ++)
		{
			setTimeout(() => initGraphData(0, [allitems[i]]), i * 25000);
		}
		await new Promise(function (resolve, reject)
		{
			setTimeout(() => resolve(), 24 * 60 * 60 * 1000);
		});
	}
		

}

module.exports = initDatabase;




