require('dotenv').config();
//populates the mongodb database

var item = require("./models/item.js");
var graphdata = require("./models/graphdata.js");
var invalid = require("./models/invalid.js");

var mongoose = require("mongoose");
var request = require("request");
// jsdom does NOT support node.innerText (which gets the text nested between the tags of an element, excluding any text nested within the elements children) 
// jsdom supports node.textContent, which gets all text, nested or not
// https://stackoverflow.com/questions/35213147/difference-between-textcontent-vs-innertext
var jsdom = require("jsdom");
const { JSDOM } = jsdom;


mongoose.connect(process.env.MONGODB_URI ||'mongodb://localhost:27017/getracker', {useNewUrlParser: true});

//note, for the graph json, the epoch time is in MILLISECONDS, and javascripts date object uses milliseconds as the unit for epoch date

//http://services.runescape.com/m=itemdb_oldschool/api/graph/7394.json
//http://services.runescape.com/m=itemdb_oldschool/api/catalogue/detail.json?item=7394
//http://services.runescape.com/m=itemdb_oldschool/viewitem.ws?obj=7394 <---official osrs ge
//https://oldschool.runescape.wiki/w/Module:Exchange/Blue_wizard_hat_(g)/Data

var graphurl = "http://services.runescape.com/m=itemdb_oldschool/api/graph/";
var detailurl = "http://services.runescape.com/m=itemdb_oldschool/api/catalogue/detail.json?item=";


// async function requestGraphData(id) //return promise object with value of parsed request body in the mongodb database, if error, returns with null value
// {
// 	var url = "http://services.runescape.com/m=itemdb_oldschool/api/graph/" + id + ".json";
// 	var ret = null;

// 	return request(url, function(error, response, body)
// 	{
// 		if (response.statusCode !== 200)
// 		{
// 			ret =  new Promise (function (resolve, reject)
// 			{
// 				resolve(null);
// 			});
// 		}
// 		else
// 		{
// 			ret = new Promise (function (resolve, reject)
// 			{
// 				resolve(JSON.parse(body));
// 			});
// 		}
// 	});

// 	return await ret;

// }

async function populate(start, documentarr, callback, getPriceOnly) //fetches all document objects in mongodb and then passes it to another function that will then make the requests
{
	if (documentarr)
	{
		makeRequests(start, documentarr, callback, getPriceOnly);
	}
	else
	{
		item.find({}, function (err, allItems)
		{
			if (err)
			{
				console.log("error fetching all the document objects!");
				process.exit();
			}
			else
			{
				makeRequests(start, allItems, callback, getPriceOnly);
			}
		});
	}
}

async function pullFromWiki(start, documentarr, resolve)
{
	//var url = "http://services.runescape.com/m=itemdb_oldschool/api/graph/" + documentarr[start].id + ".json";
	//if wikiName is just a longer version of actual name, then thats probably for duplicates, in which case it will be correct
	//var wikiName = documentarr[start].wikiName.split(" ").join("_");
	var actualName = documentarr[start].name.split(" ").join("_");
	var statusCode = 200;
	var reqbody = null;

	var url = "https://oldschool.runescape.wiki/w/Module:Exchange/"+ actualName +"/Data";
	await new Promise (function (resolve, reject)
	{
		request.get({url : url},  function (error, response, body)
		{
			if (error)
			{
				console.log("error:" +  error);
				process.exit();
			}
			else if (response.statusCode !== 200)
			{
				if (response.statusCode === 404)
				{
					console.log("can't pull wiki graph data for item with id of "  + documentarr[start].id + "!");
					documentarr[start].invalid = true;
					documentarr[start].save();
			  }

			  statusCode = response.statusCode;
				reqbody = null;
				resolve();
			}
			else
			{
				reqbody = body;
				resolve();
			}
		})
	});

	if (reqbody === null) 
	{
		if (statusCode !== 404)
		{
			console.log("request was rejected for item with id of " + documentarr[start].id + " at index " + start + "!");
			// await new Promise(function (resolve, reject) 
			// 	{
			// 		setTimeout(resolve, 60000);
			// 	});
			// console.log("60 seconds up, trying again...");
			return;
		}
		else
		{
			documentarr[start] = null; // allow garbage collector to clean up the space being used up by the daily and average arrays
		}
	}
	else
	{
		await new Promise (function (resolve, reject)
		{
			item.populate(documentarr[start], [{path: "graphdata"}], function (err, populatedDoc)
			{
				if (err)
				{
					console.log("document with id of " + documentarr[start].id + " at index " + start + " had trouble populating!");
					console.log(err);
					//console.dir(documentarr[start]);
					process.exit();
				}
				else
				{
					var graphdata = populatedDoc.graphdata;

					const dom = new JSDOM(reqbody);
					var nodelist = dom.window.document.querySelectorAll(".s1");

					var priceData = [];
					var volumeData = [];

					for (var i = Math.max(nodelist.length - 365, 0); i < nodelist.length; i ++)
					{
						var data = nodelist[i].textContent;
						//substring because of the apostrophes at the beginning and end
						data = data.substring(1, data.length - 1).split(":");
						priceData.push({date: new Date(parseInt(data[0]) * 1000), price: parseInt(data[1])});

						//volume data isnt available for every date for each item
						if (data.length === 3)
						{
							volumeData.push({date: new Date(parseInt(data[0]) * 1000), volume: parseInt(data[2])});
						}

					}
					
					graphdata.priceData = priceData;
					graphdata.volumeData = volumeData;

					graphdata.save();
					//console.log("graph data for document with id of " + documentarr[start].id + " at index " + start + " updated from wiki!");
					populatedDoc.lastUpdated = new Date();
					populatedDoc.save();
					resolve();
				}
			});
		});
		documentarr[start] = null; // allow garbage collector to clean up the space being used up by the daily and average arrays

		await new Promise(function (resolve, reject) 
		{
			setTimeout(resolve, 500);
		});
		//console.log(process.memoryUsage());
	}

	resolve();
}

async function pullFromOSRSAPI(itemDocument, resolve)
{
	var url = "http://services.runescape.com/m=itemdb_oldschool/api/graph/" + itemDocument.id + ".json";
	var statusCode = 200;
	var reqbody = null;

	await new Promise (function (resolve, reject)
	{
		request.get({url : url},  function (error, response, body)
		{
			if (error)
			{
				console.log("error:" +  error);
				process.exit();
			}
			else if (response.statusCode !== 200)
			{
				if (response.statusCode === 404)
				{
					console.log("can't pull wiki graph data for item with id of "  + itemDocument.id + "!");
					itemDocument.invalid = true;
					itemDocument.save();
			  }

			  statusCode = response.statusCode;
				reqbody = null;
				resolve();
			}
			else
			{
				reqbody = body;
				resolve();
			}
		})
	});

	if (reqbody === null) 
	{
		if (statusCode !== 404)
		{
			console.log("request was rejected for item with id of " + itemDocument.id + "!");
			return;
		}
	}
	else
	{
		if (!itemDocument.populated("graphdata"))
		{
			await item.populate(itemDocument, [{path: "graphdata"}]);
		}
		
		reqbody = JSON.parse(reqbody);

		let priceData = itemDocument.graphdata.priceData;
		let newPriceData = reqbody.daily;
		let lastUpdated = (priceData.length - 1) ? priceData[priceData.length - 1].date.getTime() : 0;


		if (newPriceData[lastUpdated])
		{
			for (let i = lastUpdated + 86400000; newPriceData[i]; i += 86400000) //86400000 === 24 * 60 * 60 * 1000
			{
				priceData.push({
					date : new Date(i),
					price : newPriceData[i]
				});
			}

			itemDocument.graphdata.save();
			//console.log("graph data for document with id of " + itemDocument.id + " updated from api!");

			itemDocument.lastUpdated = new Date();
			itemDocument.save();

			await new Promise(function (resolve, reject) 
			{
				setTimeout(resolve, 500);
			});
		}
		//console.log(process.memoryUsage());
	}

	resolve();
}

async function makeRequests(start, documentarr, callback, getPriceOnly)
{
	var reqbody = null;
	var statusCode = 200;
	//var deletedoc = false;
	while (start < documentarr.length)
	{
		let itemDocument = documentarr[start];
		//also fetch volume (and price data) from osrs wiki
		if (!getPriceOnly)
		{
			await new Promise (function (resolve, reject)
			{
				pullFromWiki(start, documentarr, resolve);
			});
		}
		//fetch price data from osrs api
		await new Promise (function (resolve, reject)
		{
			pullFromOSRSAPI(itemDocument, resolve);
		});
		start ++;
	}

	if (typeof callback === "function")
	{
		callback();
	}
	//process.exit();
}



module.exports = populate;


// request.get("https://oldschool.runescape.wiki/w/Module:Exchange/Blue_wizard_hat_(g)/Data", function (error, response, body)
// {
// 	if (error)
// 	{
// 		console.log("there was an error!");
// 		process.exit();
// 	}
// 	else
// 	{
// 		const dom = new JSDOM(body);
// 		console.log(dom.window.document.querySelectorAll(".s1")['0'].textContent);
// 	}
// });

















// var temp = async function (aitem, arr)
// {
// 	item.find({id : aitem.id}, function (err, founditem)
// 	{
// 		if (err)
// 		{
// 			console.log("error, try again");
// 		}
// 		else
// 		{
// 			if (founditem.length === 0)
// 			{
// 				console.log("item with id of " + aitem.id + " not found in the database.");
// 				arr.push(aitem);
// 			}
// 			else
// 			{
// 				//
// 			}
// 		}
// 	});
// }

// var arr = [];
// for (var i = 0; i < itemids.length; i ++)
// {
// 	temp(itemids[i], arr);
// }

// setTimeout(function () {console.dir(arr); console.log(arr.length)}, 10000);
