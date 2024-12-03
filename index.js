//Database connection
const { connectionToDatabase } = require("./script");

// -----------------------------------------------

const http = require("http");
const { Server } = require("socket.io");
const express = require("express");
require("dotenv").config();

const port = process.env.port || 5000;
const app = express();
const cors = require("cors");
const path = require("path");

const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes");
const theaterAdminRoutes = require("./routes/theaterAdminRoutes");
const bookingController = require("./controllers/bookingController");
// middlewares
app.use(express.json());
app.use(cors());

app.use("/public", express.static(path.join(__dirname, "public")));

//connection to database
connectionToDatabase();

//routes
app.use("/admin", adminRoutes);
app.use("/", userRoutes);
app.use("/tmAdmin", theaterAdminRoutes);
app.use((req, res, next) => {
  res.status(404).send("404 - Page Not Found");
});
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    method: ["GET", "POST"],
  },
});
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  // Join room based on screenId, showDate, showTime
  socket.on("joinRoom", ({ screenId, showDate, showTime }) => {
    const room = `${screenId}-${showDate}-${showTime}`;
    socket.join(room);
    console.log(`Socket ${socket.id} joined room ${room}`);
  });

  // Handle seat holding
  socket.on(
    "holdSeats",
    async ({ userId, screenId, showDate, showTime, seatIds }) => {
      if (
        !userId ||
        !screenId ||
        !showDate ||
        !showTime ||
        !Array.isArray(seatIds)
      ) {
        console.log("Invalid data provided for holding seats.");
        socket.emit("holdSeatsResponse", {
          success: false,
          message: "Invalid data provided.",
        });
        return;
      }
      console.log("Processing holdSeats request for userId:", userId);

      const result = await bookingController.holdSeats(
        { userId, screenId, showDate, showTime, seatIds },
        (seatId) => {
          // Callback to handle seat release
          const room = `${screenId}-${showDate}-${showTime}`;
          io.to(room).emit("seatsReleased", { seatId });
        }
      );

      if (result.success) {
        // Emit to the room that seats are held
        const room = `${screenId}-${showDate}-${showTime}`;
        io.to(room).emit("seatsHeld", { seatIds, userId });

        // Emit success response to the client who made the request
        socket.emit("holdSeatsResponse", { success: true });
      } else {
        // Emit failure response to the client
        socket.emit("holdSeatsResponse", {
          success: false,
          message: result.message,
          unavailableSeats: result.unavailableSeats,
        });
      }
    }
  );
  socket.on("getHeldSeats", async ({ screenId, showDate, showTime }) => {
    try {
      const result = await bookingController.findHeldSeats({
        screenId,
        showDate,
        showTime,
      });
      if (result.success) {
        socket.emit("heldSeatsData", { heldSeats: result.heldSeats });
      } else {
        socket.emit("heldSeatsData", { heldSeats: [] });
      }
    } catch (error) {
      console.error("Error fetching held seats:", error);
      socket.emit("heldSeatsData", { heldSeats: [] });
    }
  });
  socket.on(
    "getUserHeldSeats",
    async ({ userId, screenId, showDate, showTime }) => {
      try {
        const result = await bookingController.findUserHeldSeats({  
          userId,
          screenId,
          showDate,
          showTime,
        });
        if (result.success) {
          socket.emit("userHeldSeatsData", { heldSeats: result.heldSeats });
        } else {
          socket.emit("userHeldSeatsData", { heldSeats: [] });
        }
      } catch (error) {
        console.error("Error fetching held seats:", error);
        socket.emit("userHeldSeatsData", { heldSeats: [] });
      }
    }
  );

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
