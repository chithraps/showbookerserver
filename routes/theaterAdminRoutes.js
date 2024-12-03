const express = require("express");
const tmAdmin_rout = express();

const tmController = require("../controllers/theaterAdminController");
const theaterController = require("../controllers/theaterController");
const {verifyToken} = require("../middlewares/verifyToken")

tmAdmin_rout.post("/login", tmController.loginTheaterManager);
tmAdmin_rout.post("/addScreen",verifyToken('theaterAdmin'),theaterController.addScreen);
tmAdmin_rout.get("/fetchScreens",verifyToken('theaterAdmin'),theaterController.viewScreens);
tmAdmin_rout.post("/addSeatingLayout",verifyToken('theaterAdmin'),theaterController.addSeatingLayout);
//tmAdmin_rout.get("/fetchClasses",theaterController.viewSeatingLayouts);
tmAdmin_rout.post("/addRows",verifyToken('theaterAdmin'),theaterController.addRows);
//tmAdmin_rout.get("/fetchRows", theaterController.viewRows);
//tmAdmin_rout.post("/addSection", theaterController.addSections);
//tmAdmin_rout.get("/fetchSections", theaterController.fetchSections);
tmAdmin_rout.post("/addSeats",verifyToken('theaterAdmin'), theaterController.addSeats);
tmAdmin_rout.get("/fetchScreenDetails",verifyToken('theaterAdmin'),theaterController.fetchScreenDetails); 
tmAdmin_rout.put("/updateScreen",verifyToken('theaterAdmin'),theaterController.editScreen);
tmAdmin_rout.put("/updateLayout",verifyToken('theaterAdmin'),theaterController.updateLayout)
tmAdmin_rout.get("/viewShowTimings",verifyToken('theaterAdmin'), theaterController.viewShowTimings);
tmAdmin_rout.post("/addShowTiming",verifyToken('theaterAdmin'), theaterController.addShowTimings);
tmAdmin_rout.patch("/updateShowTiming/:id",verifyToken('theaterAdmin'),theaterController.updateShowTiming);
tmAdmin_rout.patch(
  "/blockShowTiming/:timingId",verifyToken('theaterAdmin'),
  theaterController.blockShowTiming
);
tmAdmin_rout.get("/viewMovies",verifyToken('theaterAdmin'),theaterController.viewMovies);
tmAdmin_rout.delete("/deleteScreen",verifyToken('theaterAdmin'), theaterController.deleteScreen);
tmAdmin_rout.get("/fetchScreen",verifyToken('theaterAdmin'), theaterController.fetchScreen);
tmAdmin_rout.get("/fetchClassId",verifyToken('theaterAdmin'),theaterController.fetchClass);
tmAdmin_rout.put("/updateRow",verifyToken('theaterAdmin'),theaterController.updateRow)

//tmAdmin_rout.get("/fetchSectionIds", theaterController.fetchSection);
tmAdmin_rout.get("/fetchRowId", theaterController.fetchRows);
tmAdmin_rout.get("/fetchRowDetails",verifyToken('theaterAdmin'), theaterController.fetchRowDetails);
tmAdmin_rout.get("/viewBookings/:theaterId",verifyToken('theaterAdmin'),tmController.viewBookings)
tmAdmin_rout.patch("/updatePassword/:theaterId",verifyToken('theaterAdmin'),tmController.changePassword)
tmAdmin_rout.get('/getDetails',verifyToken('theaterAdmin'),tmController.getDetails)
tmAdmin_rout.get('/bookingsChart',verifyToken('theaterAdmin'),tmController.getBookingDetails)
module.exports = tmAdmin_rout;
