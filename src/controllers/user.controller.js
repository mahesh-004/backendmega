import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apierror.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/Apiresponse.js";
import jwt from "jsonwebtoken";

export const registerUser = asyncHandler( async (req,res)=>{
   //get user details from frontend
   const {fullname,email,username,password} = req.body;
   
   //validation - not empty or zod validation
   if([fullname,email,username,password].some((field)=>field?.trim()==="")){
       throw new ApiError(400,"full name is required")
   }

   //check if user already exists:username,email
   const existedUser= await User.findOne({
    $or:[{username},{email}]
   })
   if(existedUser){
    throw new ApiError(409,"username or email already exists")
   }


   //check for images,check for avatar
   const avatarLocalPath=req.files?.avatar[0]?.path
   //const coverIamgeLocalPath=req.files?.coverImage[0]?.path

   let coverIamgeLocalPath;
   if(req.files&&Array.isArray(req.files.coverImage)&& req.files.coverImage>0){
      coverImageLocalPath=req.files.coverImage[0].path
   }
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
    coverImage:coverImage?.url || "",
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


const generateAccessAndRefreshToken=async(userId)=>{
   try{
      const user=await User.findById(userId);
      const accessToken= user.generateAccessToken();
      const refreshToken=user.generateRefreshToken();

      user.refreshToken=refreshToken;
      await user.save({validateBeforeSave:false})

      return {accessToken,refreshToken}



   }catch(err){
      throw new ApiError(500,"something went wroong while generating refresh and access token")
   }

}


export const loginUser= asyncHandler(async (req,res)=>{
   //req body -> data
   const {email,username,password}=req.body;
   //username or email
   if(!username&&!email){
      throw new ApiError(400,"username or email is required");
   }
   
   //find the user
   const user= await User.findOne({
      $or:[{email},{username}]

   }) 

   if(!user){
      throw new ApiError(404,"user doesnot exits")
   }
   //password check
   const isPassswordValid=await user.isPasswordCorrect(password);

   if(!isPassswordValid){
      throw new ApiError(401,"password incoorect")
   }
   //access and refresh token generate
   const {refreshToken,accessToken}=await generateAccessAndRefreshToken(user._id);
    
   const loggedInUser=await User.findById(user._id).select(
      "-password -refreshToken"
   )
   //set in user system in cookies
   const options={
      httpOnly:true,
      secure:true
   }

   return res.status(200).cookie("accesToken",accessToken,options)
   .cookie("refreshToken",refreshToken,options)
   .json(
      new ApiResponse(
         200,
         {
            user:loggedInUser,accessToken,refreshToken
         },
         "User logged in successfully"

      )
   )


   
})

export const logoutUser=asyncHandler(async (req,res)=>{
   await User.findByIdAndUpdate(
      req.user._id,
      {
         $set:{
            refreshToken:undefined
         }
      },
      {
         new:true
      }
   );

   const options={
      httponly:true,
      secure:true
   }

   return res.status(200)
   .clearCookie("accessToken",options)
   .clearCookie("refreshToken",options)
   .json(new ApiResponse(200,{},"user logged ou"))
   

})

export const refreshAccessToken=asyncHandler(async(req,res)=>{
   const incomingRefreshToken=req.cookies.refreshToken||req.body.refreshToken;
   if(!incomingRefreshToken){
      throw new ApiError(401,"unauthorized user");

   }

   try {
      const decodeToken=await  jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET);
      const user=await User.findById(decodeToken._id);
      if(!user){
         throw new ApiError(401,"invalid refresh token");
   
      }
   
      if(incomingRefreshToken!==user?.refreshToken){
         throw new ApiError(401,"Refresh token is expired or  used ")
      }
   
      const options={
         httpOnly:true,
         secure:true
      }
   
      const {accessToken,newrefreshToken}=await generateAccessAndRefreshToken(user._id);
   
      return res.status(200)
      .cookie("accessToken",accessToken,options)
      .cookie("refreshToken",newrefreshToken,options)
      .json(
         new ApiResponse(
            200,
            {
               accessToken,refreshToken:newrefreshToken
            },
            "Access token refreshed"
         )
      )
   } catch (error) {
      throw new ApiError(401,error?.message ||"invalid refresh")
      
   }
})


export const  changeCurrentPassword=asyncHandler(async(req,res)=>{
    const {oldPassword ,newPassword}=req.body;

    const uer= await User.findById(req.user?._id);
    const isPasswordCorrect= await user.isPasswordCorrect(oldPassword);
    if(!isPasswordCorrect){
      throw new ApiError(400,"invalid old password")
    }
    user.password=newPassword;

    await user.save({validateBeforeSave:false})

    return res.status(200).json(
      new ApiResponse(200,{},"password Changed Succesfully")
    )
})


export const getCurrentUser=asyncHandler(async(req,res)=>{
   return res.status(200).json(
      new ApiResponse(200,req.user,
         "here is the requested user")
   )
})


export const updateAccountDetails=asyncHandler(async(req,res)=>{
   const {fullname,email}=req.body;

   if(!fullname||!email){
      throw new ApiError(400,"all fields are required")
   }

   const user=await User.findByIdAndUpdate(
      req.user?._id,
      {
         $set:{
            fullname,
            email
         }
         
      },
      {
         new:true
      }
   ).select("-password")

   return res.status(200)
   .json(
      new ApiResponse(200,user,"Account details uupdated successfully")
   )
});

export const updateUserAvatar=asyncHandler(async(req,res)=>{
   const avatarLocalPath=req.file?.path;

   if(!avatarLocalPath){
      throw new ApiError(400,"avatar file is missing")
   }

   const avatar=uploadOnCloudinary(avatarLocalPath);

   if(!avatar.url){
      throw new ApiError(400,"error while uploading on avatar")
   }

   await User.findByIdAndUpdate(req.user?._id,
   {
      $set:{
         avatar:avatar.url
      }

   },{
      new:true
   }
).select("-pasword")

return res.status(200).json(
   new ApiResponse(200,user,"updated avatar")
)



})

export const  updateUerCoverImage=asyncHandler(async(req,res)=>{
   const coverImageLocalPath=req.file?.path;

   if(!coverImageLocalPath){
      throw new ApiError(400,"cv  file is missing")
   }

   const coverImage=uploadOnCloudinary(avatarLocalPath);

   if(!coverImage.url){
      throw new ApiError(400,"error while uploading on avatar")
   }

   const user=await User.findByIdAndUpdate(req.user?._id,
   {
      $set:{
         coverImage:coverImage.url
      }

   },{
      new:true
   }
).select("-pasword")

   return res.status(200).json(
      new ApiResponse(200,user,"updated coverImage")
   )
})

export const getUserChannelProfile=asyncHandler(async(req,res)=>{
   const {username}=req.params;
   if(username?.trim()){
      throw new ApiError(400,"username is missing")
   }

   const channel=await User.aggregate([
      {
         $match:{
            username:username?.toLowerCase(),
         }

      },
      {
         $lookup:{
            from:"subscriptions",
            localField:_id,
            foreignField:"channel",
            as:"subscribers"
         }
      },
      {
         $lookup:{
            from:"subscriptions",
            localField:_id,
            foreignField:"subscriber",
            as:"subscribedto"

         }
      },
      {
         $addFields:{
            subscribersCount:{
               $size:"$subscribers"
            },
            channelsSubscribedToCount:{
               $size:"$subscribedto"
            },
            isSubscribed:{
               $cond:{
                  if:{$in:[req.user?._id,"$subscribers.subscriber"]},
                  then:true,
                  else:false
               }
            }
         }
      },
      {
         $project:{
            fullname:1,
            uername:1,
            subscribersCount:1,
            channelsSubscribedToCount:1,
            isSubscribed:1,
            avatar:1,
            coverImage:1,
            email:1,

         }
      }
   ])
   if(!channel?.length){
      throw new ApiError(404,"channel does not exists");
   }

   return res.status(200)
   .json(
      new ApiResponse(200,channel[0],"user channel fetched successfully")
   )
})

