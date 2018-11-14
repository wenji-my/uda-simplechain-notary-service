const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const bitcoinMessage = require('bitcoinjs-message');

const Block = require('./block');
const Blockchain = require('./simpleChain');
const StarValidation = require('./starValidation');
const myBlockChain = new Blockchain();


app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

/**
 * Get star block by star block height with JSON response.
 */
app.get('/block/:height', async (req, res) => {
  let block = await myBlockChain.getBlock(req.params.height)
  if (block) {
    res.json(block);
  } else {
    res.status(700).json({
      status: 700,
      desc: "Block don't exist!"
    })
  }
})

/**
 * Web API Post Endpoint with JSON response.
 */
app.post('/block', async (req, res) => {
  const body = { address, star } = req.body
  const { dec, ra, story} = star
  if (!address || !star) {
    res.status(700).json({
      status: 700,
      desc: 'Parameter address and star both need'
    })
    return;
  }
  if (typeof dec !== 'string' || typeof ra !== 'string' || typeof story !== 'string' || !dec.length || !ra.length || !story.length) {
    res.status(700).json({
      status: 700,
      desc: "Your star information should include non-empty string properties 'dec', 'ra' and 'story'"
    })
    return;
  }
  if (new Buffer(story).length > 500) {
    res.status(700).json({
      status: 700,
      desc: "Your star story is too long. Maximum size is 500 bytes"
    })
    return;
  }
  let validate;
  try {
    validate = await StarValidation.getValidate(address)
  } catch (error) {
    res.status(700).json({
      status: 700,
      desc: error.message
    })
    return;
  }
  validate = JSON.parse(validate);
  let isValid = validate.isValid
  if (!isValid) {
    res.status(700).json({
      status: 700,
      desc: "Signature is not valid"
    })
    return;
  }

  body.star = {
    dec: star.dec,
    ra: star.ra,
    story: new Buffer(story).toString('hex'),
    mag: star.mag ? star.mag : '',
    con: star.con ? star.con : ''
  }
  await myBlockChain.addBlock(new Block(body));
  const height = await myBlockChain.getBlockHeight();
  const block = await myBlockChain.getBlock(height);
  await StarValidation.deleteValidate(address)
  res.json(block);
})

/**
 * Web API post endpoint validates request with JSON response.
 */
app.post('/requestValidation',async (req, res) => {
  if (!req.body.address) {
    res.status(700).json({
      status: 700,
      desc: 'Need the address parameter'
    })
    return;
  }
  const address = req.body.address;
  const requestTimeStamp = Date.now();
  const message = `${address}:${requestTimeStamp}:starRegistry`;
  const validationWindow = 300;
  const data = {
    address: address,
    requestTimeStamp: requestTimeStamp,
    message: message,
    validationWindow: validationWindow
  };
  StarValidation.addRequestValidation(address, JSON.stringify(data));
  res.json(data)
})

/**
 * Web API post endpoint validates message signature with JSON response.
 */
app.post('/message-signature/validate', async (req, res) => {
  if (!req.body.address || !req.body.signature) {
    res.status(700).json({
      status: 700,
      desc: 'Parameter address and signature both need'
    })
    return;
  }

  const { address, signature } = req.body;
  try {
    let validate = await StarValidation.getValidate(address);
    validate = JSON.parse(validate);
    validate.isValid = false
    
    const isExpired = Date.now() - validate.requestTimeStamp > validate.validationWindow * 1000
    if (validate.isValid) {
      res.json(validate)
      return;
    }
    if (isExpired) {
      validate.isValid = false
      validate.desc = 'Validation window was expired'
    } else {
      validate.validationWindow = Math.floor((validate.validationWindow * 1000 - (Date.now() - validate.requestTimeStamp)) / 1000)
      try {
        validate.isValid = bitcoinMessage.verify(validate.message, address, signature)
      } catch (error) {
        console.log(error)
      }
      validate.desc = validate.isValid ? 'Signature success' : 'Signature failure'
    }
    StarValidation.addRequestValidation(address,JSON.stringify(validate))
    res.json(validate)
  } catch (error) {
    res.status(701).json({
      status: 701,
      desc: 'service error'
    })
  }
})

/**
 * Get star block by wallet address (blockchain identity) with JSON response.
 */
app.get('/stars/address:address', async (req, res) => {
  try {
    const address = req.params.address.slice(1);
    const blocks = await myBlockChain.getBlocksByAddress(address);
    res.json(blocks)
  } catch (error) {
    res.status(700).json({
      status: 700,
      message: error.message
    })
  }
})

/**
 * Get star block by hash with JSON response.
 */
app.get('/stars/hash:hash', async (req, res) => {
  try {
    const hash = req.params.hash.slice(1);
    const block = await myBlockChain.getBlockByHash(hash);
    res.json(block)
  } catch (error) {
    res.status(700).json({
      status: 700,
      message: "Block don't exist!"
    })
  }
})

app.listen(8000, () => console.log('listening port 8000'))
