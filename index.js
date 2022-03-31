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

const urlencodedParser = bodyParser.urlencoded({ extended: false })


const port = 3000
redisClient.connect()



app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})




function checkValidTime(expireAt){
   now = new Date();
   expire = new Date(expireAt);
   return expire >= now;
}


app.post("/url_shortener", urlencodedParser, async(req, res)=>{
  try{
    
      const {url, expireAt} = req.body;

      if(!checkValidTime(expireAt)){
        return res.json({"error" : "url should expire at future"});
      }

      if(!validUrl.isUri(url)){
        return res.json({"error" : "invalid url"});
      }
      
      var short_id = ''

      // avoid duplicate shortid
      while(true){
        short_id = await nanoid(6);
        const prefix = short_id.substring(0,3);
        // search if possible collision on cache
        cachePrefix = await redisClient.HGET('pre', prefix);

        if(cachePrefix == null || cachePrefix == '0'){
          console.log('safe prefix');
          await redisClient.HSET('pre', prefix, 1);
          break;
        }

       const Mapping = await pool.query("select * from url_mapping where id = $1",
       [short_id]);
       
       if(!Mapping.rows.length){
         console.log('safe short_id');
         newCount = parseInt(cachePrefix) + 1;
         await redisClient.HSET("pre", prefix, newCount);
         break;
       }
      }

      const newMapping = await pool.query("INSERT INTO url_mapping (id, org_url, expire) VALUES ($1, $2, $3) RETURNING *",
       [short_id, url, expireAt]);

      redisClient.set(short_id, url+'_'+String(expireAt),
        {EX : 3600});
      return res.json({
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

      if(id.length != 6){
        return  res.status(404).send("not founded");
      }

      const prefix = id.substring(0,3);
      const cachePrefix = await redisClient.HGET('pre', prefix);

      if(cachePrefix == null || cachePrefix == '0'){
        return res.status(404).send("not founded");
      }


      cacheRow = await redisClient.get(id);

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

          return res.status(404).send("not founded");
        }


        return res.json({
            'url' : url,
            'expireAt' : expireAt
        })

         // return res.redirect(301, Mapping.rows[0].org_url);
      }
      
      const Mapping = await pool.query("select * from url_mapping where id = $1",
       [id]);
       
      if(!Mapping.rows.length){
        return  res.status(404).send("not founded");
      }

      expireAt = new Date(Mapping.rows[0].expire)
      org_url = Mapping.rows[0].org_url

      if(!checkValidTime(expireAt)){
        // subtact prefix count in redis
        newCount = parseInt(cachePrefix - 1);
        redisClient.HSET('pre', prefix, newCount);

        // remove from DB
        await pool.query("DELETE FROM url_mapping WHERE id = $1",
          [id]);

        return res.status(404).send("not founded");
      }

     
      await redisClient.set(id, org_url+'_'+String(expireAt), 
      {EX: 3600})

      return res.send('get mapping from DB')
      //res.redirect(301, Mapping.rows[0].org_url);

  } catch(err){
      console.log(err);
      return 
  }
})