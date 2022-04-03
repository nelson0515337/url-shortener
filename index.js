const express = require('express');
const res = require('express/lib/response');
const app = express()
const pool = require('./db');
const validUrl = require('valid-url');
const { nanoid } = require('nanoid/async')
const { json } = require('express/lib/response');
const Redis = require('redis');
const bodyParser = require('body-parser');
const redisClient = Redis.createClient();

//const urlencodedParser = bodyParser.urlencoded({ extended: false })
app.use(bodyParser.text({type: '*/*'}))

const port = 3000
redisClient.connect()



app.listen(port, () => {
  console.log(`app listening on port ${port}`)
})




function checkValidTime(expireAt){
   now = new Date();
   expire = new Date(expireAt);
   //console.log(now);
   //console.log(expire);
   return expire >= now;
}


app.post("/url_shortener", async(req, res)=>{
  try{

      const {url, expireAt} = JSON.parse(req.body);
      // error checking
      if(!validUrl.isUri(url)){
        return res.status(400).json({"error" : "invalid url"});
      }

      if(!checkValidTime(expireAt)){
        return res.status(400).json({"error" : "invalid expire time"});
      }
      
      var short_id = '';

      // avoid duplicate shortid
      while(true){
        short_id = await nanoid(6);
        const prefix = short_id.substring(0,3);
        // search if possible collision on cache
        cachePrefix = await redisClient.HGET('pre', prefix);

        if(cachePrefix == null || cachePrefix == '0'){
          // console.log('safe prefix');
          await redisClient.HSET('pre', prefix, 1);
          break;
        }

       const Mapping = await pool.query("select * from url_mapping where id = $1",
       [short_id]);
       
       if(!Mapping.rows.length){
         // console.log('safe short_id');
         newCount = parseInt(cachePrefix) + 1;
         await redisClient.HSET("pre", prefix, newCount);
         break;
       }
      }

      const newMapping = await pool.query("INSERT INTO url_mapping (id, org_url, expire) VALUES ($1, $2, $3) RETURNING *",
       [short_id, url, expireAt]);

      redisClient.set(short_id, url+'_'+expireAt,
        {EX : 3600});
      return res.status(201).json({
        "id" : short_id,
        "shortUrl" : "localhost:"+ String(port) + "/url_shortener/" + short_id
      });
      
  } catch(err){
      console.log(err);
      return;
  }
})


app.get("/url_shortener/:id", async(req, res)=>{
  try{
      const {id} = req.params;

      //fast response on non-exsistent url

      if(id.length != 6){
        return  res.status(404).send("not found");
      }

      const prefix = id.substring(0,3);
      const cachePrefix = await redisClient.HGET('pre', prefix);

      if(cachePrefix == null || cachePrefix == '0'){
        return res.status(404).send("not found");
      }


      cacheRow = await redisClient.get(id);

      // cache hit !!!

      if(cacheRow !== null){
        flag = cacheRow.lastIndexOf('_');
        var url = cacheRow.substr(0, flag);
        var expireAt = cacheRow.substr(flag+1);

        if(!checkValidTime(expireAt)){
          // subtact prefix count in redis
          newCount = parseInt(cachePrefix - 1);
          redisClient.HSET('pre', prefix, newCount);

          // remove from cache 
          redisClient.DEL(id);

          // remove from DB
          await pool.query("DELETE FROM url_mapping WHERE id = $1",
          [id]);

          return res.status(404).send("not found");
        }
        return res.status(200).redirect(url);
      }
      
      // query main storage

      const Mapping = await pool.query("select * from url_mapping where id = $1",
       [id]);
       
      if(!Mapping.rows.length){
        return  res.status(404).send("not founded");
      }

      expireAt = new Date(Mapping.rows[0].expire).toISOString()
      url = Mapping.rows[0].org_url

      if(!checkValidTime(expireAt)){
        // subtact prefix count in redis
        newCount = parseInt(cachePrefix - 1);
        redisClient.HSET('pre', prefix, newCount);

        // remove from DB
        await pool.query("DELETE FROM url_mapping WHERE id = $1",
          [id]);

        return res.status(404).send("not founded");
      }

      await redisClient.set(id, url+'_'+(expireAt), 
      {EX: 3600})

      return res.status(200).redirect(url);

  } catch(err){
      console.log(err);
      return 
  }
})

module.exports = app;