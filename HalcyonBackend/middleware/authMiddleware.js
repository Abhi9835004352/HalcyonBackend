const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();

module.exports = (req, res, next) => {
    console.log('Auth middleware called');
    console.log('Headers:', req.headers);

    const token = req.headers.authorization?.split(' ')[1];
    console.log('Token extracted:', token ? 'Token exists' : 'No token');

    if (!token) return res.status(401).json({ error: "Access denied, no token provided" });

    try {
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );
        console.log('Token decoded:', decoded);

        req.user = {
            _id: decoded.id,
            id: decoded.id,
            role: decoded.role
        }
        console.log('User set on request:', req.user);

        next();
    } catch (err) {
        console.error('Token verification error:', err);
        res.status(401).json({ error: "Invalid token" });
    }
}

