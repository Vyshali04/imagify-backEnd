import jwt from "jsonwebtoken";

const userAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ success: false, message: "Not authorized. Login again" });
        }

        const token = authHeader.split(" ")[1]; // Extract token from 'Bearer <token>'

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.body.userId = decoded.id; // Attach userId to the request
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: "Token expired. Login again" });
    }
};

export default userAuth;
