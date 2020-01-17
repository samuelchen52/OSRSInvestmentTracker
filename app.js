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

const initDataBase = require("./initializeDataBase.js");
const updateDataBase = require("./updateDataBase.js");


const port = process.env.PORT || 80;
const numItems = 3506; 

var app = express(); 
var allitems = null;
var allitemsOrdered = null;

var appUpdating = {updating : true};

app.use(bodyparser.urlencoded({extended: true}));
app.use(express.static(__dirname + "/public"));
app.use(session({
  cookieName: 'session',
  secret: 'randomstringisrandom',
  duration: 180 * 60 * 1000,
  activeDuration: 5 * 60 * 1000,
  httpOnly: true,
  secure: true,
  ephemeral: true
}));

//checks if user is logged in, if not, res.locals.user will be null
app.use(function(req, res, next) {
	if (appUpdating.updating)
	{
		res.locals.user = null;
		res.render("update.ejs");
	}
	else
	{
		if (req.session && req.session.user)
		{
			user.findOne({username : req.session.user.username}, function (err, foundUser)
			{
				//should always be able to find user, because they are validated before cookie is sent
				if (err || !foundUser)
				{
					res.locals.user = null;
					req.session.reset();
				}
				else
				{
					res.locals.user = foundUser;
					var investments = foundUser.investments;
					for (var i = 0; i < investments.length; i ++)
					{
						let investment = investments[i];
						//this should ALWAYS be true, generally server will validate data before storing it
						if (allitemsOrdered[investment.id])
						{
							if (investment.lastUpdated.toDateString() !== allitemsOrdered[investment.id].lastUpdated.toDateString())
							{
								investment.lastUpdated = allitemsOrdered[investment.id].lastUpdated;
								investment.currentPricePerItem = allitemsOrdered[investment.id].statdata.currentPrice.price;
								foundUser.save();
							}
						}
					}
				}
				next();
			});
		}
		else
		{
			res.locals.user = null;
			next();
		}
	}	
});

mongoose.connect(process.env.MONGODB_URI ||'mongodb://localhost:27017/getracker', {useNewUrlParser: true});

//todo
//will need to update allitems periodically, just fetch the documents from database every so often
//new idea - load array of docs, iterate and update each one 
//use same array for sorting, simply allocate another array, and copy over all references that make it past the filter
//faster than fetching every time
//make graph more readable
//statdata volatility
//make sure to handle spam requests for updates
//looks like app update is a day behind
//userinvestments after update should be checked

//ugly bug, items with the same name that arent screened out by the retrieving the graph data from the wiki
//wont become invalid. as a result when retrieving the data for an item from the results / sorted screen for duplicate item names
//only the data for ONE item will be retrieved (because we assum that the items in the db are unique by name) for all the duplicate items

//_________________________________________________________________________________________________________________________________________________________________
//_________________________________________________________________________________________________________________________________________________________________
//_________________________________________________________________________________________________________________________________________________________________

//colors for the progress bars
var colors = 
{
	price : "#ebe34b",
	volume : "#81adb5"
}
//these functions dont sort, they are used IN the sorting
var sortFunctions = {
		//sort by id, in ascending order (will be the tiebreaker, since ids are unique)
		sortByNone : function(typeSort)
		{
			if (typeSort === "weightedSort")
			{
				return function (item1, item2)
				{
					return {score1 : 0, score2 : 0};
				}
			}
			else
			{
				return function (item1, item2) 
				{
					return item1.id > item2.id ? -1 : 1;
				}
			}
		},
		//sort by current volume
		sortByVolume : function(typeSort, weight)
		{
			if (typeSort)
			{
				if (typeSort === "weightedSort")
				{
					return function (item) 
					{
						if (item)
						{
							return item.statdata.currentVolume.score * weight;
						}
						else
						{
							return colors["volume"];
						}
					}
				}
				else if (typeSort === "roundedSort")
				{
					return function (item1, item2)
					{
						var item1volume = item1.statdata.currentVolume.volume;
						var item2volume = item2.statdata.currentVolume.volume;
						return item1volume.toString().length === item2volume.toString().length  
						? 0 : (item1volume.toString().length  > item2volume.toString().length  ? 1 : -1);
					}
				}
			}
			else
			{
				return function (item1, item2) 
				{
					var item1volume = item1.statdata.currentVolume.volume;
					var item2volume = item2.statdata.currentVolume.volume;
					return item1volume === item2volume ? 0 : (item1volume > item2volume ? 1 : -1);
				}
			}
		},
		//sort by current price
		sortByPrice : function(typeSort, weight)
		{
			if (typeSort)
			{
				if (typeSort === "weightedSort")
				{
					return function (item)
					{
						if (item)
						{
							return item.statdata.currentPrice.score * weight;
						}
						else
						{
							return colors["price"];
						}
					}
				}
				else if (typeSort === "roundedSort")
				{
					return function (item1, item2)
					{
						var item1price = item1.statdata.currentPrice.price;
						var item2price = item2.statdata.currentPrice.price;
						return item1price.toString().length === item2price.toString().length 
						? 0 : (item1price.toString().length > item2price.toString().length ? 1 : -1);
					}
				}
			}
			else
			{
				return function (item1, item2) 
				{
					var item1price = item1.statdata.currentPrice.price;
					var item2price = item2.statdata.currentPrice.price;
					return item1price === item2price ? 0 : (item1price > item2price ? 1 : -1);
				}
			}
		}
	};

var filterFunctions = {

	filterByNonMember : function(item)
	{
		return !item.members;
	},
	filterByPositiveTrend : function(item)
	{
		return item.statdata.currentTrend === 'positive';
	},
	filterByNegativeTrend : function(item)
	{
		return item.statdata.currentTrend === 'negative';
	},
	filterByNeutralTrend : function(item)
	{
		return item.statdata.currentTrend === 'neutral';
	},
	filterByPriceLowerBound : function(priceLowerBound)
	{
		return function (item) 
		{
			return item.statdata.currentPrice.price >= priceLowerBound;
		}
	},
	filterByPriceUpperBound : function(priceUpperBound)
	{
		return function (item) 
		{
			return item.statdata.currentPrice.price <= priceUpperBound;
		}
	},
	filterByVolumeLowerBound : function(volumeLowerBound)
	{
		return function (item) 
		{
			return item.statdata.currentVolume.volume >= volumeLowerBound;
		}
	},
	filterByVolumeUpperBound : function(volumeUpperBound)
	{
		return function (item) 
		{
			return item.statdata.currentVolume.volume <= volumeUpperBound;
		}
	},
	filterByItemLimitUpperBound : function(itemLimitUpperBound)
	{
		return function (item) 
		{
			return item.limit <= itemLimitUpperBound;
		}
	},
	filterByItemLimitLowerBound : function(itemLimitLowerBound)
	{
		return function (item) 
		{
			return item.limit >= itemLimitLowerBound;
		}
	},
	filterByPosition : function(position)
	{
		return function(item, index)
		{
			return index <= position;
		}
	}


}

//worst case happens when sorting an already sorted list, in which case the pivot picked is already sorted
//added randomized pivot
function quicksort (arr, start, end, sortby)
{
	if (start < end)
	{
		//pick a index, swap with pivot
		var randomIndex = Math.floor((Math.random() * (end - start - 1)) + start);
		var temp = arr[randomIndex];
		arr[randomIndex] = arr[end];
		arr[end] = temp;

		var partition = arr[end];
		var low = start - 1;
		var pointer = start;

		var sortFunctionIndex = 0; //keeps track of which function to use when comparing objects
		var result = 0;

		//put everything higher than partition on the left
		while (pointer < end)
		{
			result = 0;
			sortFunctionIndex = 0;
			while (result === 0)
			{
				result = sortby[sortFunctionIndex](arr[pointer], partition);
				sortFunctionIndex ++;
			}
			if (result === 1)
			{
				low ++;
				temp = arr[low];
				arr[low] = arr[pointer];
				arr[pointer] = temp;
			}
			pointer ++;
		}

		//swap partition 
		var temp = arr[low + 1];
		arr[low + 1] = arr[end];
		arr[end] = temp;

		quicksort(arr, start, low, sortby);
		quicksort(arr, low + 2, end, sortby);

	}
}
//docArr is the  array with all the documents, filterArr is the array of functions that each document will be passed through to filter it
function filter(docArr, filterArr)
{
	var ret = new Array(docArr.length);
	var retIndex = 0;

	var passedFilter = true;

	for (var i = 0; i < docArr.length; i ++)
	{
		for (var p = 0; p < filterArr.length; p++)
		{
			if (!filterArr[p](docArr[i], i))
			{
				passedFilter = false;
				break;
			}
		}

		if (passedFilter)
		{
			ret[retIndex] = docArr[i];
			retIndex ++;
		}
		passedFilter = true;
	}

	return ret.slice(0, retIndex);
}

function populateFilterArr(req, filterby)
{
	if (req.query.filterByNonMember)
	{
		filterby.push(filterFunctions.filterByNonMember);
	}
	if (req.query.filterByTrend)
	{
		if (filterFunctions[req.query.trendType] !== undefined)
		{
			filterby.push(filterFunctions[req.query.trendType]);
		}
	}
	if (req.query.filterByPriceLowerBound)
	{
		if (parseInt(req.query.priceLowerBound))
		{
			filterby.push(filterFunctions["filterByPriceLowerBound"](parseInt(req.query.priceLowerBound)));
		}
	}
	if (req.query.filterByPriceUpperBound)
	{
		if (parseInt(req.query.priceUpperBound))
		{
			filterby.push(filterFunctions["filterByPriceUpperBound"](parseInt(req.query.priceUpperBound)));
		}
	}
	if (req.query.filterByVolumeLowerBound)
	{
		if (parseInt(req.query.volumeLowerBound))
		{
			filterby.push(filterFunctions["filterByVolumeLowerBound"](parseInt(req.query.volumeLowerBound)));
		}
	}
	if (req.query.filterByVolumeUpperBound)
	{
		if (parseInt(req.query.volumeUpperBound))
		{
			filterby.push(filterFunctions["filterByVolumeUpperBound"](parseInt(req.query.volumeUpperBound)));
		}
	}
	if (req.query.filterByItemLimitUpperBound)
	{
		if (parseInt(req.query.itemLimitUpperBound))
		{
			filterby.push(filterFunctions["filterByItemLimitUpperBound"](parseInt(req.query.itemLimitUpperBound)));
		}
	}
	if (req.query.filterByItemLimitLowerBound)
	{
		if (parseInt(req.query.itemLimitLowerBound))
		{
			filterby.push(filterFunctions["filterByItemLimitLowerBound"](parseInt(req.query.itemLimitLowerBound)));
		}
	}
	if (req.query.filterByPosition)
	{
		if (parseInt(req.query.position))
		{
			filterby.push(filterFunctions["filterByPosition"](parseInt(req.query.position)));
		}
	}
}
//fetches all docs and assigns it to allitems
//also creates an array indexed by itemids, called allitems ordered
//the fetchAllDocuments in app.js is different in this regard
//callback in this case is resolve function from promise, cause app has to wait until all items are fetched before starting
async function fetchAllDocuments(callback, criteria)
{
	//allitems will be the array being sorted
	//allitemsordered will be the array of items indexed by id
	allitems = [];
	allitemsOrdered = {};
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

async function startapp (port)
{	

	await new Promise(function (resolve, reject)
	{
		app.listen(port, function ()
		{	
			console.log("getracker started on port " + this.address().port + " at ip " + this.address().address);
		});
		initDataBase(resolve);
	});

	while(true)
	{
		await new Promise(function (resolve, reject)
		{
			//passes the promise object all the documents i.e. passes alldocs to the resolve function
			fetchAllDocuments(resolve);
		});
		//use temp variables, then get another copy, update database will set temp arrays to null
		let tempallitems = allitems;
		let tempallitemsOrdered = allitemsOrdered;
		await new Promise(function (resolve, reject)
		{
			//passes the promise object all the documents i.e. passes alldocs to the resolve function
			fetchAllDocuments(resolve, {invalid : false});
		});

		await new Promise(function(resolve, reject)
		{
			updateDataBase(tempallitems, tempallitemsOrdered, resolve, appUpdating)
		});
	}

}

//_________________________________________________________________________________________________________________________________________________________________
//__________________________________________________________________________________________________________________________________________________________________
//_________________________________________________________________________________________________________________________________________________________________

app.get("/", async function(req, res)
{
	res.render("index.ejs");
});

app.get("/login", function(req, res)
{
	if (res.locals.user)
	{
		res.redirect("/");
	}
	else
	{
		res.render("login.ejs", {message : null});
	}
});

app.get("/register", function(req, res)
{
	res.render("register.ejs", {message : null});
});

app.get("/item/sort", function(req, res)
{
	//for weighted sort
	var progressbars = null;
	var functions = null;

	var typeSort = req.query.typeSort ? req.query.typeSort : null;
	var weight = req.query.weight;
	var sortby = (req.query.sortby === undefined || req.query.sortby.length === 0) ? ['sortByNone'] : req.query.sortby;	
	sortby.push('sortByNone'); //fine if we push an extra sortByNone, effectively does nothing
	//replace string criteria in sortby array with the actual functions
	sortby.forEach(function(val, index){
		sortby[index] = sortFunctions[val](typeSort, weight[index]);
	});
	//if weighted combine all the functions together
	if (typeSort === "weightedSort")
	{
		functions = sortby;
		functions.pop();
		sortby = new Array();
		sortby.push(function (item1, item2) 
		{
			var score1 = 0;
			var score2 = 0;
			functions.forEach(function(getScore)
			{
				score1 += getScore(item1);
				score2 += getScore(item2);
			});

			return score1 === score2 ? 0 : (score1 > score2 ? 1 : -1);
		});
		sortby.push(sortFunctions['sortByNone'](null));

		progressbars = new Array();
	}



	var filterby = [];
	populateFilterArr(req, filterby);

	//sort then filter
	quicksort(allitems, 0, allitems.length - 1, sortby);
	var filteredArr  = filter(allitems, filterby);
	if (typeSort === "weightedSort")
	{
		//populate the progressbars array with objects that will have the color for the progress bar
		//and an array holding numbers representing the percentages of an attribute relative to the total score
		functions.forEach(function(getColor)
		{
			progressbars.push({color: getColor(), percentages: new Array()});
		});

		var temparr = new Array(functions.length);
		var sum = 0;
		for (var i = 0; i < filteredArr.length; i ++)
		{
			//find the total score for the item in the filtered arr
			//save it in the array so that we dont have to get it again
			functions.forEach(function(getScore, index)
			{
				temparr[index] = getScore(filteredArr[i]);
				sum += temparr[index]
			});
			//push the percentage of each attribute of an item into the progressbars array
			temparr.forEach(function(score, index)
			{
				progressbars[index].percentages.push(Math.round( (score / sum) * 100 ));
			});
			sum = 0;
		}

	}
	res.render("sorted.ejs", {items: filteredArr, progressbars : progressbars});
});

app.get("/item/search/:query", function (req, res) 
{
	var query = req.params.query;
	query = query.trim();

	var pattern = / +/; //regular expressions in javascript denoted by surrounding back slashes. this regexp means "one or more spaces"

	item.find({name_lower : new RegExp( query.split(pattern).join("_").toLowerCase() ), invalid : false}, async function (err, items)
	{
		if (err)
		{
			res.send("problem with mongo, try again later");
		}
		else
		{
			for (var i = 0; i < items.length; i ++)
			{
				await new Promise( function(resolve, reject)
				{
					item.populate(items[i], [{path: "statdata"}], function (err, populatedDoc)
					{
						if (err)
						{
							res.send("there was an error populating documents!");
							process.exit();
						}
						resolve();
					});
				});
			}
			res.render("results.ejs", {query: query, items : items});
		}
	});
});

app.get("/item/data/:itemname", function (req, res) 
{
	var itemname = req.params.itemname;
	item.find({name_lower : itemname}, function (err, itemarr)
	{
		if (err)
		{
			res.send("problem with mongo search, try again later");
		}
		else
		{
			if (itemarr.length === 0)
			{
				res.render("error.ejs");
			}
			else
			{
				item.populate(itemarr[0], [{path: "graphdata statdata"}], function (err, doc)
				{
					if (err)
					{
						res.send("problem with mongo population, try again later");
					}
					else
					{
						res.render("item.ejs", {item : itemarr[0], priceData : itemarr[0].graphdata.priceData, volumeData : itemarr[0].graphdata.volumeData});
					}
				});
			}
		}
	});
});

app.post("/login", function(req, res)
{
	var username = req.body.username;
	var password = req.body.password;

	//invalid post request
	if (!username || !password)
	{
		res.render("login.ejs", {message : "username and password must be filled out!"});
	}
	//already logged in
	else if (res.locals.user) 
	{
		res.redirect("/");
	}
	else
	{
		user.findOne({username: username, password : password}, function (err, foundUser)
		{
			if (err)
			{
				res.render("error.ejs");
			}
			else if (!foundUser)
			{
				res.render("login.ejs", {message : "invalid username or password", border: "border border-danger"});
			}
			else
			{
				req.session.user = foundUser;
				res.redirect("/");
			}
		});
	}
});

app.post("/register", function(req, res)
{
	var username = req.body.username;
	var password = req.body.password;

	if (username === undefined || password === undefined)
	{
		res.render("register.ejs", {message : "username and password must be filled out!"});
	}
	else
	{
		user.findOne({username : username}, function (err, newuser)
		{
			if (err)
			{
				res.render("error.ejs");
			}
			else if (newuser)
			{
				res.render("register.ejs", {message : "that username is already taken!", border : "border border-danger"})
			}
			else
			{
				user.create({username : username, password : password}, function(err, newuser)
				{
					if (err)
					{
						res.render("error.ejs");
					}
					else
					{
						res.render("register.ejs", {message: "succesfully registered!", border: "border border-success"});
					}
				});
			}
		});
	}
});

app.post("/logout", function(req, res)
{
	 req.session.reset();
  	 res.redirect("/");
});

//updates item with id then redirects back to previous
app.post("/item/data/:id", function(req, res)
{
	var id = req.params.id;
	item.find({id : id}, async function (err, itemarr)
	{
		if (err)
		{
			res.render("error.ejs");
		}
		else
		{
			if (itemarr.length !== 1)
			{
				res.render("error.ejs");
			}
			else
			{
				let itemToUpdate = itemarr[0];
				if ((new Date().valueOf()  - allitemsOrdered[itemToUpdate.id].lastUpdated.valueOf()) >= 14400000)
				{
					await new Promise (function (resolve ,reject)
					{
						initGraphData(0, itemarr, resolve);
					});
					itemarr[0] = itemToUpdate; //initGraphData sets array to zero to clean up memory, have to reassign
					await new Promise (function (resolve ,reject)
					{
						initStatData(itemarr, resolve);
					});
					allitemsOrdered[itemToUpdate.id].lastUpdated = itemToUpdate.lastUpdated;
					allitemsOrdered[itemToUpdate.id].statdata = itemToUpdate.statdata;
				}
				res.redirect('back');
			}
		}
	});
});


app.post("/item/search", function(req, res)
{
	res.redirect("/item/search/" + req.body.searchQuery);
});

//add item to user investments
app.post("/item/add/:itemname/:prevurl", function(req, res)
{
	//not logged in or session expired
	if (res.locals.user === null)
	{
		res.redirect("/login");
	}
	else if (!req.params.itemname || !req.params.prevurl || !parseInt(req.body.quantity) || !parseInt(req.body.pricePerItem))
	{
		res.render("error.ejs");
	}
	else
	{
		var lastUpdated = new Date(req.body.lastUpdated);
		var currentPricePerItem = req.body.itemPrice;

		var pricePerItem = req.body.pricePerItem;
		var quantity = req.body.quantity;

		var itemName = req.params.itemname;
		var investments = res.locals.user.investments;

		item.findOne({name_lower : req.params.itemname}, function (err, foundItem)
		{
			if (err || !foundItem)
			{
				res.render("error.ejs")
			}
			else 
			{
				var investments = res.locals.user.investments;
				investments.push({
					name : foundItem.name, 
					id : foundItem.id, 

					dateInvested : new Date(),
					pricePerItemInvested : pricePerItem,

					numInvested : quantity,

					lastUpdated : lastUpdated,
					currentPricePerItem: currentPricePerItem,
				});
				res.locals.user.save(() => res.redirect(req.params.prevurl.split("_").join("/").split("-").join("?")));

				//rebuild the url from the post request
				//have to replace / and ? because those are special and change how url is interpreted
				//res.redirect(req.params.prevurl.split("_").join("/").split("-").join("?"));
			}
		});
	}
});

//delete item from user investments
app.post("/item/delete/:itemid", function(req, res)
{
	//not logged in or session expired
	if (res.locals.user === null)
	{
		res.redirect("/login");
	}
	else
	{
		res.locals.user.investments.pull({_id : req.params.itemid});
		res.locals.user.save();
		res.redirect("/");
	}
});

// app.get("/picture/:id", function (req, res)
// {
// 	console.log("picture...");
// 	console.log(allitemsOrdered[req.params.id]);
// 	console.log(allitemsOrdered);
// 	if (allitemsOrdered[req.params.id])
// 	{
// 		console.log("updating picture");
// 		initItemData(0, [allitemsOrdered[req.params.id]]);
// 	}
// 	res.redirect("/");
// });

app.get("/*", function(req, res)
{
	res.render("error.ejs");
});

app.post("/*", function(req, res)
{
	res.render("error.ejs");
});


//_________________________________________________________________________________________________________________________________________________________________
//_________________________________________________________________________________________________________________________________________________________________
//_________________________________________________________________________________________________________________________________________________________________

startapp(port);



