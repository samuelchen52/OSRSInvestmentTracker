require('dotenv').config();

const mongoose   = require("mongoose");


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

const checkItemData = require("./initData/checkItemData.js");
const updateDataBase = require("./updateDataBase.js");

const port = process.env.PORT || 80;




mongoose.connect(process.env.MONGODB_URI ||'mongodb://localhost:27017/getracker', {useNewUrlParser: true});

//fetches all docs and assigns it to allitems
//callback in this case is resolve function from promise, cause app has to wait until all items are fetched before starting
async function fetchAllDocuments(callback, criteria)
{
	//allitems will be the array being sorted that is 
	var allitems = [];
	criteria = criteria ? criteria : {};
	await new Promise (function (resolve, reject)
	{
		item.find(criteria, async function(err, alldocs) {
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
	var graphDataUpdated = false;

	for (var i = 0; i < allitems.length; i ++)
	{
		if ((allitems[i].lastUpdated === undefined) && (!allitems[i].invalid))
		{
			graphDataUpdated = true;
			arrItemsGraphDataNeeded.push(allitems[i]);
		}
	}

	//fetch all documents AGAIN, just so we can pass different references to the two arrays with items to update
	await new Promise(function (resolve, reject)
	{
		fetchAllDocuments(resolve);
	}).then(function(alldocs){allitems = alldocs;});

	for (var i = 0; i < allitems.length; i ++)
	{
		if (!allitems[i].iconFetched)
		{
			arrItemsItemDataNeeded.push(allitems[i]);
		}
	}

	console.log("there are " + arrItemsItemDataNeeded.length + " documents that need to have item icons fetched");
	console.log("there are " + arrItemsGraphDataNeeded.length + " documents that need to have graph data updated");

	await new Promise (async function(resolve, reject)
	{
		// pull all the images
		initItemData(0, arrItemsItemDataNeeded);
		// throw away all references, so garbage collector can clean up
		console.log("cleaning up memory for itemdata...");
		arrItemsItemDataNeeded = null;
		allitems = null;
	}).catch(function (error) 
	{
		console.log("THIS SHOULDNT HAPPEN");
	});

	await new Promise (async function(resolve, reject)
	{
		initGraphData(0, arrItemsGraphDataNeeded, resolve);
		//throw away all references, so garbage collector can clean up
		console.log("cleaning up memory for graphdata...");
		arrItemsGraphDataNeeded = null;
	}).catch(function (error) 
	{
		console.log("THIS SHOULDNT HAPPEN");
	});

	//fill in all the items that osrsbox failed to fill
	await new Promise(function (resolve, reject)
	{
		checkItemData(resolve);
	});

	//get all items again, since initdata functions will wipe the array for the garbage collector
	//then calculate stats
	if (graphDataUpdated)
	{
		await new Promise(function (resolve, reject)
		{
			fetchAllDocuments(resolve, {invalid : false});
		}).then(function(alldocs){allitems = alldocs;});
		await new Promise(function (resolve, reject)
		{
			initStatData(allitems, resolve);
		});
	}
	
	if (typeof callback === "function")
	{
		callback();
	}

}

module.exports = initDatabase;




