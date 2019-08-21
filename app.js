var express    = require("express");
var bodyparser = require("body-parser");
var mongoose   = require("mongoose");
var session = require('client-sessions');

var item = require("./initData/models/item.js");
var graphdata = require("./initData/models/graphdata.js");
var statdata = require("./initData/models/statdata.js");
var user = require("./initData/models/user.js");

var calculateStat = require("./initData/initStatData.js");
var updateGraph = require("./initData/initGraphData.js");

var app = express(); 
var allitems = null;

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
			}
			next();
		});
	}
	else
	{
		res.locals.user = null;
		next();
	}
});

mongoose.connect('mongodb://localhost:27017/getracker', {useNewUrlParser: true});

//todo
//carousel recommendations
//will need to update allitems periodically, just fetch the documents from database every so often
//new idea - load array of docs, iterate and update each one 
//use same array for sorting, simply allocate another array, and copy over all references that make it past the filter
//faster than fetching every time
//message passed through res.locals?
//make graph more readable
//statdata volatility

//_________________________________________________________________________________________________________________________________________________________________
//_________________________________________________________________________________________________________________________________________________________________
//_________________________________________________________________________________________________________________________________________________________________

//these functions dont sort, they are used IN the sorting
var sortFunctions = {
		//sort by id, in ascending order (will be the tiebreaker, since ids are unique)
		sortByNone : function (item1, item2) 
		{
			return item1.id > item2.id ? -1 : 1;
		},
		//sort by current volume
		sortByVolume : function (item1, item2) 
		{
			var item1volume = item1.statdata.currentVolume;
			var item2volume = item2.statdata.currentVolume;
			return item1volume === item2volume ? 0 : (item1volume > item2volume ? 1 : -1);
		},
		//sort by current price
		sortByPrice : function (item1, item2) 
		{
			var item1price = item1.statdata.currentPrice;
			var item2price = item2.statdata.currentPrice;
			return item1price === item2price ? 0 : (item1price > item2price ? 1 : -1);
		},
		//sort by item limit
		sortByLimit : function (item1, item2)
		{
			return item1.limit === item2.limit ? 0 : (item1.limit > item2.limit ? 1 : -1);
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
			return item.statdata.currentPrice >= priceLowerBound;
		}
	},
	filterByPriceUpperBound : function(priceUpperBound)
	{
		return function (item) 
		{
			return item.statdata.currentPrice <= priceUpperBound;
		}
	},
	filterByVolumeLowerBound : function(volumeLowerBound)
	{
		return function (item) 
		{
			return item.statdata.currentVolume >= volumeLowerBound;
		}
	},
	filterByVolumeUpperBound : function(volumeUpperBound)
	{
		return function (item) 
		{
			return item.statdata.currentVolume <= volumeUpperBound;
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

		//put everything lower than partition on the left
		while (pointer < end)
		{
			result = 0;
			sortFunctionIndex = 0;
			while (result === 0)
			{
				result = sortFunctions[sortby[sortFunctionIndex]](arr[pointer], partition);
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
			if (!filterArr[p](docArr[i]))
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
//fetches all docs and assigns it to allitems
async function fetchAllDocuments(callback)
{
	var allitems = [];
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

async function startapp ()
{
	await new Promise(function (resolve, reject)
	{
		//passes the promise object all the documents i.e. passes alldocs to the resolve function
		fetchAllDocuments(resolve);
	}).then(function(alldocs){allitems = alldocs;});
	app.listen(80, async function ()
	{	
		console.log("getracker started on port " + this.address().port + " at ip " + this.address().address);
	});
}

//_________________________________________________________________________________________________________________________________________________________________
//_________________________________________________________________________________________________________________________________________________________________
//_________________________________________________________________________________________________________________________________________________________________

app.get("/", async function(req, res)
{
	if (res.locals.user)
	{
		var investments = res.locals.user.investments;
		var investmentResults = [];
		var error = false;
		for (var i = 0; i < investments.length && !error; i ++)
		{
			await new Promise (function (resolve, reject)
			{
				item.findOne({id : investments[i].itemid}, async function(err, foundItem)
				{
					if (err || !foundItem)
					{
						error = true;
						resolve();
					}
					else
					{
						item.populate(foundItem, [{path: "statdata"}], function (err, populatedDoc)
						{
							if (err)
							{
								error = true;
								console.log(err);
								resolve();
							}
							else
							{
								var pastPricePerItem = Math.round(investments[i].priceInvested / investments[i].numInvested * 10) / 10;
								var currentPricePerItem = populatedDoc.statdata.currentPrice;

								var dateInvested = investments[i].dateInvested;
								var lastUpdated = populatedDoc.lastUpdated;
								var datesValid = true;

								if (lastUpdated.getFullYear() > dateInvested.getFullYear())
								{
									datesValid = true;
								}
								else if (lastUpdated.getFullYear() < dateInvested.getFullYear())
								{
									datesValid = false;
								}
								else
								{
									if (lastUpdated.getMonth() > dateInvested.getMonth())
									{
										datesValid = true;
									}
									else if (lastUpdated.getMonth() < dateInvested.getMonth())
									{
										datesValid = false;
									}
									else
									{
										if (lastUpdated.getDate() >= dateInvested.getDate())
										{
											datesValid = true;
										}
										else
										{
											datesValid = false;
										}
									}
								}


								investmentResults.push({
									itemName : populatedDoc.name,
									itemNameLower : populatedDoc.name_lower,
									itemId : populatedDoc.id,
									arrayId : investments[i]._id,

									dateInvested : dateInvested,
									numInvested : investments[i].numInvested,
									priceInvested : investments[i].priceInvested,
									pastPricePerItem : pastPricePerItem,

									datesValid : datesValid,
									currentDate : lastUpdated,
									currentPrice : investments[i].numInvested * populatedDoc.statdata.currentPrice,
									currentPricePerItem : currentPricePerItem,
									approxTotalChange : (investments[i].numInvested * populatedDoc.statdata.currentPrice) - investments[i].priceInvested,
									approxTotalChangePerItem : currentPricePerItem - pastPricePerItem
								});
								resolve();
							}
						});
					}
				});
			});
		}
		if (error)
		{
			res.render("error.ejs");
		}
		else
		{
			res.render("index.ejs", {investmentResults : investmentResults});
		}
	}
	else
	{
		res.render("index.ejs");
	}
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

app.get("/item/sort", async function(req, res)
{
	var sortby = (req.query.sortby === undefined || req.query.sortby.length === 0) ? ['sortByNone'] : req.query.sortby;	
	if (sortby[sortby.length - 1] !== 'sortByNone')
	{
		sortby.push('sortByNone');
	}

	var filterby = [];
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

	var filteredArr  = filter(allitems, filterby);


	quicksort(filteredArr, 0, filteredArr.length - 1, sortby);
	res.render("sorted.ejs", {items: filteredArr});
});

app.get("/item/search/:query", function (req, res) 
{
	var query = req.params.query;
	query = query.trim();

	var pattern = / +/;

	item.find({name_lower : new RegExp( query.split(pattern).join("_").toLowerCase() )}, async function (err, items)
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
				res.render("login.ejs", {message : "invalid username or password"});
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
		user.create({username : username, password : password}, function(err, newuser)
		{
			if (err)
			{
				res.render("error.ejs");
			}
			else
			{
				res.render("register.ejs", {message: "succesfully registered!"});
			}
		});
	}
});

app.post("/logout", function(req, res)
{
	 req.session.reset();
  	 res.redirect("/");
});

//updates itemname then redirects back to previous
app.post("/item/data/:itemname", function(req, res)
{
	var itemname = req.params.itemname;
	item.find({name_lower : itemname}, async function (err, itemarr)
	{
		if (err)
		{
			res.send("problem with mongo search, try again later");
		}
		else
		{
			if (itemarr.length === 0 || itemarr.length > 1)
			{
				res.render("error.ejs");
			}
			else
			{
				var temp = itemarr[0];
				await new Promise (function (resolve ,reject)
				{
					updateGraph(0, itemarr, resolve);
				});
				itemarr[0] = temp;
				await new Promise (function (resolve ,reject)
				{
					calculateStat(itemarr, resolve);
				});
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
	else if (!req.params.itemname || !req.params.prevurl || !parseInt(req.body.quantity) || !parseInt(req.body.price))
	{
		res.render("error.ejs");
	}
	else
	{
		item.findOne({name_lower : req.params.itemname}, function (err, foundItem)
		{
			if (err || !foundItem)
			{
				res.render("error.ejs")
			}
			else 
			{
				var investments = res.locals.user.investments;
				investments.push(
				{
					itemname : foundItem.name_lower,
					itemid : foundItem.id,

					dateInvested : new Date(),
					numInvested : req.body.quantity,
					priceInvested : req.body.price
				});
				res.locals.user.save();

				//rebuild the url from the post request
				//have to replace / and ? because those are special and change how url is interpreted
				res.redirect(req.params.prevurl.split("_").join("/").split("-").join("?"));
			}
		});
	}
});

//delete item from user investments
app.post("/item/delete/:arrayid", function(req, res)
{
	//not logged in or session expired
	if (res.locals.user === null)
	{
		res.redirect("/login");
	}
	else
	{
		res.locals.user.investments.pull({_id : req.params.arrayid});
		res.locals.user.save();
		res.redirect("/login");
	}
});


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

startapp();




