var jsonfile = require('jsonfile')
var file = __dirname+'/drazerdex.json'
var drazerdb = require('../../../../src/_pages/game/dragon_blaze/db')
var weeklyTopRank = require('../../../../src/_pages/game/dragon_blaze/db/weekly-top-ranker-kr')

// write JSON files
jsonfile.writeFile(file, drazerdb, function (err) {
  if(err) return console.error(err)
  console.log('DONE DB JSON')
})


// write JSON files
jsonfile.writeFile(__dirname+'/weeklyTopRankKr.json', weeklyTopRank, function (err) {
  if(err) return console.error(err)
  console.log('DONE WEEKLY JSON')
})
