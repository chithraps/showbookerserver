const jwt = require("jsonwebtoken");

const verifyToken = (requiredRole) => (req, res, next) => {
  const authHeader = req.headers.authorization;
 
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("No token");
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.JWTPRIVATEKEY, (err, decoded) => {
    if (err) {
      const message =
        err.name === "TokenExpiredError"
          ? "Unauthorized: Token has expired"
          : "Unauthorized: Invalid token";
    
      console.log(message);
      return res.status(401).json({ message });
    }

    const { userId, userEmail, role } = decoded;
    console.log("Token available, user role:", role, "user email:", userEmail, "user id:", userId);

    if (requiredRole && role !== requiredRole) {
      return res.status(403).json({ error: "Forbidden: Access denied" });
    }

    req.user = { userId, userEmail, role };
    next();
  });
};
module.exports = {
  verifyToken,
};
