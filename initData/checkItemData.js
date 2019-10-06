require('dotenv').config();


//checks all items for any missing fields (that osrxbox failed to provide) and fills them by pulling them from the wiki
var item = require("./models/item.js");
var graphdata = require("./models/graphdata.js");

var mongoose = require("mongoose");
var request = require("request");

var jsdom = require("jsdom");
const { JSDOM } = jsdom;

mongoose.connect(process.env.MONGODB_URI ||'mongodb://localhost:27017/getracker', {useNewUrlParser: true});



function checkFields(item)
{
	//returns if all fields are there
	return ((!item.id) || (!item.limit) || (!item.description) || (!item.members)) ? false : true;
}

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

async function checkItemData(callback)
{
	var allitems = null;
	await new Promise(function (resolve, reject)
	{
		//passes the promise object all the documents i.e. passes alldocs to the resolve function
		fetchAllDocuments(resolve, {invalid : false});
	}).then(function(alldocs){allitems = alldocs;});


	var wikiURL = "https://oldschool.runescape.wiki/w/Exchange:" // + itemName, spaces replaced with underscore
	
	//used to find data on the wiki page we pull
	var memberClass = "gemw-members";
	var limitClass = "gemw-limit"; //Buy limit<limit> .substring(9).split(",").join("")
	var idClass = "gemw-id"; //Item ID<id> .substring(7).split(",").join("")
	var descriptionClass = "gemw-examine";
	//there is also high alch and low alch, if ever needed

	var numMissing = 0;


	for (var i = 0; i < allitems.length; i ++)
	{
		if (!checkFields(allitems[i]))
		{
			var item = allitems[i];
			numMissing ++;
			await new Promise (function (resolve, reject)
			{
				request(wikiURL + item.name.split(" ").join("_"), function (error, response, body)
				{
					if (error)
					{
						console.log("failed to retrieve item data from wiki");
						process.exit();
					}
					else if (response.statusCode !== 200)
					{
						console.log("failed to retrieve item data from wiki (incorrect link)");
						process.exit();
					}
					else
					{
						const dom = new JSDOM(body);

						let members = dom.window.document.querySelector("." + memberClass).textContent;
						let limit = dom.window.document.querySelector("." + limitClass).textContent.substring(9).split(",").join("");
						let id = dom.window.document.querySelector("." + idClass).textContent.substring(7).split(",").join("");
						let description = dom.window.document.querySelector("." + descriptionClass).textContent;

						item.members = (members === 'Members' ? true : false);
						item.limit = limit;
						item.id = id;
						item.description = description;

						item.save();
						console.log("itemdata with id of " + item.id + " has been fetched from wiki");
						resolve(); 
					}
				});
			});
		}
	}

	console.log("itemdata for " + numMissing + " items have been fetched from the wiki!");
	if (typeof callback === "function")
	{
		callback();
	}
}

module.exports = checkItemData;