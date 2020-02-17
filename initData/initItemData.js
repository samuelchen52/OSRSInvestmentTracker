require('dotenv').config();

//populates the mongodb database
//initItemData only downloads all the icons from all the images
//itemData now comes from massive file from osrsbox
var item = require("./models/item.js");
var graphdata = require("./models/graphdata.js");
var invalid = require("./models/invalid.js");


var mongoose = require("mongoose");
var request = require("request");
var fs = require("fs");

mongoose.connect(process.env.MONGODB_URI ||'mongodb://localhost:27017/getracker', {useNewUrlParser: true});
//http://services.runescape.com/m=itemdb_oldschool/api/graph/7394.json
//http://services.runescape.com/m=itemdb_oldschool/api/catalogue/detail.json?item=7394

var graphurl = "http://services.runescape.com/m=itemdb_oldschool/api/graph/";
var detailurl = "http://services.runescape.com/m=itemdb_oldschool/api/catalogue/detail.json?item=";



function stream (url, id, folder, directory)
{
    request(url).pipe(fs.createWriteStream('public/images/' + folder + '/' + id + '.gif'));
}

async function populate(start, documentarr, callback) //fetches all document objects in mongodb and then passes it to another function that will then make the requests
{
	if (documentarr)
	{
		makeRequests(start, documentarr, callback);
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
				makeRequests(start, allItems, callback);
			}
		});
	}
}

async function makeRequests(start, documentarr, callback)
{
	var reqbody = null;
	var responseCode = null;
	var arr = [];
	while (start < documentarr.length)
	{
		if (documentarr[start].invalid)
		{
			start ++;
			continue;
		}

		var url = "http://services.runescape.com/m=itemdb_oldschool/api/catalogue/detail.json?item=" + documentarr[start].id;
		await new Promise (function (resolve, reject)
		{
			request.get({url : url},  async function (error, response, body)
			{
				responseCode = response.statusCode;
				if (error)
				{
					console.log("error:" +  error);
					process.exit();
				}
				else if (response.statusCode !== 200)
				{
					if (response.statusCode === 404)
					{
						//console.log("item with id of "  + documentarr[start].id + " doesn't seem to be in the grand exchange!");
						//this shouldnt happen, as this is done with an up to date item list
						//process.exit();
						//nope, this CAN happen, when pulling from osrsbox, some items are NOT valid
						//fetching data from the osrs api with their item ids gives a 404
						//e.g. items with ids 894, 895, 896, 897 (all of which are bronze arrows, wtf?)
						await new Promise (function (resolve, reject)
						{
							invalid.findOne({name : documentarr[start].name, id : documentarr[start].id}, function (error, invalidItem)
							{
								if (error)
								{
									console.log("failed to find invalid document with id of " + documentarr[start].id);
									process.exit();
								}
								else if (!invalidItem)
								{
									invalid.create({name : documentarr[start].name, id : documentarr[start].id}, function (error, invalidItem)
									{
										if (error)
										{
											console.log("failed to create invalid document with id of " + documentarr[start].id);
											process.exit();
										}
										else
										{
											resolve();
											console.log("created invalid document with id of " + documentarr[start].id);
										}
									});
								}
							});
						});
						//set invalid to true
						documentarr[start].invalid = true;
						documentarr[start].save();
						start ++;

					}
					reqbody = null;
					resolve();
				}
				else
				{
					try 
					{
					reqbody = JSON.parse(body);
					resolve();
					}
					catch (err)
					{
						// console.log("err: " + err);
						// console.log("error:" +  error);
						// console.log("statusCode: " + response.statusCode);
						// console.log("body: " + body);
						//console.dir(response);
						// process.exit();
						reqbody = null;
						console.log("body was empty: ");
						resolve();
					}
				}
			})
		}).catch(function(err) 
		{
			console.log("this shouldnt be happening!");
			process.exit();
		});

		if (reqbody === null)
		{
			if (responseCode !== 404)
			{
				console.log("request was rejected for item with id of " + documentarr[start].id + " at index " + start + "! waiting 60 seconds...");
				await new Promise(function (resolve, reject) 
					{
						setTimeout(resolve, 60000);
					});
				console.log("60 seconds up, trying again...");
			}
		}
		else
		{
			// var temp = documentarr[start];
			let item = reqbody.item;

			// temp.icon = reqbody.icon;
			// temp.icon_large = reqbody.icon_large;

			stream(item.icon, documentarr[start].id, "small");
			stream(item.icon_large, documentarr[start].id, "big");
			
			documentarr[start].iconFetched = true;
			documentarr[start].save();

			// temp.type = reqbody.type;
			// temp.typeIcon = reqbody.typeIcon;

			// temp.name_lower = reqbody.name.split(" ").join("_").toLowerCase();

			// temp.description = reqbody.description;
			// temp.members = reqbody.members;
			// temp.save();

			console.log("icons for document with id of " + documentarr[start].id + " at index " + start + " fetched!");
			documentarr[start] = null; // allow garbage collector to clean up
			start ++;
			//console.log(process.memoryUsage());
			await new Promise(function (resolve, reject) 
				{
					setTimeout(resolve, 3500);
				});
		}
	}
	if (typeof callback === "function")
	{
		callback();
	}
}

module.exports = populate;

