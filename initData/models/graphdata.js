require('dotenv').config();

var mongoose = require ("mongoose");


var graphDataSchema = new mongoose.Schema({
id : Number,
name : String,
priceData : [{date : Date, price : Number}],
volumeData : [{date : Date, volume : Number}]

});

var graphData = mongoose.model("graphdata", graphDataSchema);
module.exports = graphData;