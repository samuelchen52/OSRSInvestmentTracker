var item = require("./models/item.js");
var graphdata = require("./models/graphdata.js");
var statdata = require("./models/statdata.js");

var mongoose = require("mongoose");
mongoose.connect('mongodb://localhost:27017/getracker', {useNewUrlParser: true});






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
						process.exit();
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

						stat.currentPrice = priceData[priceData.length - 1].price;
						stat.averagePrice = totalPrice / priceData.length;
						stat.minPrice = minPrice;
						stat.maxPrice = maxPrice;

						stat.currentVolume = volumeData[volumeData.length - 1].volume;
						stat.averageVolume = totalVolume / volumeData.length;

						stat.averageNegativePriceChange = negativeTrend.numDays === 0 ? 0 : totalNegativePriceChange / negativeTrend.numDays;
						stat.averagePositivePriceChange = positiveTrend.numDays === 0 ? 0 : totalPositivePriceChange / positiveTrend.numDays;


						stat.save();
						//allitems[i] = null; //doesnt work for some reason, have to do this outside of the promise
						console.log("stats calculated for " + doc.name + " with id of " + doc.id);
						//console.log(process.memoryUsage());
						resolve();
					}
				});
			});
			allitems[i] = null;
		}
		callback();
		console.log("finished calculations!");
		//process.exit();
}

module.exports = calculate;

if (process.argv.length > 2)
{
	populate();
}