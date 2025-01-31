import userModel from "../models/userModel.js";
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import transactionModel from "../models/transactionModel.js";

import Stripe from 'stripe'

const registerUser = async(req,res)=> {
    try{
        const {name,email,password} = req.body;

        if(!name || !email || !password){
            return res.json({success:false,message:'Missing Details'})
        }

        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password,salt)

        const userData = {
            name,
            email, 
            password : hashedPassword
        }

        const newUser = new userModel(userData)
        const user = await newUser.save()

        const token = jwt.sign({id: user._id}, process.env.JWT_SECRET)

        res.json({success:true,token,user:{name: user.name}})

    }catch(error){
        console.log(error)
        res.json({success:false, message : error.message})

    }
}


const loginUser = async(req,res) =>{
     try{
        const {email,password }= req.body;
        const user= await userModel.findOne({email})

        if(!user){
            return res.json({success:false,message:'User does not exist'})
         }

         const isMatch = await bcrypt.compare(password, user.password)

         if(isMatch){
            const token = jwt.sign({id: user._id}, process.env.JWT_SECRET)

            res.json({success:true,token,user:{name: user.name}})

         }else{
            return res.json({success:false,message:'Invalid Credentials'})
         }

     }catch(error){
        console.log(error)
        res.json({success:false, message : error.message})

     }
}

const userCredits =async(req,res)=>{
    try{
       const {userId} = req.body;

       const user = await userModel.findById(userId)
       res.json({success:true,credits : user.creditBalance, user: {name: user.name}})

    }catch(error){
        console.log(error)
        res.json({success:false, message : error.message})        

    }
}

const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY);

const paymentStripe = async (req, res) => {
  try {
    const { userId, planId } = req.body;

    if (!userId || !planId) {
      return res.json({ success: false, message: 'Missing Details' });
    }

 
    const userData = await userModel.findById(userId);
    if (!userData) {
      return res.json({ success: false, message: 'User not found' });
    }

   
    let credits, plan, amount;

    switch (planId) {
      case 'Basic':
        plan = 'Basic';
        credits = 100;
        amount = 10; 
        break;

      case 'Advanced':
        plan = 'Advanced';
        credits = 500;
        amount = 50; 
        break;

      case 'Business':
        plan = 'Business';
        credits = 5000;
        amount = 250; 
        break;

      default:
        return res.json({ success: false, message: 'Plan Not Found' });
    }

  
    const transactionData = {
      userId,
      plan,
      amount,
      credits,
      date: Date.now(),
      paymentStatus: false,
    };
    const newTransaction = await transactionModel.create(transactionData);

    
    const session = await stripeInstance.checkout.sessions.create({
      payment_method_types: ['card'], 
      line_items: [
        {
          price_data: {
            currency: 'usd', // Currency
            product_data: {
              name: `${plan} Plan`, // Plan name
              description: `Purchase ${credits} credits for $${amount}`,
            },
            unit_amount: amount * 100, 
          },
          quantity: 1, 
        },
      ],
      mode: 'payment',
      success_url: `${process.env.CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/cancel`,
      metadata: { 
        transactionId: newTransaction._id.toString(), 
        userId: userId,
        credits: credits
      },
    });

    res.json({
      success: true,
      sessionId: session.id, 
    });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
};


const verifyStripe = async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: "Session ID is required" });
    }

    
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session || session.payment_status !== "paid") {
      return res.status(400).json({ success: false, message: "Payment not successful" });
    }

    const { transactionId, userId, credits } = session.metadata;


    await transactionModel.findByIdAndUpdate(transactionId, { paymentStatus: true });
    await userModel.findByIdAndUpdate(userId, { $inc: { credits: credits } });

    res.status(200).json({ success: true, message: "Credits Added" });
  } catch (error) {
    console.error("Stripe Verification Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};


export {registerUser,loginUser,userCredits,paymentStripe,verifyStripe}

 