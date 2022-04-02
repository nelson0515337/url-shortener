const chai = require("chai");
const chaiHttp = require("chai-http");
const server = require("../index");
const { nanoid } = require('nanoid')
chai.should();
chai.use(chaiHttp);

create_id = '';

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
        it("seceed test", (done) => {
            chai.request(server)
                .get('/url_shortener/' + create_id)
                .end((err, res) =>{
                        res.should.have.status(200);
                    done();
                })
        })

        it("invalid url case1", (done) => {
            chai.request(server)
                .get('/url_shortener/qweqwfHBFHD123')
                .end((err, res) =>{
                        res.should.have.status(404);
                        res.text.should.be.eq('not found');
                    done();
                })
        })

        
        it("invalid url case2", (done) => {
            dummy =  nanoid(6);
            while(dummy == create_id){dummy = nanoid(6)}
            chai.request(server)
                .get('/url_shortener/dummy')
                .end((err, res) =>{
                        res.should.have.status(404);
                        res.text.should.be.eq('not found');
                    done();
                })
        })
    })
    

})