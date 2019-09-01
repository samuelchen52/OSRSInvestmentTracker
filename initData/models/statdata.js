var mongoose = require ("mongoose");

//sort by price, something with trend, amount traded, profit margin if available
//option to only include members only
var statDataSchema = new mongoose.Schema({
id : Number,
name : String,

currentTrend : String, //positive, negative, neutral
currentTrendDuration: Number, //number of days current trend has been going

averageNeutralTrendDuration: Number,
averagePositiveTrendDuration: Number,
averageNegativeTrendDuration: Number,

currentPrice : {price : Number, score : Number},
averagePrice : Number,
maxPrice : Number,
minPrice : Number,
currentVolume : {volume : Number, score : Number},
averageVolume : Number,

averageNegativePriceChange : Number, //day to day
averagePositivePriceChange : Number //day to day
//profitMargin : Number, //can really only determine through going in game and checking manually


});

var statData = mongoose.model("statdata", statDataSchema);
module.exports = statData;