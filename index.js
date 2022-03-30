const express = require('express');
const res = require('express/lib/response');
const app = express()
app.use(express.json()); //for API req.body
const pool = require('./db');
const validUrl = require('valid-url');
const { nanoid } = require('nanoid/async')
const { json } = require('express/lib/response');
const Redis = require('redis');
const redisClient = Redis.createClient();

const port = 3000
redisClient.connect()



app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})


app.get("/", async(req, res) =>{
  const id = await nanoid(10);
  res.send(id);
})


app.post("/url_shortener", async(req, res)=>{
  try{
    
      const {url, expireAt} = req.body;
      const now = new Date();
      const expireTime = new Date(expireAt);
      //console.log(now);
      //console.log(expireTime);
      if(expireTime < now){
        return res.json({"error" : "url should expire at future"});
      }
      if(!validUrl.isUri(url)){
        return res.json({"error" : "invalid url"});
      }
      const short_id = await nanoid(10);
      const newMapping = await pool.query("INSERT INTO url_mapping (id, org_url, expire) VALUES ($1, $2, $3) RETURNING *",
       [short_id, url, expireAt]);
      return res.json({
        "id" : short_id,
        "shortUrl" : "localhost:"+ String(port) + "/url_shortener/" + short_id
      });
  } catch(err){
      console.log(err);
  }
})


app.get("/url_shortener/:id", async(req, res)=>{
  try{
      const {id} = req.params;
      
      cacheUrl = await redisClient.get(id);
      if(cacheUrl !== null){
        console.log(cacheUrl);
        return res.send('cache hit !!!')
      }
      
      const now = new Date();
      const Mapping = await pool.query("select * from url_mapping where id = $1",
       [id]);
       
      if(!Mapping.rows.length || Mapping.rows[0].expire < now){
        return  res.status(404).send("not founded");
      }

      const expire = new Date(Mapping.rows[0].expire)
      const org_url = Mapping.rows[0].org_url

      await redisClient.set(id, org_url, {
        EX: Math.round((expire.getTime() - now.getTime())/1000)
      })
      return res.send('get mapping from DB')
      //res.redirect(301, Mapping.rows[0].org_url);
  } catch(err){
      console.log(err);
      return 
  }
})