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
const initScore = require("./initData/initScore.js")

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
	let allitems = [];
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

	console.log("new items:");
	newItems.forEach(function(item){console.log(item.name)});

	console.log("obsolete items:");
	obsoleteItems.forEach(function(item){console.log(item.name)});

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

	//try to find the new item in database, if we do, set invalid flag to false, otherwise, make the new item, along with the stat and graph documents
	for (let i = 0; i < newItems.length; i ++)
	{
		var curItem = newItems[i];
		await new Promise (function (resolve, reject)
		{
			item.findOne({id : newItems[i].id}, function(err, foundItem)
			{
				if (err)
				{
					console.log("failed to find document (database error)");
					process.exit();
				}
				else if (!foundItem)
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
							graphdata.create({id : curItem.id, name : curItem.name}, function (err, newGraphData)
							{
								if (err)
								{
									console.log("failed to create graphdata for id of " + curItem.id);
									process.exit();
								}
								else
								{
									console.log("succesfully created new graph document with id of " + curItem.id);
									newItem.graphdata = newGraphData;
									//make statdata
									statdata.create({id : curItem.id, name : curItem.name}, function (err, newstat)
									{
										if (err)
										{
											console.log("failed to create document with id of " + newItems[i].id);
											process.exit();
										}
										else
										{
											newItem.statdata = newstat;
											newItem.save();
											
											newItems[i] = newItem;
											console.log("succesfully created new stat document with id of " + newItems[i].id);
											resolve();
										}
									});
								}
							});
						}
					});
				}
				else
				{
					foundItem.invalid = false;
					foundItem.save();
					resolve();
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

//goes through entire database, and fetches graphdata for each
async function refreshDatabase(callback)
{
	var allitems = null;
	await new Promise(function (resolve, reject)
	{
		fetchAllDocuments(resolve, {invalid : false});
	}).then(function(alldocs){allitems = alldocs;});

	for (let i = 0; i < allitems.length; i ++)
	{
		setTimeout(async function()
		{
			console.log("updating item at index " +  i + "...")
			await new Promise (function (resolve ,reject)
			{
				initGraphData(0, [allitems[i]], resolve);
			});
			initStatData([allitems[i]]);
			allitems[i] = null;
		}, i * 25000);
	}

	await new Promise(function (resolve, reject)
	{
		setTimeout(() => resolve(), 25000 * allitems.length);
	});	
	await new Promise(function (resolve, reject)
	{
		initScore(resolve);
	});	

	if (typeof callback === "function")
	{
		callback();
	}	
}

async function update(oldArr, orderedArr, callback, appUpdating)
{
	appUpdating.updating = true;

	await new Promise(function (resolve, reject)
	{
		updateDataBase(oldArr, orderedArr, resolve);
	});
	oldArr = null
	orderedArr = null;

	appUpdating.updating = false;
	await new Promise(function (resolve, reject)
	{
		refreshDatabase(resolve);
	});
	if (typeof callback === "function")
	{
		callback();
	}
}

module.exports = update;




