import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apierror.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/Apiresponse.js";
export const registerUser = asyncHandler( async (req,res)=>{
   //get user details from frontend
   const {fullname,email,username,password} = req.body;
   
   //validation - not empty or zod validation
   if([fullname,email,username,password].some((field)=>field?.trim()==="")){
       throw new ApiError(400,"full name is required")
    }

   //check if user already exists:username,email
   const existedUser=await User.findOne({
    $or:[{username},{email}]
   })
   if(existedUser){
    throw new ApiError(409,"username or email already exists")
   }


   //check for images,check for avatar
   const avatarLocalPath=req.files?.avatar[0]?.path
   const coverIamgeLocalPath=req.files?.coverimage[0]?.path
   if(!avatarLocalPath){
    throw new ApiError(400,"avathar is required ")
   }

   //upload them to cloudnary,avatar
   const avatar =await  uploadOnCloudinary(avatarLocalPath)
   const coverImage = await uploadOnCloudinary(coverIamgeLocalPath)
   if(!avatar){
    throw new ApiError(400,"avathar is required ")
   }
   //create user object - create entry in db
   const user= await User.create({
    fullname,
    avatar:avatar.url,
    coverImage:coverImage?.url||"",
    email,
    password,
    username:username.toLowerCase()
   })
   //remove password and refresh token field from response
   
   const createdUser =await User.findById(
    user._id
   ).select(
    "-password -refreshToken"
   )
   //check for user creation
   if(!createdUser){
    throw new ApiError(500,"something went wrong in creating user")
   }
   
   //return res
   return res.status(201).json(
    new ApiResponse(200,createdUser,"user registerd successfully")
   )

}  )