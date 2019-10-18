require('dotenv').config();

const mongoose   = require("mongoose");

const item = require("./initData/models/item.js");
const graphdata = require("./initData/models/graphdata.js");
const statdata = require("./initData/models/statdata.js");
const user = require("./initData/models/user.js");
const invalid = require("./initData/models/invalid.js");


//make items
const initItem = require("./initData/initItem.js"); //makes graphdata as well
const initStat = require("./initData/initStat.js") //separate because stat model can change often

//update item data
const initItemData = require("./initData/initItemData.js");
const initStatData = require("./initData/initStatData.js");
const initGraphData = require("./initData/initGraphData.js");

const checkItemData = require("./initData/checkItemData.js");

var getItemList = require ("./initData/itemList.js");


const port = process.env.PORT || 80;


//updateDatabase sets invalid flags for items no longer in the GE, and adds new ones
//however, it does NOT check if already invalid items have been reintroduced to the GE


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

//returns shallow copy array, to get around initGraphData and initItemData throwing away references to save memory
function cloneArray(arr)
{
	let cloneArr = [];
	for (let i = 0; i < arr.length; i ++)
	{
		cloneArr.push(arr[i]);
	}
	return cloneArr;
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

	let allitems = null;
	let newArr = null;

	let obsoleteItems = [];
	let newItems = [];

	await new Promise (function (resolve,reject)
	{
		getItemList(resolve, {id : true});
	}).then(function (GEItems)
	{
		newArr = GEItems;
	});

	//check for items that have been removed
	for (let i = 0; i < oldArr.length; i ++)
	{
		let oldItem = oldArr[i];
		if (newArr[oldItem.id] === undefined) //obsolete
		{
			obsoleteItems.push(oldItem);
		}
	}

	//check for items that have been added
	for (let itemid in newArr)
	{
		if (orderedArr[itemid] === undefined) //new
		{
			newItems.push(newArr[itemid]);
		}
	}

	//console.log(orderedArr);
	//console.log(newArr);
	//create new items
	console.log("found that " + newItems.length + " items have been added");
	console.log("found that " + obsoleteItems.length + " items have been removed");

	console.log(newItems);
	console.log(obsoleteItems);

	//clean up memory, only need newItems arr now
	newArr = null;
	oldArr = null;
	orderedArr = null;

	//set invalid flags for all obsolete items, and push them into invalid collection
	//if graphdata was requested for these obsolete items, then this is probably redundant, but whatever 
	for (let i = 0; i < obsoleteItems.length; i++)
	{
		await new Promise(function(resolve, reject)
		{
			invalid.findOne({name : obsoleteItems[i].name, id : obsoleteItems[i].id}, function (error, invalidItem)
			{
				if (error)
				{
					console.log("failed to find invalid document with id of " + obsoleteItems[i].id);
					process.exit();
				}
				else if (!invalidItem)
				{
					invalid.create({name : obsoleteItems[i].name, id : obsoleteItems[i].id}, function (error, invalidItem)
					{
						if (error)
						{
							console.log("failed to create invalid document with id of " + obsoleteItems[i].id);
							process.exit();
						}
						else
						{
							console.log("created invalid document with id of " + obsoleteItems[i].id);
						}
					});
				}
			});

			item.findOne({id: obsoleteItems[i].id}, function (error, foundItem)
			{
				if (error)
				{
					console.log("failed to find invalid document with id of " + obsoleteItems[i].id);
					process.exit();
				}
				else
				{
					foundItem.invalid = true;
					foundItem.save();
					console.log("set invalid flag for document with id of " + obsoleteItems[i].id);
					resolve();
				}
			});
		});
	}


	for (let i = 0; i < newItems.length; i ++)
	{
		var curItem = newItems[i];
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
						newItems[i] = newItem;
					}
					resolve();
				});
			}
			});
		});
	}


	//fill in all the items that osrsbox failed to fill
	await new Promise(function (resolve, reject)
	{
		checkItemData(resolve);
	});

	//get graphdata and all item pictures for the newitems
	await new Promise (async function(resolve, reject)
	{
		// pull all the images
		initItemData(0, cloneArray(newItems));
		// pull all the graph data
		initGraphData(0, cloneArray(newItems), resolve);
	}).catch(function (error) 
	{
		console.log("THIS SHOULDNT HAPPEN");
	});

	//make statdata
	await new Promise (async function (resolve, reject)
	{
		console.log("_____________________");
	console.log(newItems);
		for (let i = 0; i < newItems.length; i ++)
		{
			await new Promise (function (resolve, reject)
			{
				statdata.create({id : newItems[i].id, name : newItems[i].name}, function (err, newstat)
				{
					if (err)
					{
						console.log("failed to create document with id of " + newItems[i].id);
						process.exit();
					}
						else
					{
						newItems[i].statdata = newstat;
						newItems[i].save();
						console.log("succesfully created document with id of " + newItems[i].id);
						resolve();
					}
				});
			});
		}
		resolve();
		console.log("_____________________");
	console.log(newItems);
	});

	console.log("_____________________");
	console.log(newItems);

	//process.exit();
	//then update statdata
	await new Promise(function (resolve, reject)
	{
		initStatData(newItems, resolve);
	});


	if (typeof callback === "function")
	{
		callback();
	}
}

module.exports = updateDataBase;




