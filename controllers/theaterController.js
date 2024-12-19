const mongoose = require("mongoose");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const theater = require("../models/theaterModel");
const theaterManager = require("../models/theaterManagerModel");
const screen = require("../models/screenModel");
const seatingLayout = require("../models/seatingLayoutModel");
const row = require("../models/rowModel");
const section = require("../models/sectionModel");
const seat = require("../models/seatModel");
const showTimings = require("../models/showTimings");
const movies = require("../models/moviesModel");
const dotenv = require("dotenv");
dotenv.config();

const createPassword = () => {
  const length = 10;
  return crypto.randomBytes(length).toString("hex").slice(0, length);
};
const createSecurePassword = async (password) => {
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

const countSeats = async (screenId) => {
  // to count seats
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
    .exec();
  let totalSeats = 0;
  screenDetails.seating_layout_ids.forEach((layout) => {
    layout.row_ids.forEach((row) => {
      totalSeats += row.seat_ids.length;
    });
  });
  console.log(
    `total number of seats in screen ${screenDetails.screen_number} is ${totalSeats} and capacity ${screenDetails.capacity}`
  );
  return { totalSeats, capacity: screenDetails.capacity };
};

const parseTime = (timeStr) => {
  const [time, modifier] = timeStr.split(" ");
  let [hours, minutes] = time.split(":").map(Number);

  if (modifier === "PM" && hours !== 12) {
    hours += 12;
  } else if (modifier === "AM" && hours === 12) {
    hours = 0;
  }

  return hours * 60 + minutes;
};

// function for clculating time difference
const validateTiming = (existingTimings, newTimings) => {
  for (let newTiming of newTimings) {
    const newTime = parseTime(newTiming);
    for (let existingTiming of existingTimings) {
      const existingTime = parseTime(existingTiming);
      if (Math.abs(newTime - existingTime) < 180) {
        return false;
      }
    }
  }
  return true;
};
const createTheater = async (req, res) => {
  try {
    const { name, location, city, state, managerEmail } = req.body;

    // Check if the theater already exists
    const theaterExists = await theater.findOne({ name });
    if (theaterExists) {
      return res
        .status(400)
        .json({ success: false, message: "Theater already exists" });
    }

    // Create a new theater
    const newTheater = new theater({
      name,
      location,
      city,
      state,
    });
    await newTheater.save();

    // Check if the theater manager already exists
    const existingManager = await theaterManager.findOne({
      email: managerEmail,
    });
    if (existingManager) {
      return res
        .status(400)
        .json({ success: false, message: "Theater manager already exists" });
    }

    // Generate a random password for the theater manager
    const randomPassword = createPassword();
    console.log("password ", randomPassword);
    const securePassword = await createSecurePassword(randomPassword);

    // Create a new theater manager
    const newManager = new theaterManager({
      email: managerEmail,
      password: securePassword,
      theater_id: newTheater._id,
    });
    await newManager.save();

    // Optionally send the manager's credentials via email
    await sendPassword(managerEmail, randomPassword);

    res.status(201).json({
      success: true,
      message: "Theater and theater manager added successfully!",
    });
  } catch (error) {
    console.error("Error creating theater and manager:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to add theater and manager" });
  }
};

const viewTheaters = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const theaters = await theater
      .aggregate([
        {
          $lookup: {
            from: "theatermanagers",
            localField: "_id",
            foreignField: "theater_id",
            as: "manager",
          },
        },
        {
          $unwind: {
            path: "$manager",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            name: 1,
            location: 1,
            city: 1,
            state: 1,
            "manager.email": 1,
          },
        },
      ])
      .skip(skip)
      .limit(parseInt(limit));

    const totalTheaters = await theater.countDocuments({});
    const totalPages = Math.ceil(totalTheaters / limit);

    res.json({ theaters, totalPages });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

const editTheater = async (req, res) => {
  try {
    const theaterDetails = await theater.findById(req.params.theaterId);
    if (!theaterDetails)
      return res.status(404).json({ message: "Theater not found" });

    Object.assign(theaterDetails, req.body);
    theaterDetails.updated_at = Date.now();

    await theaterDetails.save();
    res.json(theaterDetails);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
const addScreen = async (req, res) => {
  try {
    const { theater_id, screenNumber, capacity, soundSystem } = req.body;
    const existingScreen = await screen.findOne({
      theater_id,
      screen_number: screenNumber,
    });
    if (existingScreen) {
      return res
        .status(400)
        .json({ error: "Screen number already exists in this theater" });
    }
    const newScreen = new screen({
      theater_id,
      screen_number: screenNumber,
      capacity,
      sound_system: soundSystem,
    });

    await newScreen.save();
    console.log("new screen ID : ", newScreen._id);

    await theater.findByIdAndUpdate(theater_id, {
      $push: { screen_ids: newScreen._id },
    });

    res.status(201).json({
      message: "Screen added successfully",
      screenId: newScreen._id,
    });
  } catch (error) {
    console.error("Error adding screen:", error);
    res.status(500).json({ error: "Error adding screen" });
  }
};
const viewScreens = async (req, res) => {
  try {
    const { theaterId } = req.query;
    const screens = await screen.find({ theater_id: theaterId });

    if (screens.length === 0) {
      return res
        .status(404)
        .json({ message: "No screens found for the given theaterId." });
    }

    res.status(200).json(screens);
  } catch (error) {
    console.error("Error fetching screens:", error);
    res.status(500).json({ message: "Error fetching screens" });
  }
};
const addSeatingLayout = async (req, res) => {
  try {
    const { screenId, className, price, seatCapacity } = req.body;

    const screenDetails = await screen.findById(screenId);

    if (!screenDetails) {
      return res.status(404).json({ message: "Screen not found" });
    }

    const existingSeatingLayouts = await seatingLayout.find({
      screen_id: screenId,
    });

    const totalExistingSeatCapacity = existingSeatingLayouts.reduce(
      (total, layout) => {
        return total + layout.seat_capacity;
      },
      0
    );
    console.log(
      totalExistingSeatCapacity,
      " ",
      seatCapacity,
      " ",
      screenDetails.capacity
    );

    const newCapacity = parseInt(seatCapacity);
    console.log(typeof newCapacity);

    const capacity = totalExistingSeatCapacity + newCapacity;
    console.log(capacity > screenDetails.capacity);

    if (capacity > screenDetails.capacity) {
      return res.status(400).json({
        message: `Adding this seating layout would exceed the screen's capacity. Total capacity: ${screenDetails.capacity}, Current capacity: ${totalExistingSeatCapacity}}`,
      });
    }

    const existingSeatingLayout = await seatingLayout.findOne({
      screen_id: screenId,
      class_name: className,
    });

    if (existingSeatingLayout) {
      return res.status(400).json({
        message:
          "Seating Layout with the same screenId and className already exists",
      });
    }

    const newSeatingLayout = new seatingLayout({
      screen_id: screenId,
      class_name: className,
      price: price,
      seat_capacity: seatCapacity,
    });
    const savedSeatingLayout = await newSeatingLayout.save();

    await screen.findByIdAndUpdate(screenId, {
      $push: { seating_layout_ids: savedSeatingLayout._id },
    });

    res.status(201).json({
      message: "Seating Layout added successfully",
      classId: savedSeatingLayout._id,
    });
  } catch (error) {
    console.error("Error creating Seating Layout:", error);
    res.status(500).json({ message: "Error creating Seating Layout" });
  }
};

const viewSeatingLayouts = async (req, res) => {
  try {
    const { screenId } = req.query;
    console.log(screenId);
    const seatingLayouts = await seatingLayout.find(
      { screen_id: screenId },
      "_id class_name"
    );

    if (seatingLayouts) {
      res.status(200).json(seatingLayouts);
    }
  } catch (error) {
    console.error("Error fetching classes:", error);
    res.status(500).json({ message: "Error fetching classes" });
  }
};
const addSections = async (req, res) => {
  try {
    const { layoutId, sectionName } = req.body;
    console.log("Layout id ", layoutId, " ", sectionName);

    // Check if a section with the same seating layout and section name already exists
    const existingSection = await section.findOne({
      seating_layout_id: layoutId,
      section_name: sectionName,
    });
    if (existingSection) {
      console.log("Section already exists: ");
      return res.status(400).json({
        message: "Section with the Seating-Layout and name already exists",
      });
    }

    // Create a new Section document
    const newSection = new section({
      seating_layout_id: layoutId,
      section_name: sectionName,
    });

    // Save the new Section to the database
    const savedSection = await newSection.save();

    // Update section into seating-layout
    await seatingLayout.findByIdAndUpdate(layoutId, {
      $push: { section_ids: savedSection._id },
    });

    // Return a success response
    res.status(201).json({
      message: "Section successfully added",
      sectionId: savedSection._id,
    });
  } catch (error) {
    console.error("Error adding section:", error);
    res.status(500).json({ message: "Error adding section" });
  }
};
const fetchSections = async (req, res) => {
  try {
    const { classId } = req.query;

    console.log("seating layout id ", classId);

    const sections = await section.find({ seating_layout_id: classId });
    res.json(sections);
  } catch (error) {
    console.error("Error fetching sections:", error);
    res.status(500).json({ message: "Error fetching sections" });
  }
};
const addRows = async (req, res) => {
  const { layoutId, rowName, space } = req.body;
  console.log("In add rows ", layoutId, " ", rowName, " ", space);

  try {
    // Fetch seating layout details
    const seatingLayoutDetails = await seatingLayout
      .findById(layoutId)
      .populate("row_ids")
      .exec();

    if (!seatingLayoutDetails) {
      return res.status(404).json({ message: "Seating layout not found" });
    }

    const { seat_capacity, row_ids } = seatingLayoutDetails;

    // Calculate the current number of seats in the layout
    let totalSeatsInLayout = 0;
    for (const rowId of row_ids) {
      const rowDetails = await row.findById(rowId).populate("seat_ids").exec();
      if (rowDetails) {
        totalSeatsInLayout += rowDetails.seat_ids.length;
      }
    }

    // Check if the layout's seat capacity is already reached
    if (totalSeatsInLayout >= seat_capacity) {
      return res.status(400).json({
        message:
          "The seating layout is already at full capacity. Cannot add more rows.",
      });
    }
    // Check if a row with the same row_name and seating_layout_id exists
    const existingRow = await row.findOne({
      row_name: rowName,
      seating_layout_id: layoutId,
    });

    if (existingRow) {
      console.log("existingRow");
      return res.status(400).json({
        message:
          "A row with the same name already exists in this seating layout",
        rowId: existingRow._id,
      });
    }

    // If no existing row, create a new row
    const newRow = new row({
      seating_layout_id: layoutId,
      row_name: rowName,
      space,
    });

    const savedRow = await newRow.save();
    console.log("savedRow ", savedRow);
    // store the rowId into seatingLayout
    await seatingLayout.findByIdAndUpdate(
      layoutId,
      { $push: { row_ids: savedRow._id } },
      { new: true } // Return the updated document
    );

    res.status(201).json({
      message: "Row added successfully",
      rowId: savedRow._id,
    });
  } catch (error) {
    console.error("Error adding row:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
const updateRow = async (req, res) => {
  const { rowId, space, spacingPosition } = req.body;

  try {
    if (!rowId || space === undefined || !spacingPosition) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const updatedRow = await row.findByIdAndUpdate(
      rowId,
      { space, spacingPosition },
      { new: true }
    );

    if (!updatedRow) {
      return res.status(404).json({ message: "Row not found" });
    }

    res
      .status(200)
      .json({ message: "Row updated successfully", row: updatedRow });
  } catch (error) {
    console.error("Error updating row:", error);
    res.status(500).json({ message: "Failed to update row" });
  }
};

const viewRows = async (req, res) => {
  const { sectionIds } = req.query;

  if (!sectionIds) {
    return res.status(400).json({ message: "Section IDs are required" });
  }

  try {
    const sectionIdArray = sectionIds.split(",");
    const rows = await row
      .find({ sections: { $in: sectionIdArray } })
      .populate("sections");
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching rows:", error);
    res.status(500).json({ message: "Error fetching rows" });
  }
};

const addSeats = async (req, res) => {
  const {
    screenId,
    startSeatNumber,
    endSeatNumber,
    rowId,
    gapAfter,
    sSpacing,
    spacingPosition,
  } = req.body;

  console.log(
    startSeatNumber,
    " ",
    endSeatNumber,
    " ",
    rowId,
    " ",
    gapAfter,
    " ",
    sSpacing,
    " ",
    spacingPosition
  );

  if (!startSeatNumber || !endSeatNumber || !rowId) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    const seats = [];
    const seatIds = [];

    for (
      let seatNumber = startSeatNumber;
      seatNumber <= endSeatNumber;
      seatNumber++
    ) {
      let seatSpacing = 0;
      let seatSpacingPosition = spacingPosition || "after";

      // Add spacing if gapAfter condition is met
      if (gapAfter && seatNumber == gapAfter) {
        seatSpacing = sSpacing || 0;
        console.log("in if condition for spacing");
      }

      const newSeat = new seat({
        seat_number: seatNumber,
        row_id: rowId,
        spacing: seatSpacing,
        spacingPosition: seatSpacingPosition, // Save the spacing position
      });

      seats.push(newSeat);
    }

    // Save all seats in bulk using insertMany
    const savedSeats = await seat.insertMany(seats);

    savedSeats.forEach((seat) => {
      seatIds.push(seat._id);
    });

    // Update the row with the new seat IDs
    await row.findByIdAndUpdate(
      rowId,
      { $push: { seat_ids: { $each: seatIds } } },
      { new: true }
    );

    const { totalSeats, capacity } = await countSeats(screenId);
    const allSeatsStored = totalSeats === capacity;
    console.log("all seats stored ", allSeatsStored, " ", capacity);
    return res.status(201).json({
      message:
        totalSeats === capacity
          ? "All seats are filled successfully. No more seats can be added."
          : "Seats added successfully",
      seats: savedSeats,
      allSeatsStored,
    });
  } catch (error) {
    console.error("Error adding seats:", error);
    return res
      .status(500)
      .json({ message: "Server error while adding seats." });
  }
};

const fetchScreenDetails = async (req, res) => {
  try {
    const screenId = req.query.screenId;
    console.log(screenId, " screen Id");
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
      .exec();
    let totalSeats = 0;
    screenDetails.seating_layout_ids.forEach((layout) => {
      layout.row_ids.forEach((row) => {
        totalSeats += row.seat_ids.length;
      });
    });
    console.log(
      `total number of seats in screen ${screenDetails.screen_number} is ${totalSeats}`
    );
    if (!screenDetails) {
      return res.status(404).json({ message: "Screen not found" });
    }

    res.json({ screenDetails });
  } catch (error) {
    console.error("Error fetching screen details:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const viewShowTimings = async (req, res) => {
  try {
    const { page = 1, limit = 10, theaterId } = req.query;
    const query = theaterId ? { theater_id: theaterId } : {};
    const showTimingList = await showTimings
      .find(query)
      .populate("theater_id", "name")
      .populate("screen_id", "screen_number")
      .populate("movie_id", "title")
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const totalShowTimings = await showTimings.countDocuments();

    res.status(200).json({
      showTimings: showTimingList,
      totalShowTimings,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalShowTimings / limit),
    });
  } catch (error) {
    console.error("Error fetching show timings:", error);
    res.status(500).json({
      message: "An error occurred while fetching show timings",
      error,
    });
  }
};

const addShowTimings = async (req, res) => {
  try {
    const { theater_id, screen_id, movie_id, timings } = req.body;
    console.log(theater_id, " ", screen_id, " ", movie_id, " ", timings);
    if (
      !theater_id ||
      !screen_id ||
      !movie_id ||
      !timings ||
      !Array.isArray(timings) ||
      timings.length === 0
    ) {
      return res.status(400).json({
        error: "All fields are required and timings must be a non-empty array.",
      });
    }
    // Fetch existing show timings for the same screen
    const existingShowTimings = await showTimings.find({ screen_id });

    // Check if there are already four slots booked
    if (existingShowTimings.length >= 4) {
      console.log("The screen already has four slots booked.");
      return res
        .status(400)
        .json({ error: "The screen already has four slots booked." });
    }

    // Collect all existing timings for the screen
    const existingTimings = [];
    existingShowTimings.forEach((show) => {
      existingTimings.push(...show.timings);
    });

    // Validate the time difference between new timings and existing timings
    if (!validateTiming(existingTimings, timings)) {
      console.log(
        "The time difference between slots should be at least 3 hours."
      );
      return res.status(400).json({
        error: "The time difference between slots should be at least 3 hours.",
      });
    }

    // Save the new show timing
    const newShowTiming = new showTimings({
      theater_id,
      screen_id,
      movie_id,
      timings,
    });

    await newShowTiming.save();
    res.status(201).json({ message: "Show timing added successfully" });
  } catch (error) {
    console.error("Error adding show timing:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
const updateShowTiming = async (req, res) => {
  try {
    const { id } = req.params;
    const { timings } = req.body;
    console.log(id, " ", timings);
    if (!Array.isArray(timings) || timings.length === 0) {
      return res
        .status(400)
        .json({ error: "Timings must be a non-empty array." });
    }

    const showTiming = await showTimings.findById(id);

    if (!showTiming) {
      return res.status(404).json({ error: "Show timing not found." });
    }

    showTiming.timings = timings;

    await showTiming.save();

    res.status(200).json({ message: "Show timing updated successfully." });
  } catch (error) {
    console.error("Error updating show timing:", error);
    res
      .status(500)
      .json({ error: "An error occurred while updating the show timing." });
  }
};
const blockShowTiming = async (req, res) => {
  try {
    const { timingId } = req.params;
    console.log("timing id ", timingId);
    if (!timingId) {
      return res.status(400).json({ error: "Timing ID is required" });
    }

    const showTiming = await showTimings.findById(timingId);

    if (!showTiming) {
      return res.status(404).json({ error: "Show timing not found" });
    }

    showTiming.blockShow = !showTiming.blockShow;

    await showTiming.save();

    res.json({ message: "Show timing updated successfully", showTiming });
  } catch (error) {
    console.error("Error blocking show timing:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
const editScreen = async (req, res) => {
  try {
    const { screenId, screen_number, capacity } = req.body;
    console.log(screenId, " ", screen_number, " ", capacity);
    const updatedScreen = await screen.findByIdAndUpdate(
      screenId,
      {
        screen_number,
        capacity,
        updated_at: Date.now(),
      },
      { new: true }
    );

    if (!updatedScreen) {
      return res.status(404).json({ message: "Screen not found" });
    }
    res.status(200).json({
      message: "Screen updated successfully",
      screen: updatedScreen,
    });
  } catch (error) {
    console.error("Error updating screen:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
const updateLayout = async (req, res) => {
  try {
    const { layoutId, class_name, price } = req.body;
    console.log("in updatelayout ");
    if (!layoutId || !class_name || !price) {
      return res.status(400).json({ error: "All fields are required" });
    }
    const updatedLayout = await seatingLayout.findByIdAndUpdate(
      layoutId,
      { class_name, price, updated_at: Date.now() },
      { new: true }
    );

    if (!updatedLayout) {
      return res.status(404).json({ error: "Layout not found" });
    }

    res
      .status(200)
      .json({ message: "Layout updated successfully", layout: updatedLayout });
  } catch (error) {
    console.error("Error updating layout:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
const viewMovies = async (req, res) => {
  try {
    const { language } = req.query;
    console.log("Language ", language);
    const movieList = await movies.find({ language });
    console.log(" movies list ");
    if (!movieList) {
      return res.status(400).json({ message: "No movies" });
    }
    return res.status(200).json(movieList);
  } catch (error) {
    console.error("Error fetching movies:", error);
    res
      .status(500)
      .json({ message: "An error occurred while fetching movies" });
  }
};
const deleteScreen = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { screenId } = req.query;

    if (!screenId) {
      return res.status(400).json({ message: "Screen ID is required" });
    }

    // Find the screen's seating layouts
    const seatingLayouts = await seatingLayout
      .find({ screen_id: screenId })
      .session(session);

    for (const layout of seatingLayouts) {
      // Find rows for each seating layout
      const rows = await row
        .find({ seating_layout_id: layout._id })
        .session(session);

      for (const row of rows) {
        // Delete seats for each row
        await seat.deleteMany({ row_id: row._id }).session(session);
      }

      // Delete rows associated with the seating layout
      await row.deleteMany({ seating_layout_id: layout._id }).session(session);
    }

    // Delete the seating layouts associated with the screen
    await seatingLayout.deleteMany({ screen_id: screenId }).session(session);

    // Finally, delete the screen itself
    const deletedScreen = await screen
      .findByIdAndDelete(screenId)
      .session(session);

    if (!deletedScreen) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Screen not found" });
    }

    // Remove the screen ID from the Theater's screen_ids array
    await theater.updateOne(
      { screen_ids: screenId },
      { $pull: { screen_ids: screenId } },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    res
      .status(200)
      .json({ message: "Screen and related data deleted successfully" });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error deleting screen and related data:", error);
    res.status(500).json({ message: "Server error" });
  }
};
const fetchScreen = async (req, res) => {
  try {
    const { currentScreenId } = req.query;
    console.log("In fetch screen ", currentScreenId);
    const screenDetails = await screen.findOne({ _id: currentScreenId });
    if (!screenDetails) {
      response.status(400).json({ message: "ScreenDetails not found" });
    }
    res.status(200).json({ screenDetails });
  } catch (error) {
    res.status(500).json({
      message: "Screen not found",
    });
  }
};
const fetchClass = async (req, res) => {
  try {
    const { layoutId } = req.query;
    console.log("in fetchClass , classId ", layoutId);
    const classDetails = await seatingLayout.findOne({ _id: layoutId });
    console.log(classDetails);
    if (!classDetails) {
      console.log(" seatingLayout not found !!");
    } else {
      res.status(200).json({
        classDetails,
      });
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Something wrong went while fetching seatingLayout" });
  }
};
const fetchSection = async (req, res) => {
  try {
    const { layoutId } = req.query;
    console.log("layoutId is ", layoutId);
    const sections = await section.find({ seating_layout_id: layoutId });
    console.log("sections ", sections);
    res.status(200).json({ sections });
  } catch (error) {
    console.error("Error fetching sections:", error);
    res.status(500).json({ message: "Error fetching sections" });
  }
};
const fetchRows = async (req, res) => {
  try {
    const { layoutId } = req.query;
    console.log("in fetchRows ", layoutId);
    const layout = await seatingLayout.findById({ _id: layoutId }).populate({
      path: "section_ids",
      populate: {
        path: "row_ids",
        model: "Row",
      },
    });
    const sections = layout.section_ids;
    console.log("In fetch rows ", sections);
    if (!layout) {
      return res.status(404).json({ message: "Seating layout not found" });
    }

    res.status(200).json({ sections: layout.section_ids });
  } catch (error) {
    console.error("Error fetching seating layout:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
const fetchRowDetails = async (req, res) => {
  try {
    const { rowId } = req.query;
    console.log("in fetch row details ", rowId);
    const rowDetails = await row.findOne({ _id: rowId });
    console.log("rowDetails ", rowDetails);
    if (!rowDetails) {
      console.log("row not found");
      res.status(400).json({ message: " Row not found !!" });
    }
    res.status(200).json({ rowDetails });
  } catch (error) {
    console.log(" in catch block ", error);
    res.status(500).json({ message: "Error occured while fetching row !!" });
  }
};
const getTheaterLocations = async (req, res) => {
  try {
    const cities = await theater.distinct("city");
    res.status(200).json(cities);
  } catch (error) {
    console.error("Error fetching cities:", error);
    res.status(500).json({ error: "Failed to fetch cities" });
  }
};
const deleteTheater = async (req, res) => {
  try {
    const { id } = req.params;
    const { isDeleted } = req.body;
    console.log("isDeleted ",isDeleted)
    await theater.findByIdAndUpdate(id, { isDeleted });
    res.status(200).send({ message: 'Theater status updated successfully' });
  } catch (error) {
    res.status(500).send({ message: 'Error updating theater status', error });
  }
};

module.exports = {
  createTheater,
  editTheater,
  deleteTheater,
  viewTheaters,
  addScreen,
  viewScreens,
  addSeatingLayout,
  viewSeatingLayouts,
  addRows,
  updateRow,
  viewRows,
  addSections,
  fetchSections,
  addSeats,
  fetchScreenDetails,
  viewShowTimings,
  addShowTimings,
  updateShowTiming,
  blockShowTiming,
  editScreen,
  updateLayout,
  viewMovies,
  deleteScreen,
  fetchScreen,
  fetchClass,
  fetchSection,
  fetchRows,
  fetchRowDetails,
  getTheaterLocations,
};
