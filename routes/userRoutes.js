 const express = require("express")
const user_rout = express();

const userController = require('../controllers/userController');
const bookingController = require('../controllers/bookingController');
const {verifyToken} = require("../middlewares/verifyToken")

user_rout.post('/signIn',userController.userSignIn);
user_rout.post('/verify-otp',userController.verifyOTP);
user_rout.post('/resend-otp',userController.resendOtp);
user_rout.get('/viewNowShowingMovies',userController.currentShowingMovies)
user_rout.get('/movieDetails/:id',userController.fetchMovieDetails);
user_rout.get('/theatersForMovie/:id',userController.fetchTheatersForMovie)
user_rout.get('/fetchNovwShowingMovies',userController.fetchShowingMovies);
user_rout.get('/showScreenLayout/:screenId',userController.showScreenLayout);
user_rout.put('/edit-profile/:id',verifyToken('user'),userController.editProfile)
user_rout.get('/moviesInTheaters',userController.fetchMoviesIntheaters);
user_rout.get('/fetchDetails',userController.fetchDetails);
user_rout.post('/placeOrder',bookingController.placeOrder);  
user_rout.post('/confirmPayment',bookingController.confirmPayment);
user_rout.post('/bookTicket',bookingController.bookTicket);
user_rout.get('/bookingHistory/:userEmail',verifyToken('user'),bookingController.getBookingHistory)
user_rout.put('/cancelBooking/:bookingId',verifyToken('user'),bookingController.cancelBooking); 
user_rout.put('/cancelSeat',verifyToken('user'),bookingController.cancelSeat)
user_rout.get('/wallet/:userId',verifyToken('user'),userController.fetchWalletBalance) 
user_rout.post('/deductWalletBalance',verifyToken('user'),userController.deductWalletBalance);
user_rout.post('/rateMovie',verifyToken('user'),userController.rateAndReviewMovie)
user_rout.get('/movieRating/:id',userController.getMovieRating);
user_rout.get('/getBannerImages',userController.getBannerImages)
module.exports = user_rout;    