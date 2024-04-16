export const asyncHandler=(requestHandler)=>{

    (req,re,next)=>{
        Promise.resolve(requestHandler(req,res,next)).catch((err)=>next(err))
    }

 }
// export const asyncHandler=(fn)=>async (req,res,next)=>{
//     try{
//         await fn(req,res,next)

//     }catch(err){
//         res.status(err.code||500).json({
//             success:false,
//             message:err.message
//         })
//     }


// }
