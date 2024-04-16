import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

export  const connectDB= async ()=>{
    try{
        const connectionInstance=await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`);
        console.log(`MongoDb connected  DB HOST:${connectionInstance.connection.host} `);


    }catch(err){
        consolee.log("MONGODB connection failed",err);
        process.exit(1)
    }
}