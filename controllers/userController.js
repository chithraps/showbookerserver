const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const users = require("../models/userModel");
const otpModal = require("../models/otpModel");
const showTimings = require("../models/showTimings");
const theaters = require("../models/theaterModel");
const movies = require("../models/moviesModel");
const screen = require("../models/screenModel");
const booking = require("../models/bookingModel");
const seat = require("../models/seatModel");
const row = require("../models/rowModel");
const RateAndReview = require("../models/rateAndReviewModel");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const wallet = require("../models/WalletModel");
const WalletTransaction = require("../models/walletTransactionModel");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const Banner = require("../models/bannerModel");
const {ERROR_MESSAGES} = require("../constants/errorMessages")
const {STATUS_CODES} = require("../constants/statusCodes")
dotenv.config();

const s3 = new S3Client({
  region: process.env.S3_BUCKET_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});

async function generatePresignedUrl(bucketName, key) {
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 3600 }); // 1 hour expiration
    return url;
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return null;
  }
}

//create token
const createToken = (userId, userEmail) => {
  const role = "user";
  const token = jwt.sign(
    {
      userId,
      userEmail,
      role,
    },
    process.env.JWTPRIVATEKEY,
    { expiresIn: "2hr" }
  );

  return token;
};
const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

//create transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD,
  },
});

//send otp
const sendOtpEmail = async (email, otp) => {
  const mailOptions = {
    from: process.env.EMAIL,
    to: email,
    subject: "Your OTP Code for showbooker",
    text: `Your OTP code is ${otp}. Note : It is valid for 5 minutes.`,
  };

  await transporter.sendMail(mailOptions);
};

const userSignIn = async (req, res) => {
  try {
    const { type, googleAccessToken, mobile, email } = req.body;
    if (type === "google" && googleAccessToken) {
      const response = await axios.get(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        {
          headers: {
            Authorization: `Bearer ${googleAccessToken}`,
          },
        }
      );
      const userDetails = response.data;
      console.log("userDetails ", userDetails);
      const userEmail = userDetails.email;
      const existingUser = await users.findOne({ email: userEmail });
      if (existingUser && existingUser.blockUser) {
        return res
          .status(STATUS_CODES.FORBIDDEN)
          .json({ message: ERROR_MESSAGES.USER_BLOCKED });
      }
      if (!existingUser) {
        console.log("new user");
        const user = new users({
          firstName: userDetails.given_name,
          lastName: userDetails.family_name,
          email: userDetails.email,
          emailVerified: true,
          googleId: userDetails.sub,
        });
        await user.save();
      } else {
        console.log("existing user");
        if (
          !existingUser.firstName &&
          !existingUser.lastName &&
          !existingUser.googleId
        ) {
          console.log(" User details are updating");
          existingUser.firstName = userDetails.given_name;
          existingUser.lastName = userDetails.family_name;
          existingUser.googleId = userDetails.sub;
          existingUser.emailVerified = true;
          await existingUser.save();
        }
      }
      const user = await users.findOne({ email: userEmail });
      console.log(user);
      const token = createToken(user._id, user.email);
      res.json({
        token,
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      });
    } else if (type === "email" && email) {
      console.log("email given ", email);
      const existingUser = await users.findOne({ email });
      if (existingUser && existingUser.blockUser) {
        return res
          .status(STATUS_CODES.FORBIDDEN)
          .json({ message: ERROR_MESSAGES.USER_BLOCKED });
      }
      if (!existingUser) {
        const user = new users({
          email,
          emailVerified: true,
        });
        await user.save();
      }
      //generate otp
      const otp = generateOtp();
      console.log(otp);

      //send otp to user's email
      await sendOtpEmail(email, otp);

      const otpEntry = new otpModal({ email, otp });
      await otpEntry.save();
      return res.status(200).json({ message: "OTP sent to email" });
    } else if (type === "mobile" && mobile) {
    }
  } catch (error) {
    console.log("error occured ", error);
  }
};

const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Find the OTP details from the database
    const storedOtpDetails = await otpModal.findOne({ email, otp });
    console.log(storedOtpDetails);
    if (!storedOtpDetails) {
      console.log("inside stored OTP details");
      return res.status(STATUS_CODES.BAD_REQUEST).json({ message: ERROR_MESSAGES.INVALID_OTP });
    }

    // Delete OTP after successful verification
    await otpModal.deleteOne({ email, otp });

    const user = await users.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const token = createToken(user._id, user.email);
    res.status(STATUS_CODES.OK).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        mobileNumber: user.mobileNumber,
      },
    });
  } catch (error) {
    console.log("error occurred ", error);
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ message: ERROR_MESSAGES.SERVER_ERROR });
  }
};
const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await users.findOne({ email });
    if (!user) {
      return res.status(STATUS_CODES.NOT_FOUND).json({ message: "User not found" });
    }
    // Generate a new OTP
    const newOtp = generateOtp();
    const otpInstance = new otpModal({ email, otp: newOtp });

    // Save the new OTP in the database
    await otpInstance.save();

    // Send the new OTP to the user's email

    await sendOtpEmail(email, newOtp);

    res.status(STATUS_CODES.OK).json({ message: "OTP resent successfully" });
  } catch (error) {
    console.error("Error resending OTP:", error);
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ message: ERROR_MESSAGES.SERVER_ERROR });
  }
};
const editProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(" form data ", req.body.formData);
    const { firstName, lastName, email, mobileNumber } = req.body.formData;
    console.log(
      "id firstName lastName ",
      userId,
      " ",
      firstName,
      " ",
      lastName,
      " "
    );
    const updatedUser = await users.findByIdAndUpdate(
      userId,
      {
        firstName,
        lastName,
        email,
        mobileNumber,
        updated_at: Date.now(),
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(STATUS_CODES.NOT_FOUND).json({ message: ERROR_MESSAGES.NOT_FOUND });
    }

    res.status(200).json({
      message: "User updated successfully",
      user: {
        id: updatedUser._id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        mobileNumber: updatedUser.mobileNumber,
      },
    });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "Error updating user", error: error.message });
  }
};

const currentShowingMovies = async (req, res) => {
  try {
    const location = req.params.location;
    const theatersList = await theaters.find({ location }).exec();

    if (theatersList.length === 0) {
      return res
        .status(404)
        .json({ message: "No theaters found in this location." });
    }
    const theaterIds = theatersList.map((theater) => theater._id);

    const showTimings = await showTimings
      .find({ theater_id: { $in: theaterIds } })
      .populate("movie_id")
      .exec();

    if (showTimings.length === 0) {
      return res
        .status(404)
        .json({ message: "No show timings found for these theaters." });
    }
    const movieIds = [
      ...new Set(showTimings.map((show) => show.movie_id._id.toString())),
    ];

    const movies = await movies.find({ _id: { $in: movieIds } }).exec();

    res.json(movies);
  } catch (error) {
    console.error("Error fetching movies:", error);
    res
      .status(500)
      .json({ message: "An error occurred while fetching movies." });
  }
};
const fetchMovieDetails = async (req, res) => {
  try {
    const movieId = req.params.id;
    console.log(" fetchMovieDetails : Movie Id ", movieId);
    const movie = await movies.findById(movieId).populate("genre_id");

    if (!movie) {
      return res.status(404).json({ message: "Movie not found" });
    }
    const bucketName = process.env.S3_BUCKET_NAME
    const posterPresignedUrl = await generatePresignedUrl(
      bucketName,
      movie.poster
    );

    const movieWithPresignedUrl = {
      ...movie._doc,
      posterUrl: posterPresignedUrl,
    };

    res.json(movieWithPresignedUrl);
  } catch (error) {
    console.error("Error fetching movie details:", error);
    res.status(500).json({ message: "Server error" });
  }
};
const fetchTheatersForMovie = async (req, res) => {
  try {
    const { id } = req.params;
    const { location, selectedDate } = req.query;

    console.log("In fetch theaters for movie ");
    console.log(id, location, selectedDate);

    const theatersInLocation = await theaters.find({
      $or: [{ city: location }, { location: location }],
    });
    const theaterIds = theatersInLocation.map((theater) => theater._id);

    let showTimingList = await showTimings
      .find({
        movie_id: id,
        theater_id: { $in: theaterIds },
      })
      .populate("theater_id")
      .populate("screen_id");

    const selectedDateObj = new Date(selectedDate);

    const today = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );
    console.log("Current IST Date:", today.toDateString());

    const isToday = selectedDateObj.toDateString() === today.toDateString();
    console.log("isToday:", isToday);

    showTimingList = showTimingList
      .map((show) => {
        let filteredTimings = show.timings;

        if (isToday) {
          const currentTime = today.getHours() * 60 + today.getMinutes();

          filteredTimings = show.timings.filter((timing) => {
            try {
              // Extract time and period (AM/PM)
              const match = timing.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);
              if (!match) {
                console.error("Invalid timing format:", timing);
                return false;
              }

              let [_, hours, minutes, period] = match;
              hours = parseInt(hours, 10);
              minutes = parseInt(minutes, 10);

              // Convert to 24-hour format
              if (period.toUpperCase() === "PM" && hours < 12) hours += 12;
              if (period.toUpperCase() === "AM" && hours === 12) hours = 0;

              const showTimeInMinutes = hours * 60 + minutes;

              return showTimeInMinutes > currentTime;
            } catch (err) {
              console.error("Error parsing time:", err);
              return false;
            }
          });
        }
        console.log("filtered timings ", filteredTimings);
        return filteredTimings.length > 0
          ? {
              theater: show.theater_id.name,
              theaterId: show.theater_id._id,
              screen: show.screen_id.screen_number,
              screenId: show.screen_id._id,
              timings: filteredTimings,
              location: show.theater_id.location,
              city: show.theater_id.city,
              state: show.theater_id.state,
              country: show.theater_id.country,
            }
          : null;
      })
      .filter(Boolean);

    res.status(200).json(showTimingList);
  } catch (error) {
    console.error("Error fetching theaters for movie:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const fetchShowingMovies = async (req, res) => {
  const { location } = req.query;
  try {
    const theaterList = await theaters
      .find({ city: location })
      .select("_id screen_ids");

    const screenIds = theaterList.reduce((acc, theater) => {
      return [...acc, ...theater.screen_ids];
    }, []);

    const showTimingsList = await showTimings
      .find({
        screen_id: { $in: screenIds },
      })
      .populate("movie_id");

    const movieIds = [
      ...new Set(showTimingsList.map((show) => show.movie_id._id.toString())),
    ];

    const movieList = await movies
      .find({ _id: { $in: movieIds } })
      .populate("genre_id");

    const bucketName = process.env.S3_BUCKET_NAME;
    const moviesWithPresignedUrls = await Promise.all(
      movieList.map(async (movie) => {
        const presignedUrl = await generatePresignedUrl(
          bucketName,
          movie.poster
        );
        return {
          ...movie._doc,
          posterUrl: presignedUrl,
        };
      })
    );

    res.status(200).json(moviesWithPresignedUrls);
  } catch (error) {
    console.error("Error fetching movies:", error);
    res
      .status(500)
      .json({ message: "An error occurred while fetching movies" });
  }
};
const showScreenLayout = async (req, res) => {
  try {
    const { screenId } = req.params;
    const { showDate, showTime } = req.query;

    console.log(
      "screenId, showDate, showTime",
      screenId,
      " ",
      showDate,
      " ",
      showTime
    );

    if (!showDate || !showTime) {
      return res.status(400).json({
        error: "showDate and showTime are required as query parameters.",
      });
    }

    const parsedShowDate = new Date(showDate);
    if (isNaN(parsedShowDate)) {
      return res
        .status(400)
        .json({ error: "Invalid showDate format. Use YYYY-MM-DD." });
    }

    const screenDetails = await screen
      .findById(screenId)
      .populate({
        path: "seating_layout_ids",
        populate: {
          path: "row_ids",
          populate: {
            path: "seat_ids",
          },
        },
      })
      .populate({
        path: "theater_id",
      });

    if (!screenDetails) {
      return res.status(404).json({ error: "Screen not found" });
    }

    const bookings = await booking
      .find({
        screenId: screenId,
        showDate: parsedShowDate,
        showTime: showTime,
        status: { $in: ["Confirmed", "Pending"] },
      })
      .select("seatIds.seatId seatIds.status")
      .lean();

    const bookedSeatIds = bookings.reduce((acc, booking) => {
      booking.seatIds.forEach((seat) => {
        if (["Booked"].includes(seat.status)) {
          acc.add(seat.seatId.toString());
        }
      });
      return acc;
    }, new Set());

    const bookedSeatIdsArray = Array.from(bookedSeatIds);
    console.log("booked seats array ", bookedSeatIdsArray);
    res.status(200).json({
      screenDetails,
      bookedSeatIds: bookedSeatIdsArray,
    });
  } catch (error) {
    console.error("Error fetching screen details:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
const fetchMoviesIntheaters = async (req, res) => {
  try {
    const { location } = req.query;
    console.log(" location ", location);
    const theatersInLocation = await theaters.find({
      $or: [{ city: location }, { location: location }],
    });
    console.log("theaters ", theatersInLocation);
    const theaterIds = theatersInLocation.map((theater) => theater._id);
    const showTimingList = await showTimings
      .find({
        theater_id: { $in: theaterIds },
        blockShow: false,
      })
      .populate("movie_id");
    const uniqueMovies = Array.from(
      new Set(showTimingList.map((show) => show.movie_id))
    );
    console.log("movies ", uniqueMovies);

    res.json({ movies: uniqueMovies });
  } catch (err) {
    res.status(500).json({ error: "Something went wrong" });
  }
};
const fetchDetails = async (req, res) => {
  try {
    console.log("in sserverside fetchDetails");
    const { theaterId, movieId, screenId, seatIds } = req.query;
    console.log(theaterId, " ", movieId, " ", screenId, " ", seatIds);
    const seatIdArray = Array.isArray(seatIds) ? seatIds : [seatIds];
    console.log("seatIdArray:", seatIdArray);
    const theaterDetails = await theaters.findById(theaterId).select("name");

    const screenDetails = await screen
      .findById(screenId)
      .select("screen_number");

    const movieDetails = await movies.findById(movieId).select("title");

    const seatDetails = await seat
      .find({ _id: { $in: seatIdArray } })
      .populate({
        path: "row_id",
        select: "row_name seating_layout_id",
        populate: {
          path: "seating_layout_id",
          select: "class_name seat_capacity price",
        },
      })
      .select("seat_number row_id");

    const response = {
      theater: theaterDetails.name,
      screen: screenDetails.screen_number,
      movie: movieDetails.title,
      seats: seatDetails.map((seat) => ({
        seat_number: seat.seat_number,
        row_name: seat.row_id.row_name,
        seating_layout: {
          class_name: seat.row_id.seating_layout_id.class_name,
          seat_capacity: seat.row_id.seating_layout_id.seat_capacity,
          price: seat.row_id.seating_layout_id.price,
        },
      })),
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching details:", error);
    res.status(500).json({ error: "Server error" });
  }
};
const fetchWalletBalance = async (req, res) => {
  try {
    const userId = req.params.userId;    
    const user = await users.findById(userId);
    if (user.blockUser) {
      return res
        .status(403)
        .json({ message: "User is blocked. Access denied." });
    }
    let userWallet = await wallet.findOne({ userId });
    
    if (!userWallet) {
      console.log("Wallet not found, creating a new wallet...");
      userWallet = new wallet({
        userId,
        balance: 0,
      });
      await userWallet.save();
      console.log("New wallet created: ", userWallet);
    }
    res.json({ balance: userWallet.balance });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error ", error });
  }
};
const deductWalletBalance = async (req, res) => {
  try {
    const { userId, amount } = req.body;
    console.log("userId and amount");
    const userWallet = await wallet.findOne({ userId });

    if (!userWallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }
    if (userWallet.balance < amount) {
      return res.status(400).json({ message: "Insufficient wallet balance" });
    }
    userWallet.balance = parseFloat((userWallet.balance - amount).toFixed(1));

    await userWallet.save();
    
    const transactionId = generateTransactionId();
    console.log("Transaction ID:", transactionId);

    return res.status(200).json({
      message: "Wallet balance deducted successfully",
      transactionId,
      newBalance: wallet.balance,
    });
  } catch (error) {
    console.error("Error deducting wallet balance:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

function generateTransactionId() {
  return `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}
const rateAndReviewMovie = async (req, res) => {
  const { user_id, movie_id, rating, review } = req.body;
  console.log(
    "user id ,movie_id,rating ",
    user_id,
    " ",
    movie_id,
    " ",
    rating,
    " ",
    review
  );
  console.log("movie_id ", movie_id);
  try {
    const existingReview = await RateAndReview.findOne({ user_id, movie_id });
    console.log("existingReview ", existingReview);
    if (existingReview) {
      return res
        .status(400)
        .json({ message: "You have already reviewed this movie" });
    }
    const newReview = new RateAndReview({
      user_id,
      movie_id,
      rating,
      review,
    });
    await newReview.save();

    res.status(201).json({ message: "Review submitted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to submit review" });
  }
};
const getMovieRating = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("movie id is ", id);
    const result = await RateAndReview.aggregate([
      { $match: { movie_id: new mongoose.Types.ObjectId(id) } },
      {
        $group: {
          _id: "$movie_id",
          averageRating: { $avg: "$rating" },
          totalReviews: { $sum: 1 },
        },
      },
    ]);
    console.log(result);
    if (result.length === 0) {
      return res.status(200).json({
        averageRating: 0,
        totalReviews: 0,
      });
    }

    res.status(200).json({
      averageRating: result[0].averageRating.toFixed(1),
      totalReviews: result[0].totalReviews,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to fetch movie rating" });
  }
};
const getBannerImages = async (req, res) => {
  try {
    console.log("in get banner images ");
    const banners = await Banner.find();
    const bucketName = process.env.S3_BUCKET_NAME;
    const bennersWithPresignedUrls = await Promise.all(
      banners.map(async (banner) => {
        const presignedUrl = await generatePresignedUrl(
          bucketName,
          banner.imageUrl
        );
        return {
          ...banner._doc,
          bannerUrl: presignedUrl,
        };
      })
    );
    
    res.status(200).json(bennersWithPresignedUrls);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch banner images." });
  }
};
const fetchUserDetails = async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log(userId);
    const user = await users.findById(userId).select("-__v -password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.blockUser) {
      return res
        .status(403)
        .json({ message: "User is blocked. Access denied." });
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
const getWalletTransactions = async (req,res)=>{
  console.log("In get wallet transactions. ")
  try{
    const { userId } = req.params;
    console.log("userId ",userId)
    const transactions = await WalletTransaction.find({ userId })
      .sort({ timestamp: -1 }) 
      .limit(10); 
    res.status(200).json({ transactions });
  }catch(error){

  }
}
module.exports = {
  userSignIn,
  verifyOTP,
  resendOtp,
  editProfile,
  currentShowingMovies,
  fetchMovieDetails,
  fetchTheatersForMovie,
  fetchShowingMovies,
  showScreenLayout,
  fetchMoviesIntheaters,
  fetchDetails,
  fetchWalletBalance,
  deductWalletBalance,
  rateAndReviewMovie,
  getMovieRating,
  getBannerImages,
  fetchUserDetails,
  getWalletTransactions,
};
