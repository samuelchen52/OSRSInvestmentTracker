require('dotenv').config();

var item = require("./models/item.js");
var graphdata = require("./models/graphdata.js");
var statdata = require("./models/statdata.js");

var mongoose = require("mongoose");
mongoose.connect(process.env.MONGODB_URI ||'mongodb://localhost:27017/getracker', {useNewUrlParser: true});

//initStatData reponsible for updating all statistics e.g. average price / volume / trendduration for all items 
//in the array given to it, and, for now, updating the stat score for each item after these values have been updated



function helper (num1, num2)
{
	return num2 === num1 ? 0 : (num2 > num1 ? 1 : -1);
}

function populate()
{
	item.find({}, async function (err, allitems)
	{
		if (err)
		{
			console.log("couldnt fetch all the documents");
			process.exit();
		}
		else
		{
			calculate(allitems);	
		}
	});
}


function populateStandardScore(allitems, field, subfield)
{
	var stats = calculateStandardDeviation(allitems,field, subfield);
	var std = stats.std;
	var mean = stats.mean;
	var min = Infinity;

	console.log("the std of " + subfield + " is " + std);
	console.log("the mean of " + subfield + " is " + mean);
	for (var i = 0; i < allitems.length; i ++)
	{
		allitems[i][field].score = (allitems[i][field][subfield] - mean) / std;
		min = Math.min(min, allitems[i][field].score);
	}
	min = Math.abs(min) + 1;
	//make all the scores positive, so that a custom weight can be multiplied to them
	//added 1 just so that the bottom scores have just a teensy little bit of weight to them
	for (var i = 0; i < allitems.length; i ++)
	{
		allitems[i][field].score += min;
	}
}

function calculateStandardDeviation(dataArr, field, subfield)
{
	if (dataArr.length === 0)
	{
		return 0;
	}
	else
	{
		//calculate the mean, then take the sum of the the difference of each number and the mean, squared, and take the square root of this
		var sum = 0;
		var mean;

		for (var i = 0; i < dataArr.length; i ++)
		{
			sum += dataArr[i][field][subfield];
		}

		mean = sum / dataArr.length;
		sum = 0;
		for (var i = 0; i < dataArr.length; i ++)
		{
			sum += (dataArr[i][field][subfield] - mean) * (dataArr[i][field][subfield] - mean)
		}
		return {std : Math.sqrt(sum / dataArr.length), mean : mean};

	}
}

async function calculate(callback)
{
		await new Promise (function (resolve, reject)
		{
			item.find({invalid : false}, async function (err, allitems)
			{
				if (err)
				{
					console.log("couldnt fetch all item documents!");
					resolve();
					process.exit();
				}
				else
				{
					var allstats = [];
					for (var i = 0; i < allitems.length; i ++)
					{
						await new Promise (function(resolve, reject)
						{
							item.populate(allitems[i], [{path: "statdata"}], function (err, doc)
							{
								if (err)
								{
									console.log("couldn't populate!");
									process.exit();
								}
								else
								{
									allstats.push(doc.statdata);
									if (!doc.statdata.currentPrice || !doc.statdata.currentVolume || doc.statdata.currentPrice.price === undefined || doc.statdata.currentPrice.price === null || doc.statdata.currentVolume.volume === undefined || doc.statdata.currentVolume.volume === undefined)
									{
										console.log(doc.statdata);
										process.exit();
									}
									resolve();
								}
							});
						});
					}
					console.log("populating standardscore...");

					populateStandardScore(allstats, "currentPrice", "price");
					populateStandardScore(allstats, "currentVolume", "volume");
					allstats.forEach(function(item)
					{
						item.save();
					});
					resolve();
				}
			});
		});
		console.log(process.memoryUsage());

		if (typeof callback === "function")
		{
			callback();
		}
		console.log("finished calculations!");
		//process.exit();
}

module.exports = calculate;
