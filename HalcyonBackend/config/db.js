const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
const connectToDb = async() =>{
  try{
    await mongoose.connect(process.env.MONGODB_URL);
    console.log(`Connected to MongoDB`);

  }catch(err){
    console.log(err);
  }
}

module.exports = connectToDb;