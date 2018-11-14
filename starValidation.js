'use strict';
const db = require('level')('./data/star');

class StarValidation {
  
  static async addRequestValidation(address, value) {
    return new Promise((resolve, reject) => {
      db.put(address, value, function(err) {
        if (err) {
          reject(err)
        } else {
          resolve(value)
        }
      })
    })
  }

  static async getValidate(address) {
    return new Promise((resolve, reject) => {
      db.get(address, function(err, value) {
        if (err) {
          reject(err)
        } else {
          resolve(value)
        }
      })
    })
  }

  static async deleteValidate(address) {
    return new Promise((resolve, reject) => {
      db.del(address, function(err) {
        if (err) {
          reject(err)
        } else {
          resolve(true)
        }
      })
    })
  }
}

module.exports = StarValidation
