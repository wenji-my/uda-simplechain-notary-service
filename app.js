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
  console.log(body)
  if (!address || !star) {
    res.status(700).json({
      status: 700,
      desc: 'Parameter address and star both need'
    })
    return;
  }
  const { dec, ra, story} = star
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
  const isASCII = ((str) => /^[\x00-\x7F]*$/.test(str))
  if (!isASCII(story)) {
    res.status(700).json({
      status: 700,
      desc: "Your star story contains non-ASCII symbols"
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
  if (validate.messageSignature !== 'valid') {
    res.status(700).json({
      status: 700,
      desc: "Signature is not valid"
    })
    return;
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
  try {
    let validate = await StarValidation.getValidate(address);
    validate = JSON.parse(validate);
    const isExpired = Date.now() - validate.requestTimeStamp > validate.validationWindow * 1000;
    if (isExpired) {
      StarValidation.addRequestValidation(address, JSON.stringify(data));
    } else {
      data.validationWindow = Math.floor((validate.validationWindow * 1000 - (Date.now() - validate.requestTimeStamp)) / 1000);
    }
  } catch (error) {
    StarValidation.addRequestValidation(address, JSON.stringify(data));
  }
  res.json(data);
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
  let registerStar, status;
  try {
    let validate = await StarValidation.getValidate(address);
    validate = JSON.parse(validate);
    
    if (validate.messageSignature === 'valid') {
      res.json({
        registerStar: true,
        status: validate
      })
      return;
    }
    const isExpired = Date.now() - validate.requestTimeStamp > validate.validationWindow * 1000;
    if (isExpired) {
      registerStar = false;
      validate.messageSignature = 'invalid';
    } else {
      validate.validationWindow = Math.floor((validate.validationWindow * 1000 - (Date.now() - validate.requestTimeStamp)) / 1000);
      try {
        registerStar = bitcoinMessage.verify(validate.message, address, signature);
      } catch (error) {
        console.log(error)
        registerStar = false;
      }
      validate.messageSignature = registerStar ? 'valid' : 'invalid'
    }
    StarValidation.addRequestValidation(address,JSON.stringify(validate))
    res.json({
      registerStar: registerStar,
      status: validate
    })
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
