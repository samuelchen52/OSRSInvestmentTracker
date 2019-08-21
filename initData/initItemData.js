//populates the mongodb database
var item = require("./models/item.js");
var graphdata = require("./models/graphdata.js");

var mongoose = require("mongoose");
var request = require("request");
var fs = require("fs");

mongoose.connect('mongodb://localhost:27017/getracker', {useNewUrlParser: true});
//http://services.runescape.com/m=itemdb_oldschool/api/graph/7394.json
//http://services.runescape.com/m=itemdb_oldschool/api/catalogue/detail.json?item=7394

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

function stream (url, id, folder)
{
    request(url).pipe(fs.createWriteStream('images/' + folder +'/' + id + '.gif'));
}

function populate(start) //fetches all document objects in mongodb and then passes it to another function that will then make the requests
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
			makeRequests(start, allItems);
		}
	});
}

async function makeRequests(start, documentarr)
{
	var reqbody = null;
	var arr = [];
	while (start < documentarr.length)
	{
		var url = "http://services.runescape.com/m=itemdb_oldschool/api/catalogue/detail.json?item=" + documentarr[start].id;
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
						console.log("item with id of "  + documentarr[start].id + " doesn't seem to be in the grand exchange! ||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||");
						arr.push("item with id of "  + documentarr[start].id + " doesn't seem to be in the grand exchange!");
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

			console.log("request was rejected for item with id of " + documentarr[start].id + " at index " + start + "! waiting 60 seconds...");
			await new Promise(function (resolve, reject) 
				{
					setTimeout(resolve, 60000);
				});
			console.log("60 seconds up, trying again...");
		}
		else
		{
			var temp = documentarr[start];
			reqbody = reqbody.item;

			temp.icon = reqbody.icon;
			temp.icon_large = reqbody.icon_large;

			//stream(temp.icon, documentarr[start].id, "small");
			//stream(temp.icon_large, documentarr[start].id, "big");

			temp.type = reqbody.type;
			temp.typeIcon = reqbody.typeIcon;

			temp.name_lower = reqbody.name.split(" ").join("_").toLowerCase();

			temp.description = reqbody.description;
			temp.members = reqbody.members;
			temp.save();

			console.log("document with id of " + documentarr[start].id + " at index " + start + " updated!");
			documentarr[start] = null; // allow garbage collector to clean up
			start ++;

			await new Promise(function (resolve, reject) 
				{
					setTimeout(resolve, 3500);
				});
		}
	}
	console.log("finished updating the database!");
	console.log(arr);
	process.exit();
}



if (process.argv.length !== 3)
{
	console.log("enter an index!");
}
else
{
	populate(process.argv[2]);
}



// item.find({}, function (err, allitems)
// {
// 	var s1 = "<img src = \"";
// 	var s2 = "\">";
// 	for (var i = 0; i < 300; i ++)
// 	{
// 		console.log(s1 + allitems[i].icon_large + s2);
// 	}
// });

