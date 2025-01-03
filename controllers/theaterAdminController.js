const bcrypt = require("bcrypt");
const theaterAdmin = require("../models/theaterManagerModel");
const screen = require("../models/screenModel");
const Bookings = require("../models/bookingModel");
const ShowTimings = require("../models/showTimings");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const createToken = (id, email) => {
  const role = "theaterAdmin";
  const token = jwt.sign(
    {
      id,
      email,
      role,
    },
    process.env.JWTPRIVATEKEY,
    { expiresIn: "2hr" }
  );

  return token;
};
const loginTheaterManager = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find the theaterAdmin by email
    const tmData = await theaterAdmin.findOne({ email }).populate('theater_id');
    if (!tmData) {
      return res.status(400).json({ message: "Invalid username or password" });
    }

    
    if (tmData.theater_id.isDeleted) {
      return res.status(403).json({ message: "Theater is blocked. You can reach the admin at admin@gmail.com for further assistance." });
    }

    // Verify the password
    const passwordMatch = await bcrypt.compare(password, tmData.password);
    if (passwordMatch) {
      // Generate a token for the theaterAdmin
      const token = createToken(tmData._id, tmData.email);

      return res.json({
        token,
        theaterAdmin: {
          id: tmData._id,
          theaterId: tmData.theater_id._id,
          email: tmData.email,
        },
      });
    } else {
      return res.status(400).json({ message: "Invalid username or password" });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Error during login. Please try again.",
      error,
    });
  }
};
const viewBookings = async (req, res) => {
  try {
    const { theaterId } = req.params;
    const page = parseInt(req.query.page) || 1; // Default page is 1
    const limit = parseInt(req.query.limit) || 10; // Default limit is 10 bookings per page
    const skip = (page - 1) * limit; // Calculate how many records to skip

    console.log("Fetching bookings for theater ID:", theaterId);

    const bookings = await Bookings.find({ theaterId })
      .populate("movieId", "title")
      .populate("screenId", "screen_number")
      .populate("seatIds", "seat_number")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalBookings = await Bookings.countDocuments({ theaterId }); // Total number of bookings

    if (bookings.length === 0) {
      return res
        .status(404)
        .json({ message: "No bookings found for this theater." });
    }

    res.status(200).json({
      bookings,
      totalBookings, // Send the total count of bookings
      totalPages: Math.ceil(totalBookings / limit), // Calculate the total number of pages
      currentPage: page,
    });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({ error: "Server error" });
  }
};
const changePassword = async (req, res) => {
  try {
    const { password } = req.body;
    const id = req.params.id;
    console.log(password, " AND ", id);

    if (!password) {
      return res.status(400).json({ error: "Password is required." });
    }
   
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log(" hashed password ", hashedPassword);
    const updatedT = await theaterAdmin.findByIdAndUpdate(id, {
      password: hashedPassword,
      updated_at: Date.now(),
    });
    console.log("updated one ", updatedT);

    res.status(200).json({ message: "Password updated successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update password." });
  }
};
const getDetails = async (req, res) => {
  const { theaterId } = req.query;

  try {
    const objectTheaterId = mongoose.Types.ObjectId.isValid(theaterId)
      ? new mongoose.Types.ObjectId(theaterId)
      : null;

    if (!objectTheaterId) {
      return res.status(400).json({ error: "Invalid theater ID format" });
    }

    const totalBookings = await Bookings.countDocuments({
      theaterId: objectTheaterId,
    });

    const totalRevenueData = await Bookings.aggregate([
      {
        $match: {
          theaterId: objectTheaterId,
          status: "Confirmed",
        },
      },
      { $group: { _id: null, totalRevenue: { $sum: "$totalPrice" } } },
    ]);
    const totalRevenue = totalRevenueData[0]?.totalRevenue || 0;

    const activeShowsCount = await ShowTimings.countDocuments({
      theater_id: objectTheaterId,
      blockShow: false,
    });

    res.json({
      totalBookings,
      totalRevenue,
      activeShows: activeShowsCount,
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
};
const getBookingDetails = async (req, res) => {
  try {
    console.log("in getBookingDetails");
    const { theaterId } = req.query;
    console.log("theaterId:", theaterId);

    if (!mongoose.Types.ObjectId.isValid(theaterId)) {
      return res.status(400).send({ message: "Invalid theaterId" });
    }

    const bookings = await Bookings.aggregate([
      { $match: { theaterId: new mongoose.Types.ObjectId(theaterId) } }, // Use 'new'
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$showDate" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    console.log("bookings:", bookings);
    res.json(bookings);
  } catch (error) {
    console.error("Error in getBookingDetails:", error);
    res.status(500).send({ message: "Error fetching bookings data", error });
  }
};

module.exports = {
  loginTheaterManager,
  viewBookings,
  changePassword,
  getDetails,
  getBookingDetails,
};
