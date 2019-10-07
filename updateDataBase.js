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


var getItemList = require ("./itemList.js");

const checkItemData = require("./initData/checkItemData");

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

//oldarr is the current array of allitems
//newarr is the up to date (fresh) item list pulled from osrsbox, items are indexed by id
//ordered arr is the array of allitems, indexed by id
async function updateDataBase (oldArr, orderedArr, callback)
{
	console.log("updating database...");

	let newArr = null;
	let obsoleteItems = [];
	let newItems = [];

	await new Promise (function (resolve,reject)
	{
		getItemList(resolve);
	}).then(function (GEItems)
	{
		newArr = GEItems;
	});

	for (var i = 0; i < oldArr.length; i ++)
	{
		let oldItem = oldArr[i];
		if (!newArr[oldItem.id]) //obsolete
		{
			obsoleteItems.push(oldItem);
		}
	}

	for (var i = 0; i < newArr.length; i ++)
	{
		let newItem = newArr[i];
		if (!orderedArr[newItem.id]) //new
		{
			newItems.push(newItem);
		}
	}

	



	if (typeof callback === "function")
	{
		callback();
	}
}

module.exports = updateDataBase;




