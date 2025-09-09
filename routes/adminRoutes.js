const express = require("express")
const admin_rout = express();
const multer = require('../config/multer')
const adminController = require('../controllers/adminController');
const theaterController = require('../controllers/theaterController');

const {verifyToken} = require("../middlewares/verifyToken")

admin_rout.post('/auth/refresh',adminController.refreshToken)
admin_rout.post('/register',adminController.adminRegister);
admin_rout.post('/login',adminController.adminLogin) 
admin_rout.get('/fetchUsers',verifyToken('admin'),adminController.fetchUsers);
admin_rout.patch('/blockUser/:userId',verifyToken('admin'),adminController.blockUser);
admin_rout.get('/viewTheaters',verifyToken('admin'),theaterController.viewTheaters);
admin_rout.put('/editTheater/:theaterId',verifyToken('admin'),theaterController.editTheater)
admin_rout.post('/addTheater',verifyToken('admin'),theaterController.createTheater);
admin_rout.put('/deleteTheater/:id',verifyToken('admin'),theaterController.deleteTheater)
admin_rout.get('/viewGenres',verifyToken('admin'),adminController.viewGenres);   
admin_rout.get('/getGenre',verifyToken('admin'),adminController.getGenre)
admin_rout.post('/addGenre',verifyToken('admin'),adminController.addGenre)
admin_rout.put('/updateGenre/:genreId',verifyToken('admin'),adminController.updateGenre)
admin_rout.put('/toggleBlockGenre/:id',verifyToken('admin'),adminController.blockGenre);
admin_rout.get('/viewMovies',verifyToken('admin'),adminController.viewMovies)
admin_rout.post('/addMovie',verifyToken('admin'),multer.imageUpload.single("file"),adminController.addMovie)
admin_rout.put('/toggleBlockMovie/:id',verifyToken('admin'),adminController.blockMovie) 
admin_rout.put('/updateMovie/:id',verifyToken('admin'),multer.imageUpload.single("file"),adminController.editMovie)
admin_rout.post('/addTheaterManager',verifyToken('admin'),adminController.addTheaterManager);
admin_rout.get('/viewAllBookings',verifyToken('admin'),adminController.viewAllBookings);
admin_rout.get('/getTheaterLocations',verifyToken('admin'),theaterController.getTheaterLocations);
admin_rout.get('/getMonthlyBookingdata',verifyToken('admin'),adminController.getMonthlyBookings);
admin_rout.get('/statistics',verifyToken('admin'),adminController.statistics)
admin_rout.get('/bookings-status',verifyToken('admin'),adminController.bookingStatus)
admin_rout.get('/bookings',verifyToken('admin'),adminController.bookings)
admin_rout.post('/addBannerImage',verifyToken('admin'),multer.bannerImageUpload.single("bannerImage"),adminController.addBannerImage);
admin_rout.get('/getAllBannerImages',verifyToken('admin'),adminController.getAllBannerImages);
admin_rout.delete('/deleteBannerImage/:id',verifyToken('admin'),adminController.deleteBannerImage)


module.exports = admin_rout;