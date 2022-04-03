const chai = require("chai");
const chaiHttp = require("chai-http");
const server = require("../index");
const { nanoid } = require('nanoid')
chai.should();
chai.use(chaiHttp);

create_id = '';
expire_id = '';

function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
  
describe('Test API', () => {

    describe('Upload URL API test', () =>{
        it("succeed test", (done) => {
            const task = {
                "url" : "https://drive.google.com/file/d/1AreBiHDUYXH6MI5OqWpKP-f6-W0zA8np/view",
                "expireAt" : "2023-02-08T09:20:41Z"
            };
            chai.request(server)
                .post('/url_shortener')
                .send(task)
                .end((err, res) =>{
                        res.should.have.status(201);
                        res.should.be.json;
                        res.body.should.have.all.keys(['id', 'shortUrl'])
                        res.body.id.length.should.be.eq(6)
                        create_id = res.body.id
                    done();
                })
        })

        it("invalid time test", (done) => {
            const task = {
                "url" : "https://drive.google.com/file/d/1AreBiHDUYXH6MI5OqWpKP-f6-W0zA8np/view",
                "expireAt" : "2020-02-08T09:20:41Z"
            };
            chai.request(server)
                .post('/url_shortener')
                .send(task)
                .end((err, res) =>{
                        res.should.have.status(400);
                        res.should.be.json;
                        res.body.should.have.key('error')
                        res.body.error.should.be.eq('invalid expire time')
                    done();
                })
        })

        it("invalid url test", (done) => {
            const task = {
                "url" : "this/is/a/invalid/url",
                "expireAt" : "2023-02-08T09:20:41Z"
            };
            chai.request(server)
                .post('/url_shortener')
                .send(task)
                .end((err, res) =>{
                        res.should.have.status(400);
                        res.should.be.json;
                        res.body.should.have.key('error')
                        res.body.error.should.be.eq('invalid url')
                    done();
                })
        })
    })


    describe('REDIRECT URL API test', () =>{

        
        it("suceed test", (done) => {
            chai.request(server)
                .get('/url_shortener/' + create_id)
                .end((err, res) =>{
                        res.should.have.status(200);
                    done();
                })
        })

        it("invalid url test case1", (done) => {
            chai.request(server)
                .get('/url_shortener/qweqwfHBFHD123')
                .end((err, res) =>{
                        res.should.have.status(404);
                        res.text.should.be.eq('not found');
                    done();
                })
        })

        dummy_id =  nanoid(6);
        while(dummy_id == create_id){dummy_id = nanoid(6)}
        
        it("invalid url test case2", (done) => {
            chai.request(server)
                .get('/url_shortener/'+dummy_id)
                .end((err, res) =>{
                        res.should.have.status(404);
                        res.text.should.be.eq('not found');
                    done();
                })
        })

        // create dummy
        const new_time = new Date(new Date().getTime() + 5000);
        it("create url for expire test", (done) => {
            const task = {
                "url" : "https://drive.google.com/file/d/1AreBiHDUYXH6MI5OqWpKP-f6-W0zA8np/view",
                "expireAt" : new_time.toISOString()
            };
            chai.request(server)
                .post('/url_shortener')
                .send(task)
                .end((err, res) =>{
                    expire_id = res.body.id
                    done();
                })
        })

        it("wait for url to expire", async () => {
             // sleep for 5 sec
             var count = 5
             while(count){
                 console.log(`wait for ${count} seconds`);
                 await sleep(1000);
                 count--;
             }
        })
         
        it("exipre url test", (done) => {
            chai.request(server)
                .get('/url_shortener/'+expire_id)
                .end((err, res) =>{
                        res.should.have.status(404);
                        res.text.should.be.eq('not found');
                    done();
                })
        })
      
    })


    

})