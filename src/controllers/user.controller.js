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
   if(!username||!email){
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
      httponly:true,
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