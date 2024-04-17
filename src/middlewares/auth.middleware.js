import { ApiError } from "../utils/apierror";
import { asyncHandler } from "../utils/asyncHandler";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model";
export const verifyJWT= asyncHandler(async(req,re,next)=>{
    try{
        const token=req.cookies?.accessToken ||req.header("Authorization")?.replace("Bearer ","");
    
    if(!token){
        throw new ApiError(401,"unauthorized request");
    }

    const decodedToken=jwt.verify(token,process.env.ACCESS_TOKEN_SECRET);

    const user = await User.findById(decodedToken?._id).select(
        "-password -refreshToken"
    )
    if(!user){
        //discuss about frontend
        throw new ApiError(401,"invalid Access Token")
    }

    req.user=user;
    next();

    }catch(err){
        throw new ApiError(401,error?.message||"inavlid access")

    }
    

})