const mongoose = require('mongoose');
const dotenv = require('dotenv')
dotenv.config();

const connectionToDatabase = async () =>{
    try {
        await mongoose.connect(process.env.CONNECTION_STRING,{
            useNewUrlParser : true,
            useUnifiedTopology : true,
            dbName: 'showBooker'
        });
        console.log("Dtabase connection is ready !!!")
    } catch (error) {
       console.log("Database connection error :",error)
    }
}

module.exports = {
    connectionToDatabase,
}