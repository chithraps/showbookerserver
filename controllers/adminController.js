const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const admin = require("../models/adminModel");
const users = require("../models/userModel");
const ShowTimings = require("../models/showTimings")
const theaterManager = require("../models/theaterManagerModel");
const jwt = require("jsonwebtoken");
const theater = require("../models/theaterModel");
const genres = require("../models/genreModel");
const Booking = require("../models/bookingModel");
const movies = require("../models/moviesModel");
const Banner = require("../models/bannerModel");
const dotenv = require("dotenv");
dotenv.config();

const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {
    console.log(error.message);
  }
};
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD,
  },
});

const sendPassword = async (email, password) => {
  const mailOptions = {
    from: process.env.EMAIL,
    to: email,
    subject: "Your Password for showbooker",
    text: `Your password  is ${password}. Note : You should change the password after loggedin`,
  };

  await transporter.sendMail(mailOptions);
};

const createToken = (id, email) => {
  const role = "admin";
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
const createPassword = () => {
  const length = 10;
  return crypto.randomBytes(length).toString("hex").slice(0, length);
};

const adminRegister = async (req, res) => {
  const { email, password } = req.body;
  console.log(email, " ", password);
  const existingAdmin = await admin.findOne({ email });
  if (!existingAdmin) {
    const spassword = await securePassword(password);
    const newAdmin = new admin({
      email,
      password: spassword,
    });
    await newAdmin.save();
    res.status(200).json({
      message: "registration was successful !!!!",
    });
  } else {
    res.json({ message: "Email already exists !!!" });
  }
};
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const adminData = await admin.findOne({ email });
    const passwordMatch = await bcrypt.compare(password, adminData.password);
    if (passwordMatch) {
      const token = createToken(adminData._id, adminData.email);
      res.status(200).json({
        token,
        admin: {
          id: adminData._id,
          email: adminData.email,
        },
      });
    } else {
      res.status(400).json({ message: "Invalid Email or Password" });
    }
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error while login", error });
  }
};
const fetchUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const totalUsers = await users.countDocuments();
    const usersData = await users.find().skip(skip).limit(limit);

    res.json({ usersData, totalUsers, page, limit });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const blockUser = async (req, res) => {
  const { userId } = req.params;
  const { blockUser } = req.body;
  console.log(userId, " ", blockUser);

  try {
    const user = await users.findByIdAndUpdate(
      userId,
      { blockUser: blockUser },
      { new: true }
    );

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({ success: true, user });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Error updating user", error });
  }
};

const addTheaterManager = async (req, res) => {
  try {
    const { email, theaterName } = req.body;
    const randomPassword = createPassword();
    console.log(randomPassword);
    const sPassword = await securePassword(randomPassword);
    const existingTM = await theaterManager.findOne({ email });
    const existingtheater = await theater.findOne({ name: theaterName });
    if (!existingTM) {
      const newTM = new theaterManager({
        email,
        password: sPassword,
        theater_id: existingtheater._id,
      });
      newTM.save();
      await sendPassword(email, randomPassword);
      res.status(201).json({ message: "Theater manager added successfully" });
    } else {
      res.json({ message: "Theater manager already exists" });
    }
  } catch (error) {
    console.error("Error creating theater manager:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
const viewGenres = async (req, res) => {
  try {
    const { page = 1, limit = 5 } = req.query;
    const skip = (page - 1) * limit;

    const totalGenres = await genres.countDocuments();
    const existingGenres = await genres.find().skip(skip).limit(Number(limit));

    res.status(200).json({
      genres: existingGenres,
      totalPages: Math.ceil(totalGenres / limit),
      currentPage: Number(page),
    });
  } catch (error) {
    console.error("Error fetching genres:", error);
    res.status(500).json({ message: "Error fetching genres" });
  }
};

const addGenre = async (req, res) => {
  try {
    const { name, description } = req.body;
    console.log(name, " ", description);
    // Check if the genre already exists
    const existingGenre = await genres.findOne({ name });
    if (existingGenre) {
      return res.status(400).json({ message: "Genre name already exists" });
    }

    // Create a new genre
    const newGenre = new genres({ name, description });
    await newGenre.save();

    res
      .status(201)
      .json({ message: "Genre added successfully", genre: newGenre });
  } catch (error) {
    console.error("Error adding genre:", error);
    res
      .status(500)
      .json({ message: "An error occurred while adding the genre" });
  }
};
const updateGenre = async (req, res) => {
  try {
    const { genreId } = req.params;
    const { name, description } = req.body;
    console.log(genreId, " ", name);
    const updatedGenre = await genres.findByIdAndUpdate(
      genreId,
      { name, description, updated_at: Date.now() },
      { new: true, runValidators: true }
    );

    if (!updatedGenre) {
      return res.status(404).json({ message: "Genre not found" });
    }

    res
      .status(200)
      .json({ message: "Genre updated successfully", genre: updatedGenre });
  } catch (error) {
    console.error("Error updating genre:", error);
    res
      .status(500)
      .json({ message: "An error occurred while updating the genre" });
  }
};
const blockGenre = async (req, res) => {
  try {
    const { id } = req.params;
    const genre = await genres.findById(id);

    if (!genre) {
      return res.status(404).json({ message: "Genre not found" });
    }

    genre.blockGenre = !genre.blockGenre;
    await genre.save();

    res.status(200).json({ message: "Genre block status updated", genre });
  } catch (error) {
    console.error("Error updating genre block status:", error);
    res.status(500).json({
      message: "An error occurred while updating the genre block status",
    });
  }
};
const viewMovies = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const movieList = await movies
      .find()
      .populate("genre_id")
      .skip(skip)
      .limit(limit);

    const totalMovies = await movies.countDocuments();

    res.status(200).json({
      movies: movieList,
      totalMovies,
      totalPages: Math.ceil(totalMovies / limit),
      currentPage: page,
    });
  } catch (error) {
    console.error("Error fetching movies:", error);
    res
      .status(500)
      .json({ message: "An error occurred while fetching movies" });
  }
};

const addMovie = async (req, res) => {
  try {
    const {
      title,
      genre_id,
      release_date,
      duration,
      description,
      language,
      trailer_url,
      cast,
      crew,
    } = req.body;
    const poster = req.file ? req.file.key : null;
   
    console.log("Title:", title);
    console.log("Genre ID:", genre_id);
    console.log("Release Date:", release_date);
    console.log("Duration:", duration);
    console.log("Description:", description);
    console.log("Language:", language);
    console.log("cast :", cast);
    console.log("crew :", crew);
    
    // Log the received values for debugging
    console.log("Title:", title);
    console.log("Poster URL:", poster);

    // Check if a movie with the same title already exists
    const existingMovie = await movies.findOne({ title });
    if (existingMovie) {
      console.log("existing movie");
      return res
        .status(400)
        .json({ message: "A movie with this title already exists" });
    }

    // Create a new movie document
    const newMovie = new movies({
      title,
      genre_id,
      release_date: new Date(release_date),
      duration,
      description,
      language,
      poster,
      trailer_url,
      cast: JSON.parse(cast),
      crew: JSON.parse(crew),
    });

    // Save the movie to the database
    await newMovie.save();

    // Send a success response
    res
      .status(201)
      .json({ message: "Movie added successfully!", movie: newMovie });
  } catch (error) {
    console.error("Error adding movie:", error);
    res
      .status(500)
      .json({ message: "An error occurred while adding the movie", error });
  }
};
const blockMovie = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(id, " movie Id");
    const movie = await movies.findById(id);

    if (!movie) {
      return res.status(404).json({ message: "Movie not found" });
    }

    movie.blockMovies = !movie.blockMovies;
    console.log(movie.blockMovies);
    await movie.save();

    res.status(200).json({ message: "Movie block status updated", movie });
  } catch (error) {
    console.error("Error updating movie block status:", error);
    res.status(500).json({
      message: "An error occurred while updating the movie block status",
    });
  }
};

const editMovie = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("id is ", id);
    const {
      title,
      genre_id,
      release_date,
      duration,
      description,
      language,
      trailer_url,
      cast,
      crew,
    } = req.body;

    const updatedFields = {
      title,
      genre_id,
      release_date,
      duration,
      description,
      language,
      trailer_url,
      cast: JSON.parse(cast),
      crew: JSON.parse(crew),
    };

    if (req.file) {
      updatedFields.poster = req.file.path; // Save the path of the uploaded file
    }

    const updatedMovie = await movies.findByIdAndUpdate(id, updatedFields, {
      new: true,
    });

    if (!updatedMovie) {
      return res.status(404).json({ message: "Movie not found" });
    }

    res.json({ message: "Movie updated successfully", movie: updatedMovie });
  } catch (error) {
    console.error("Error updating movie:", error);
    res
      .status(500)
      .json({ message: "An error occurred while updating the movie" });
  }
};
const viewAllBookings = async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  try {
    const bookings = await Booking.find()
      .populate("movieId", "title")
      .populate("theaterId", "name location")
      .populate("screenId", "screen_number")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Booking.countDocuments();

    res.json({
      bookings,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching bookings", error });
  }
};
const getMonthlyBookings = async (req, res) => {
  try {
    console.log("in get Monthly bookings ");
    const bookingsByMonth = await Booking.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$showDate" },
            month: { $month: "$showDate" },
          },
          totalBookings: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 },
      },
    ]);

    console.log("bookings by month ", bookingsByMonth);
    const formattedData = bookingsByMonth.map((item) => ({
      year: item._id.year,
      month: item._id.month,
      totalBookings: item.totalBookings,
    }));

    res.status(200).json(formattedData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
const addBannerImage = async (req, res) => {
  try {
    const bannerImage = req.file
      ? `/public/bannerImages/${req.file.filename}`
      : null;
    console.log("banner image ", bannerImage);
    if (!bannerImage) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const banner = new Banner({
      imageUrl: bannerImage,
    });

    await banner.save();

    res.status(200).json({
      message: "Banner uploaded and saved successfully",
      imageUrl: banner.imageUrl,
    });
  } catch (error) {
    console.error("Failed to save banner", error);
    res.status(500).json({ message: "Failed to upload and save banner" });
  }
};
const getAllBannerImages = async (req, res) => {
  try {
    console.log("in get banner images ");
    const banners = await Banner.find();
    res.status(200).json(banners);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch banner images." });
  }
};
const deleteBannerImage = async (req, res) => {
  try {
    const { id } = req.params;
    await Banner.findByIdAndDelete(id);
    res.status(200).json({ message: "Banner deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete banner." });
  }
};
const statistics = async (req, res) => {
  try {
    const totalBookings = await Booking.countDocuments();
    const totalRevenue = await Booking.aggregate([
      { $match: { status: "Confirmed" } },
      { $group: { _id: null, total: { $sum: "$totalPrice" } } },
    ]);
    const totalUsers = await users.countDocuments();
    const activeShows = await ShowTimings.countDocuments({ blockShow: false });

    res.json({
      totalBookings,
      totalRevenue: totalRevenue[0]?.total || 0,
      totalUsers,
      activeShows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to retrieve statistics" });
  }
};
const bookingStatus = async(req,res)=>{
try {
  const bookings = await Booking.find().select('status');
  res.json(bookings);
} catch (error) {
  res.status(500).json({ message: 'Error fetching booking status counts', error });
}
}
const bookings = async(req,res)=>{
  try {
    const { status } = req.query; 
    const filter = status ? { status } : {}; 
    
    const bookings = await Booking.find(filter)
      .populate('userId movieId theaterId screenId seatIds.seatId')
      .exec();

    res.json(bookings);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
}
module.exports = {
  adminRegister,
  adminLogin,
  fetchUsers,
  blockUser,
  addTheaterManager,
  viewGenres,
  addGenre,
  updateGenre,
  blockGenre,
  viewMovies,
  addMovie,
  blockMovie,
  editMovie,
  viewAllBookings,
  getMonthlyBookings,
  addBannerImage,
  getAllBannerImages,
  deleteBannerImage,
  statistics,
  bookingStatus,
  bookings,
};
