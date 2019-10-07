require('dotenv').config();

var item = require("./models/item.js");
var graphdata = require("./models/graphdata.js");
var statdata = require("./models/statdata.js");

var mongoose = require("mongoose");
mongoose.connect(process.env.MONGODB_URI ||'mongodb://localhost:27017/getracker', {useNewUrlParser: true});





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

async function calculate(allitems, callback)
{
	for (var i = 0; i < allitems.length; i ++)
		{
			await new Promise (function (resolve, reject)
			{
				item.populate(allitems[i], [{path: "graphdata statdata"}], function (err, doc)
				{
					if (err)
					{
						console.log("document with id of " + allitems[i].id + " at index " + i + " had trouble populating!");
						console.log(err);
						//console.dir(documentarr[start]);
						resolve();
					}
					else
					{
						var stat = doc.statdata; 
						var graph = doc.graphdata; 

						var priceData = graph.priceData.length === 0 ? [{price : 0, date : new Date()},{price : 0, date : new Date()}] : graph.priceData;
						var volumeData = graph.volumeData.length === 0 ? [{volume : 0, date : new Date()},{volume : 0, date : new Date()}] : graph.volumeData;

						var currentTrend = helper(priceData[0].price, priceData[1].price);
						var currentTrendDuration = 1;

						var neutralTrend = {totalDuration : 0, numDuration: 0};
						var positiveTrend = {totalDuration : 0, numDuration: 0, numDays: 0};
						var negativeTrend = {totalDuration : 0, numDuration: 0, numDays: 0};
						var Durations = {};
						Durations[0] = neutralTrend;
						Durations[-1] = negativeTrend;
						Durations[1] = positiveTrend;

						//var currentPrice = priceData[priceData.length - 1].price;
						var totalPrice = priceData[priceData.length - 1].price;

						//var currentVolume = volumeData[volumeData.length - 1].volume;
						var totalVolume = 0;

						var maxPrice = priceData[0].price;
						var minPrice = priceData[0].price;

						var totalNegativePriceChange = currentTrend === -1 ? priceData[1].price - priceData[0].price : 0;
						var totalPositivePriceChange = currentTrend === 1 ? priceData[1].price - priceData[0].price : 0;

						for (var i = 0; i < priceData.length - 1; i ++)
						{
							totalPrice += priceData[i].price;
							maxPrice = Math.max(maxPrice, priceData[i].price);
							minPrice = Math.min(minPrice, priceData[i].price);
							switch (helper(priceData[i].price, priceData[i + 1].price))
							{
								case 0:
									if (currentTrend !== 0)
									{
										Durations[currentTrend].totalDuration += currentTrendDuration;
										Durations[currentTrend].numDuration += 1;

										currentTrend = 0;
										currentTrendDuration = 1;
									}
									else
									{
										currentTrendDuration += 1;
									}
									break;
								case -1:
									if (currentTrend !== -1)
									{
										Durations[currentTrend].totalDuration += currentTrendDuration;
										Durations[currentTrend].numDuration += 1;

										currentTrend = -1;
										currentTrendDuration = 1;
										negativeTrend.numDays += 1;
										totalNegativePriceChange += (priceData[i + 1].price - priceData[i].price);
									}
									else
									{
										currentTrendDuration += 1;
										negativeTrend.numDays += 1;
										totalNegativePriceChange += (priceData[i + 1].price - priceData[i].price);
									}
									break;
								case 1:
									if (currentTrend !== 1)
									{
										Durations[currentTrend].totalDuration += currentTrendDuration;
										Durations[currentTrend].numDuration += 1;

										currentTrend = 1;
										currentTrendDuration = 1;
										positiveTrend.numDays += 1;
										totalPositivePriceChange += (priceData[i + 1].price - priceData[i].price);
									}
									else
									{
										currentTrendDuration += 1;
										positiveTrend.numDays += 1;
										totalPositivePriceChange += (priceData[i + 1].price - priceData[i].price);
									}
									break;
							}
						}

						for (var i = 0; i < volumeData.length; i ++)
						{
							totalVolume += volumeData[i].volume;
						}

						stat.currentTrend = currentTrend === 0 ? "neutral" : (currentTrend === 1 ? "positive" : "negative");
						stat.currentTrendDuration = currentTrendDuration;

						stat.averageNeutralTrendDuration = neutralTrend.numDuration === 0 ? 0 : neutralTrend.totalDuration / neutralTrend.numDuration;
						stat.averagePositiveTrendDuration = positiveTrend.numDuration === 0 ? 0 : positiveTrend.totalDuration / positiveTrend.numDuration;
						stat.averageNegativeTrendDuration = negativeTrend.numDuration === 0 ? 0 : negativeTrend.totalDuration / negativeTrend.numDuration;

						stat.currentPrice.price = priceData[priceData.length - 1].price;
						stat.averagePrice = totalPrice / priceData.length;
						stat.minPrice = minPrice;
						stat.maxPrice = maxPrice;

						stat.currentVolume.volume = volumeData[volumeData.length - 1].volume;
						stat.averageVolume = totalVolume / volumeData.length;

						stat.averageNegativePriceChange = negativeTrend.numDays === 0 ? 0 : totalNegativePriceChange / negativeTrend.numDays;
						stat.averagePositivePriceChange = positiveTrend.numDays === 0 ? 0 : totalPositivePriceChange / positiveTrend.numDays;


						stat.save();
						//allitems[i] = null; //doesnt work for some reason, have to do this outside of the promise
											  //found the bug, looks like this i is NOT referencing the outer loop i
											  //the i it was referecing was the i in the volumedata loop
						console.log("stat data calculated for " + doc.name + " with id of " + doc.id);
						//console.log(process.memoryUsage());
						resolve();
					}
				});
			});
			//cant seem to clean up graphdata from the object, forced to reretrieve the entire statdatas collection below
			allitems[i] = null;
		}

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

		if (typeof callback === "function")
		{
			callback();
		}
		console.log("finished calculations!");
		//process.exit();
}

module.exports = calculate;
