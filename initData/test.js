var itemlimits = require("./itemList.js");

var item = require("./models/item.js");
var graphdata = require("./models/graphdata.js");
var statdata = require("./models/statdata.js");

var mongoose = require("mongoose");
var request = require("request");
var fs = require("fs");

var jsdom = require("jsdom");
const { JSDOM } = jsdom;

var testSchema = new mongoose.Schema({
name : String
});
var testdata = new mongoose.model("testdata", testSchema);



var mongoose = require("mongoose");
mongoose.connect('mongodb://localhost:27017/getracker', {useNewUrlParser: true});


var counter = 0;

// item.find({}, function (err, allitems)
// {
// 	for (var i = 0; i < allitems.length; i++)
// 	{
// 		item.populate(allitems[i], [{path: "statdata"}], function (err, doc)
// 		{
// 			var stat = doc.statdata;
// 			if ((!doc.members) && (stat.currentTrend === "positive") && (stat.currentTrendDuration < stat.averagePositiveTrendDuration) && (stat.currentPrice < 1000000))
// 			{
// 			console.log(doc.name + " with an id of "  + doc.id + " is a good item!");
// 			}
// 		});
// 		if (!allitems[i].members)
// 		{
// 			counter ++;
// 			//console.log(allitems[i].name + " is not a members item");
// 		}
// 	}
// 	console.log("there are " + counter + " nonmembers items in the game");
// });

// async function test (docarr) 
// {
// 	for (var i = 0; i < docarr.length; i ++)
// 	{
// 		await new Promise (function (resolve, reject)
// 		{
// 			testdata.find({name : docarr[i].name}, function (err, item)
// 			{
// 				if (err)
// 				{
// 					console.log("something messed up!");
// 					process.exit();
// 				}
// 				else
// 				{
// 					if (item.length === 0)
// 					{
// 						console.log(docarr[i].name + " is not in the new database!");
// 					}
// 					resolve();
// 				}
// 			});
// 		});
// 	}
// 	process.exit();
// }

// item.find({}, function(err, docarr)
// {
// 	if (err)
// 	{
// 		console.log("something messed up!");
// 		process.exit();
// 	}
// 	else
// 	{
// 		test(docarr);
// 	}
// });

//645
//

function compare (obj1, obj2)
{
	if (obj1.id < obj2.id)
	{
		return -1;
	}
	else
	{
		return 1;
	}
}

function quicksort (arr, start, end)
{
	if (start < end)
	{
		var partition = arr[end];
		var low = start - 1;
		var pointer = start;

		while (pointer < end)
		{
			if (arr[pointer].id < partition.id)
			{
				low ++;
				var temp = arr[low];
				arr[low] = arr[pointer];
				arr[pointer] = temp;
			}
			pointer ++;
		}

		var temp = arr[low + 1];
		arr[low + 1] = arr[end];
		arr[end] = temp;

		quicksort(arr, start, low);
		quicksort(arr, low + 2, end);

	}
}

// quicksort(itemlimits, 0, itemlimits.length - 1);
// itemlimits.forEach(function (obj)
// {
// 	console.log("{\n\"name\" : \"" + obj.name + "\",\n\"limit\" : " + obj.limit + ",\n\"id\" : " + obj.id + "\n},");
// })




//finds all urls in itemlimit that dont work, fixed 8/5
// async function test () 
// {
// 	var counter = 0;
// 	var arr = [];
// 	for (var i = 0; i < itemlimits.length; i ++)
// 	{
// 		await new Promise (function (resolve, reject)
// 		{
// 			item.find({name : itemlimits[i].name}, async function (err, item)
// 			{
// 				if (err)
// 				{
// 					console.log("there was an error with mongo!");
// 					process.exit();
// 				}
// 				if (item.length === 0)
// 				{
// 					counter ++;
// 					var url = "https://oldschool.runescape.wiki/w/Module:Exchange/"+ itemlimits[i].name.split(" ").join("_") +"/Data";
// 					await new Promise (function (resolve, reject)
// 					{
// 						request.get({url : url},  function (error, response, body)
// 						{
// 							if (response.statusCode !== 200)
// 							{
// 								console.log("THERE WAS A PROBLEM WITH " + url);
// 								arr.push(url);
// 							}
// 							else
// 							{
// 								console.log("the " + url + " worked just fine!");
// 							}
// 							resolve();
// 						});
// 					});
// 				}
// 				resolve();
// 			});
// 		});
// 	}
// 	console.log(counter + " is the number of urls that didnt work!");
// 	console.dir(arr);
// }

async function test(documentarr)
{
	var reqbody = null;
	var deletedoc = false;
	start = 0;
	while (start < documentarr.length)
	{
		//var url = "http://services.runescape.com/m=itemdb_oldschool/api/graph/" + documentarr[start].id + ".json";
		//below is different url!!!!!!!
		var url = "https://oldschool.runescape.wiki/w/Exchange:"+ documentarr[start].name.split(" ").join("_");
		await new Promise (function (resolve, reject)
		{
			request.get({url : url},  function (error, response, body)
			{
				if (response.statusCode !== 200)
				{
					if (response.statusCode === 404)
					{
						console.log("item with id of "  + documentarr[start].id + " doesn't seem to be in the grand exchange! deleting...");
						process.exit();
						deletedoc = true;
					}
					reqbody = null;
					resolve();
				}
				else if (error)
				{
					console.log("error:" +  error);
					process.exit();
				}
				else
				{
					// try 
					// {
					// reqbody = JSON.parse(body);
					// resolve();
					// }
					// catch (err)
					// {
					// 	// console.log("err: " + err);
					// 	// console.log("error:" +  error);
					// 	// console.log("statusCode: " + response.statusCode);
					// 	// console.log("body: " + body);
					// 	//console.dir(response);
					// 	// process.exit();
					// 	reqbody = null;
					// 	console.log("body was empty: ");
					// 	resolve();
					// }
					reqbody = body;
					resolve();
				}
			})
		}).catch(function(err) 
		{
			console.log("this shouldnt be happening!");
			process.exit();
		});

		if (reqbody === null) 
		{
			if (deletedoc)
			{
				deletedoc = false;
				await new Promise (function (resolve, reject)
				{
					item.deleteOne({id : documentarr[start].id}, function(err)
					{
						if (err)
						{
							console.log("failed to delete item document with id " + documentarr[start].id + "!");
							process.exit();
						}
						else
						{
							console.log("succesfully deleted item document with id " + documentarr[start].id + "!");
						}
						resolve();
					});
				});
				await new Promise (function (resolve, reject)
				{
					graphdata.deleteOne({id : documentarr[start].id}, function(err)
					{
						if (err)
						{
							console.log("failed to delete graphdata document with id " + documentarr[start].id + "!");
							process.exit();
						}
						else
						{
							console.log("succesfully deleted graphdata document with id " + documentarr[start].id + "!");
						}
						resolve();
					});
				});
				start ++;
			}
			else
			{
				console.log("request was rejected for item with id of " + documentarr[start].id + " at index " + start + "! waiting 60 seconds...");
				console.log(url);
				await new Promise(function (resolve, reject) 
					{
						setTimeout(resolve, 60000);
					});
				console.log("60 seconds up, trying again...");
			}
		}
		else
		{
						const dom = new JSDOM(reqbody);
						var nodelist = dom.window.document.querySelectorAll(".gemw-id dd");
						console.log("{\n\"name\" : \"" + documentarr[start].name + "\",\n\"limit\" : " + documentarr[start].limit + ",\n\"id\" : " + nodelist[0].textContent + "\n},");
						start ++;
						//console.log(process.memoryUsage());
		}
	}
	console.log("finished updating the database!");
	console.log(itemlimits.length);
	console.log(start);
	process.exit();
}

//test(itemlimits);

var url = "http://services.runescape.com/m=itemdb_oldschool/1565260184131_obj_big.gif?id=7394";
var stream = function(){
        request(url).pipe(fs.createWriteStream('images/big/' + 7394 + '.gif'));
    };




