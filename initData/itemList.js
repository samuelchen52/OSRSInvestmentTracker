//exports list of items for initItemData.js

//https://www.osrsbox.com/osrsbox-db/items-json/2.json
//https://www.osrsbox.com/osrsbox-db/items-complete.json

//update database with any new items
//remove obsolete items from database - only needed if we have initialized database already

const request = require("request");
var fs = require("fs");

async function stream (url, id, folder, callback)
{
  request(url).pipe(fs.createWriteStream('../public/images/' + folder +'/' + id + '.gif'))
}

//stream("http://services.runescape.com/m=itemdb_oldschool/.gif?id=2", 2, "test");

//callback will be resolve function from caller
async function getItemList (callback)
{ 
  let allItemsURL = "https://www.osrsbox.com/osrsbox-db/items-complete.json";
  let GEItems = null;

  while (!GEItems)
  {
    await new Promise (function (resolve, reject)
    {
      request(allItemsURL, function(error, response, body)
      {
        if (!(error || response.statusCode !== 200))
        {
          console.log("getting all GE items...")
          let allItems = JSON.parse(body);
          GEItems = [];
          for (let itemid in allItems)
          {
            if (allItems[itemid].tradeable_on_ge)
            {
              GEItems.push(allItems[itemid]);
            }
          }
          if (typeof callback === "function")
          {
            callback(GEItems);
          }
        }
        resolve();
      });
    });
  }
}

module.exports = getItemList;