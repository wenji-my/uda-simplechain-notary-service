/* ===== SHA256 with Crypto-js ===============================
|  Learn more: Crypto-js: https://github.com/brix/crypto-js  |
|  =========================================================*/
'use strict';
const Block = require('./block');
const SHA256 = require('crypto-js/sha256');
const db = require('level')('./data/chain')

/* ===== Blockchain Class ==========================
|  Class with a constructor for new blockchain 		|
|  ================================================*/

class Blockchain{
  constructor(){
    this.getBlockHeight().then((height) => {
      if (height === -1) {
        this.addBlock(new Block('Genesis block')).then(() => console.log('Genesis block added!'))
      }
    });
  }

  // Add new block
  async addBlock(newBlock){
    // Block height
    const height = parseInt(await this.getBlockHeight());
    newBlock.height = height + 1;
    // UTC timestamp
    newBlock.time = new Date().getTime().toString().slice(0,-3);
    // previous block hash
    if(newBlock.height>0){
      const prevBlock = await this.getBlock(height);
      newBlock.previousBlockHash = prevBlock.hash;
      console.log('previousBlockHash',newBlock.previousBlockHash)
    }
    // Block hash with SHA256 using newBlock and converting to a string
    newBlock.hash = SHA256(JSON.stringify(newBlock)).toString();
    // Adding block to db
    await this.addBlockToDB(newBlock.height,JSON.stringify(newBlock).toString())
  }

  // Get block height
    async getBlockHeight(){
      return await this.getBlockHeightFromDB()
    }

    // get block
    async getBlock(blockHeight){
      try {
        let blockJson = await this.getBlockToDB(blockHeight)
        return JSON.parse(blockJson);
      } catch (error) {
        return null
      }
    }

    // validate block
    async validateBlock(blockHeight){
      // get block object
      let block = await this.getBlock(blockHeight);
      // get block hash
      let blockHash = block.hash;
      // remove block hash to test block integrity
      block.hash = '';
      // generate block hash
      let validBlockHash = SHA256(JSON.stringify(block)).toString();
      // Compare
      if (blockHash === validBlockHash) {
          return true;
        } else {
          console.log('Block #'+blockHeight+' invalid hash:\n'+blockHash+'<>'+validBlockHash);
          return false;
        }
    }

   // Validate blockchain
    async validateChain(){
      // get chain within the LevelDB
      this.chain = await this.getDataArray();
      let errorLog = [];
      for (var i = 0; i < this.chain.length-1; i++) {
        // validate block
        if (!this.validateBlock(i))errorLog.push(i);
        // compare blocks hash link
        let blockHash = this.chain[i].hash;
        let previousHash = this.chain[i+1].previousBlockHash;
        if (blockHash!==previousHash) {
          errorLog.push(i);
        }
      }
      if (errorLog.length>0) {
        console.log('Block errors = ' + errorLog.length);
        console.log('Blocks: '+errorLog);
      } else {
        console.log('No errors detected');
      }
    }

    async getBlocksByAddress(address) {
      let blocks = [];
      return new Promise((resolve, reject) => {
        db.createReadStream().on('data', function(data) {
            if (data.key !== 0) {
              let block = JSON.parse(data.value);
              if (block.body.address === address) {
                block.body.star.storyDecoded = new Buffer(block.body.star.story, 'hex').toString();
                blocks.push(block);
              }
            }
          }).on('error', function(err) {
            reject(err)
          }).on('close', function() {
            resolve(blocks)
          });
      })
    }

    async getBlockByHash(hash) {
      let block;
      return new Promise((resolve, reject) => {
        db.createReadStream().on('data', function(data) {
          block = JSON.parse(data.value);
          if (block.hash === hash) {
            if (data.key !== 0) {
              block.body.star.storyDecoded = new Buffer(block.body.star.story, 'hex').toString();
            }
            return resolve(block);
          }
          }).on('error', function(err) {
            reject(err)
          }).on('close', function() {
            reject("Block don't exist!")
          });
      })
    }

    // Add data to levelDB with key/value pair
    async addBlockToDB(key, value){
      return new Promise((resolve, reject) => {
        db.put(key, value, function(err) {
          if (err) {
            reject(err)
          } else {
            console.log(`Add Block #${key} success`)
            resolve(`Add Block #${key} success`)
          }
        })
      })
    }

    // Get data from levelDB with key
    async getBlockToDB(key){
      return new Promise((resolve, reject) => {
        db.get(key, function(err, value) {
          if (err) {
            reject(err)
          } else {
            resolve(value)
          }
        })
      })
    }

    async getBlockHeightFromDB() {
      return new Promise((resolve, reject) => {
        let height = -1;
        db.createReadStream().on('data', function(data) {
            height++;
            }).on('error', function(err) {
              reject(err)
            }).on('close', function() {
              resolve(height)
            });
      })
    }

    async getDataArray() {
      let dataArray = [];
      return new Promise((resolve, reject) => {
        db.createReadStream().on('data', function(data) {
              dataArray.push(data)
            }).on('error', function(err) {
              reject(err)
            }).on('close', function() {
              resolve(dataArray)
            });
      })
    }
}

module.exports = Blockchain
