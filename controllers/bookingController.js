const nodemailer = require("nodemailer");
const seat = require("../models/seatModel");
const row = require("../models/rowModel");
const Booking = require("../models/bookingModel");
const users = require("../models/userModel");
const ShowTimings = require("../models/showTimings");
const HeldSeat = require("../models/heldSeatModel");
const theaters = require("../models/theaterModel");
const movies = require("../models/moviesModel");
const screen = require("../models/screenModel");
const wallet = require("../models/WalletModel");
const walletTransaction = require("../models/walletTransactionModel");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const Razorpay = require("razorpay");
const qrcode = require("qrcode");
const crypto = require("crypto");

const holdDuration = 3 * 60 * 1000;

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});
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
const holdSeats = async (
  { userId, screenId, showDate, showTime, seatIds },
  releaseHoldCallback
) => {
  try {
    // Check if any of the seats are already held
    const unavailableSeats = await HeldSeat.find({
      screenId,
      showDate,
      showTime,
      seatIds: { $in: seatIds },
    });
    if (unavailableSeats.length > 0) {
      return {
        success: false,
        message: "Some seats are already held or booked.",
        unavailableSeats: unavailableSeats.map((seat) => seat.seatIds).flat(),
      };
    }

    // Hold the seats by creating a new document
    const newHold = new HeldSeat({
      userId,
      screenId,
      showDate,
      showTime,
      seatIds,
    });

    await newHold.save();

    // Set a timeout to release the hold after the holdDuration
    setTimeout(async () => {
      await HeldSeat.deleteOne({ _id: newHold._id }); // Release hold after timeout
      seatIds.forEach((seatId) => releaseHoldCallback(seatId)); // Emit release callback for each seat
    }, holdDuration);

    return { success: true };
  } catch (error) {
    console.error("Error in holdSeats:", error);
    return { success: false, message: "Internal server error." };
  }
};

const releaseSeatHold = async (seatId, releaseHoldCallback) => {
  try {
    const heldSeat = await HeldSeat.findOneAndDelete({ seatIds: seatId });
    if (heldSeat) {
      releaseHoldCallback(seatId);
    }
  } catch (error) {
    console.error("Error releasing seat hold:", error);
  }
};
const findHeldSeats = async ({ screenId, showDate, showTime }) => {
  try {
    const heldSeats = await HeldSeat.find({ screenId, showDate, showTime });
    return {
      success: true,
      heldSeats: heldSeats.map((hold) => hold.seatIds).flat(),
    };
  } catch (error) {
    console.error("Error fetching held seats:", error);
    return { success: false, message: "Error fetching held seats" };
  }
};
const findUserHeldSeats = async ({ userId, screenId, showDate, showTime }) => {
  try {
    const heldSeats = await HeldSeat.find({
      userId,
      screenId,
      showDate,
      showTime,
    });
    return {
      success: true,
      heldSeats: heldSeats.map((hold) => hold.seatIds).flat(),
    };
  } catch (error) {
    console.error("Error fetching held seats:", error);
    return { success: false, message: "Error fetching held seats" };
  }
};

const placeOrder = async (req, res) => {
  try {
    const { amount, currency } = req.body;
    console.log("amount,currency ", amount, " ", currency);
    const options = {
      amount: Math.round(amount * 100),
      currency: currency,
      receipt: `receipt_${Date.now()}`,
    };
    
    const order = await razorpayInstance.orders.create(options);
    console.log("order ", order);
    res.json(order);
  } catch (error) {
    console.log("in catch ", error);
    res.status(500).send("Error in creating Razorpay order");
  }
};
const confirmPayment = async (req, res) => {
  try {
    const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;

    const body = razorpayOrderId + "|" + razorpayPaymentId;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature === razorpaySignature) {
      console.log("signature verified");
      res.json({ status: "success" });
    } else {
      console.log("falied **** ")
      res.status(400).json({ status: "failed" });
    }
  } catch (error) {
    console.log(error);
  }
};
const bookTicket = async (req, res) => {
  try {
    const {
      userId,
      userEmail,
      movieId,
      theaterId,
      screenId,
      showDate,
      showTime,
      seatIds,
      totalAmount,
      payment,
    } = req.body;

    const showDetails = await ShowTimings.findOne({
      theater_id: theaterId,
      screen_id: screenId,
      movie_id: movieId,
      timings: showTime,
    });

    if (!showDetails) {
      console.log("Invalid show details provided");
      return res.status(400).json({ message: "Invalid show details provided" });
    }

    const existingBookings = await Booking.find({
      screenId,
      showDate,
      showTime,
      "seatIds.seatId": { $in: seatIds },
      "seatIds.status": "Booked",
    });

    if (existingBookings.length > 0) {
      console.log("Some seats are already booked");
      return res.status(400).json({ message: "Some seats are already booked" });
    }

    let calculatedTotalPrice = 0;
    for (const seatId of seatIds) {
      const seatInfo = await seat.findById(seatId).populate("row_id");
      if (!seatInfo) {
        console.log(" seatInfo notfound!! ");
        throw new Error(`Seat with ID ${seatId} not found`);
      }
      calculatedTotalPrice += seatInfo.row_id.price;
    }

    if (calculatedTotalPrice >= totalAmount) {
      console.log("Invalid total amount provided");
      return res.status(400).json({ message: "Invalid total amount provided" });
    }

    if (!["razorpay", "wallet"].includes(payment.method)) {
      console.log("Invalid payment method");
      return res.status(400).json({ message: "Invalid payment method" });
    }

    if (!payment.transactionId && payment.method === "razorpay") {
      console.log("Transaction ID is required for Razorpay");
      return res
        .status(400)
        .json({ message: "Transaction ID is required for Razorpay" });
    }

    const formattedSeatIds = seatIds.map((seatId) => ({
      seatId: seatId,
      status: "Booked",
    }));

    const theaterDetails = await theaters.findById({ _id: theaterId });
    if (!theaterDetails) {
      throw new Error("Theater not found");
    }

    const bookingCount = await Booking.countDocuments({ theaterId });
    const theaterPrefix = theaterDetails.name.substring(0, 3).toUpperCase();
    const digits = String(bookingCount + 1).padStart(12, "0");
    const bookingId = `${theaterPrefix}${digits}`;

    const newBooking = new Booking({
      userId,
      userEmail,
      movieId,
      theaterId,
      screenId,
      showDate,
      showTime,
      seatIds: formattedSeatIds,
      totalPrice: totalAmount,
      payment,
      status: "Confirmed",
      bookingId,
    });

    const qrData = {
      bookingId,
      userEmail,
      movieId,
      theaterId,
      screenId,
      showDate,
      showTime,
      seats: seatIds,
      totalAmount,
    };
    const qrCodeUrl = await qrcode.toDataURL(JSON.stringify(qrData));

    newBooking.qrCode = qrCodeUrl;
    const savedBooking = await newBooking.save();
    if (payment.method === "wallet") {
      console.log("in wallet transaction model")
      const walletTransactionDetails = new walletTransaction({
        userId,
        amount: totalAmount,
        type: "Debit",
        booking_Id: savedBooking._id,
      });
      await walletTransactionDetails.save();
    }
    const screenDetails = await screen.findById({ _id: screenId });
    const movieDetails = await movies.findById({ _id: movieId });

    const seatDetailsPromises = seatIds.map(async (seatId) => {
      const selectedSeats = await seat.findById(seatId).populate({
        path: "row_id",
        populate: { path: "seating_layout_id" },
      });

      if (!selectedSeats) {
        throw new Error(`Seat with ID ${seatId} not found`);
      }

      const rows = selectedSeats.row_id;
      const seatingLayout = rows.seating_layout_id;

      return {
        seatNumber: selectedSeats.seat_number,
        rowName: rows.row_name,
        className: seatingLayout.class_name,
      };
    });

    const seatDetails = await Promise.all(seatDetailsPromises);

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD,
      },
    });

    const qrCodeBuffer = Buffer.from(
      qrCodeUrl.replace(/^data:image\/\w+;base64,/, ""),
      "base64"
    );

    const mailOptions = {
      from: process.env.EMAIL,
      to: userEmail,
      subject: "Your Movie Ticket Booking Confirmation",
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #ccc; border-radius: 8px; padding: 20px; background-color: #f9f9f9;">
          <h2 style="color: #4CAF50; text-align: center; margin-bottom: 20px;">Booking Confirmation</h2>
          <p style="font-size: 16px; margin-bottom: 8px;">Booking ID: <strong>${bookingId}</strong></p>
          <p style="font-size: 16px; margin-bottom: 8px;">Theater: <strong>${
            theaterDetails.name
          }</strong></p>
          <p style="font-size: 16px; margin-bottom: 8px;">Movie: <strong>${
            movieDetails.title
          }</strong></p>
          <p style="font-size: 16px; margin-bottom: 8px;">Screen: <strong>${
            screenDetails.screen_number
          }</strong></p>
          <p style="font-size: 16px; margin-bottom: 8px;">Show Date: <strong>${new Date(
            showDate
          ).toLocaleDateString()}</strong></p>
          <p style="font-size: 16px; margin-bottom: 8px;">Show Time: <strong>${showTime}</strong></p>
          <p style="font-size: 16px; margin-bottom: 8px;">Total Price: <strong>₹${totalAmount}</strong></p>
          <p style="font-size: 16px; margin-bottom: 8px;">Seats:</p>
          <ul style="list-style: none; padding: 0; font-size: 16px; margin-bottom: 20px;">
            ${seatDetails
              .map(
                (seat) =>
                  `<li style="background-color: #f2f2f2; margin-bottom: 8px; padding: 10px; border-radius: 4px; border: 1px solid #ddd;">
                    ${seat.className} - Row: ${seat.rowName}, Seat: ${seat.seatNumber}
                  </li>`
              )
              .join("")}
          </ul>
          <p style="text-align: center; margin-bottom: 20px;">Scan the QR code below to access your booking details:</p>
          <div style="text-align: center;">
            <img src="cid:qr-code" alt="QR Code" style="width: 200px; height: 200px; border: 1px solid #ddd; border-radius: 8px;" />
          </div>
          <p style="font-size: 14px; color: #777; text-align: center; margin-top: 20px;">
            Thank you for booking with us. Enjoy your movie!
          </p>
        </div>
      `,
      attachments: [
        {
          filename: "qr-code.png",
          content: qrCodeBuffer,
          contentType: "image/png",
          cid: "qr-code",
        },
      ],
    };

    await transporter.sendMail(mailOptions);

    res.status(201).json({ booking: savedBooking, qrCode: qrCodeUrl });
  } catch (error) {
    console.error("Error saving booking or sending email:", error);
    res
      .status(500)
      .json({ message: "Error saving booking or sending email", error });
  }
};

const getBookingHistory = async (req, res) => {
  try {
    const { userEmail } = req.params;
    const user = await users.findOne({ email: userEmail });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Check if the user is blocked
    if (user.blockUser) {
      return res
        .status(403)
        .json({ message: "User is blocked. Access denied." });
    }

    const bookings = await Booking.find({ userEmail })
      .populate("movieId")
      .populate("theaterId")
      .populate("screenId")
      .populate({
        path: "seatIds.seatId",
        populate: {
          path: "row_id",
          populate: { path: "seating_layout_id" },
        },
      })
      .sort({ createdAt: -1 });

    if (!bookings.length) {
      return res
        .status(404)
        .json({ message: "No booking history found for this user." });
    }
    const bucketName = process.env.S3_BUCKET_NAME
    const updatedBookings = await Promise.all(
      bookings.map(async (booking) => {
        const movie = booking.movieId;
        const moviePosterUrl = await generatePresignedUrl(
          bucketName,
          movie.poster
        );
        movie.poster = moviePosterUrl;
        return booking;
      })
    );
    const bookedSeatCount = bookings.reduce((count, booking) => {
      const bookedSeats = booking.seatIds.filter(
        (seat) => seat.status === "Booked"
      );
      return count + bookedSeats.length;
    }, 0);
    res.status(200).json({ bookings: updatedBookings, bookedSeatCount });
  } catch (error) {
    console.error("Error fetching booking history:", error);
    res.status(500).json({ message: "Error fetching booking history", error });
  }
};
const cancelBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user?.userId;
    const userEmail = req.user?.userEmail;
    console.log(
      "booking id ,in cancel ticket ",
      bookingId,
      " ",
      userId,
      " ",
      userEmail
    );
    if (!userId && !userEmail) {
      return res.status(500).json({ message: "user email and id is required" });
    }
    const bookingInfo = await Booking.findById(bookingId);

    if (!bookingInfo) {
      return res.status(404).json({ message: "Booking not found." });
    }
    const isOwner =
      bookingInfo.userId === userId || bookingInfo.email === userEmail;

    if (!isOwner) {
      return res
        .status(403)
        .json({ message: "You are not authorized to cancel this booking." });
    }
    let refundAmount = 0;

    // Iterate over seatIds and calculate refund amount for non-canceled seats

    bookingInfo.seatIds.forEach((seat) => {
      if (seat.status !== "Canceled") {
        const seatPrice = seat.seatId.row_id.seating_layout_id.price;
        refundAmount += seatPrice;
        seat.status = "Canceled"; 
      }
    });

    const booking = await Booking.findByIdAndUpdate(
      bookingId,
      { status: "Canceled" },
      { new: true }
    );

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    let userWallet = await wallet.findOne({ userId });
    if (!userWallet) {
      console.log("user wallet not found !!! ");
      userWallet = new wallet({
        userId,
        balance: 0,
      });
      await userWallet.save();
      console.log("New wallet created: ", userWallet);
    }
    userWallet.balance =
      Math.round((userWallet.balance + refundAmount) * 100) / 100;
    await userWallet.save();

    // Record the wallet transaction

    const walletTransactionDetails = new walletTransaction({
      userId,
      amount: refundAmount,
      type: "Credit",
      bookingId,
    });
    await walletTransactionDetails.save();
    console.log("new balance ", userWallet.balance);
    return res.json({ message: "Booking canceled successfully", booking });
  } catch (error) {
    console.error("Error canceling booking:", error);
    return res.status(500).json({ message: "Error canceling booking" });
  }
};
const cancelSeat = async (req, res) => {
  try {
    const { bookingId, seatId, userId } = req.body;
    console.log(
      "bookingId seatId userId ",
      bookingId,
      " ",
      seatId,
      " ",
      userId
    );

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    //console.log("booking id is ", booking);

    const seatObject = booking.seatIds.find((s) => s.seatId.equals(seatId));
    console.log("seat found ", seatObject);

    if (!seatObject || seatObject.status === "Canceled") {
      return res
        .status(400)
        .json({ message: "Seat not found or already canceled" });
    }
    console.log("seatId ", seatId, " ", typeof seatId);
    const seatDetails = await seat.findById(seatId).populate({
      path: "row_id",
      populate: {
        path: "seating_layout_id",
        model: "SeatingLayout",
      },
    });

    if (!seatDetails) {
      return res.status(404).json({ message: "Seat details not found" });
    }

    const seatPrice = seatDetails.row_id.seating_layout_id.price;
    console.log("seatPrice ", seatPrice);
    seatObject.status = "Canceled";
    seatObject.isRefunded = true;
    /* booking.totalPrice = Math.round((booking.totalPrice - seatPrice) * 100) / 100;  */
    await booking.save();

    // Seat amount is credited to wallet

    let userWallet = await wallet.findOne({ userId });
    if (!userWallet) {
      userWallet = new wallet({ userId, balance: 0 });
      await userWallet.save();
    }
    userWallet.balance =
      Math.round((userWallet.balance + seatPrice) * 100) / 100;
    await userWallet.save();

    // for wallet history
    const walletTransactionDetails = new walletTransaction({
      userId,
      amount: seatPrice,
      type: "Credit", // Since it's a refund
      bookingId,
    });
    //booking.status = "Canceled";
    await walletTransactionDetails.save();
    // if allseats are cancelled then status will be cancelled
    const allSeatsCanceled = booking.seatIds.every(
      (s) => s.status === "Canceled"
    );
    console.log("all seats cancelled ", allSeatsCanceled);
    if (allSeatsCanceled) {
      console.log("all seats are canceled ");
      booking.status = "Canceled";
      await booking.save();
    }
    return res.json({ message: "Seat canceled successfully", booking });
  } catch (error) {
    console.error("Error canceling seat:", error);
    return res.status(500).json({ message: "Error canceling seat" });
  }
};
module.exports = {
  holdSeats,
  releaseSeatHold,
  findHeldSeats,
  findUserHeldSeats,
  placeOrder,
  confirmPayment,
  bookTicket,
  getBookingHistory,
  cancelBooking,
  cancelSeat,
};
